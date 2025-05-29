from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from datetime import datetime
import asyncio
import random
import os
import csv
import atexit
from process_mission import process_mission
from mavlink_interface import MavlinkInterface

telemetry_log = []
recording_enabled = True
result = None  # global placeholder
mission_data = None
ats_mission_data = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    asyncio.create_task(simulate_drone())
    yield
    # Shutdown logic (if any)


app = FastAPI(lifespan=lifespan)

log_counter = 0  # top-level, above add_log()

# TODO: Remember to implement
drone_state = {
    "armed": False,
    "mode": "Stabilize",
    "recording": False,
    "rssi": "--%",
    "ping": "--ms",
    "videoLatency": "--ms",
    "gps": {"lat": 0, "lon": 0, "sats": 0, "hdop": 0.0},
    "battery": {"voltage": 0, "current": 0, "percent": 0},
    "uav_connected": True,
}

log_entries = []

# === CORS for React frontend ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def write_csv_log(data, prefix):
    return # TODO: delete this during prod
    if not data:
        print(f"[Shutdown] No {prefix} data to save.")
        return

    # Ensure subdirectory exists
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)

    # Create full path
    filename = os.path.join(log_dir, f"{prefix}_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
    print(f"[Shutdown] Saving {prefix} to {filename}...")

    # Write CSV
    with open(filename, mode="w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

    print(f"[Shutdown] {prefix.capitalize()} saved.")


def save_telemetry_to_csv():
    add_log("Exiting backend", importance="major")
    write_csv_log(telemetry_log, "telemetry")
    write_csv_log(log_entries, "logs")


atexit.register(save_telemetry_to_csv)


def add_log(message: str, importance: str = "minor", severity: str = "info"):
    global log_counter
    timestamp = datetime.now().strftime("%H:%M:%S")
    entry = {
        "id": log_counter,
        "timestamp": timestamp,
        "message": message,
        "importance": importance,
        "severity": severity,
    }
    log_counter += 1
    # print(f"[LOG] New log added: {entry}")
    log_entries.insert(0, entry)
    if len(log_entries) > 1000:
        log_entries.pop()


# === Background simulation task ===
async def simulate_drone():
    while True:
        # Simulate battery drain and current fluctuations
        drone_state["battery"]["voltage"] = round(random.uniform(10.5, 12.6), 2)
        drone_state["battery"]["current"] = round(random.uniform(0.5, 2.0), 2)
        drone_state["battery"]["percent"] = max(0,
                                                min(100, drone_state["battery"]["percent"] - random.uniform(0.01, 0.1)))

        # Simulate GPS movement
        drone_state["gps"]["lat"] = round(drone_state["gps"]["lat"] + random.uniform(-0.0001, 0.0001), 6)
        drone_state["gps"]["lon"] = round(drone_state["gps"]["lon"] + random.uniform(-0.0001, 0.0001), 6)
        drone_state["gps"]["sats"] = random.randint(6, 12)
        drone_state["gps"]["hdop"] = round(random.uniform(0.6, 1.8), 2)

        # Simulate signal/link quality
        drone_state["rssi"] = f"{random.randint(60, 95)}%"
        drone_state["ping"] = f"{random.randint(20, 120)}ms"
        drone_state["videoLatency"] = f"{random.randint(50, 300)}ms"

        # add_log("Telemetry updated")

        await asyncio.sleep(random.choice(range(3)))  # update every second


# === Basic REST Endpoints ===
@app.get("/")
def root():
    return {"message": "Aetherius GCS backend is live!"}


@app.get("/status")
def read_status():
    return {"status": "running"}


@app.post("/api/command/{action}")
async def command_action(action: str):
    print(f"[REST] Received command: {action}")

    # Simulate changes — this should be replaced with MAVLink commands
    if action == "arm":
        drone_state["armed"] = True
        add_log("Drone armed", importance="major")
    elif action == "disarm":
        drone_state["armed"] = False
        add_log("Drone disarmed", importance="major")
    elif action == "hold_alt":
        drone_state["mode"] = "Alt Hold"
        add_log("Altitude hold")
    elif action == "rtl":
        drone_state["mode"] = "Return to Launch"
        add_log("Return to Launch", importance="major", severity="warning")
    elif action == "abort":
        drone_state["mode"] = "Failsafe"
        drone_state["armed"] = False
        add_log("Mission abort, entering failsafe mode", importance="critical", severity="error")

    return JSONResponse(content={"result": "acknowledged", "action": action})


@app.get("/api/logs")
def get_logs():
    return {"logs": log_entries}


@app.post("/api/mission/process")
async def upload_mission(mission: dict):
    global mission_data, result
    mission_data = mission
    add_log("Mission uploaded")
    result = process_mission(mission_data)
    return JSONResponse(content={"result": "Mission received", "analysis": result})


@app.get("/api/mission/process")
async def get_mission():
    global result
    if result is None:
        return JSONResponse(status_code=404, content={"error": "No mission processed yet"})
    return result


@app.get("/api/mission/autosave")
def get_autosave():
    add_log("Autosave loaded")
    return ats_mission_data
@app.post("/api/mission/autosave")
async def save_autosave(mission: dict):
    global ats_mission_data
    ats_mission_data = mission
    add_log("Autosave updated")
    return JSONResponse(content={"result": "Autosave updated"})


# === WebSocket for real-time telemetry and control ===
@app.websocket("/ws/telemetry")
async def telemetry_socket(websocket: WebSocket):
    await websocket.accept()
    print("[WebSocket] Telemetry socket connected")

    last_log_id = -1  # New per-connection state

    try:
        while True:
            new_logs = [log for log in log_entries if log["id"] > last_log_id]
            if new_logs:
                last_log_id = new_logs[0]["id"]  # update to latest ID sent

            await websocket.send_json({
                **drone_state,
                "logs": new_logs
            })

            # Log telemetry snapshot if recording
            if recording_enabled:
                telemetry_log.append({
                    "timestamp": datetime.now().isoformat(),
                    "lat": drone_state["gps"]["lat"],
                    "lon": drone_state["gps"]["lon"],
                    "sats": drone_state["gps"]["sats"],
                    "hdop": drone_state["gps"]["hdop"],
                    "voltage": drone_state["battery"]["voltage"],
                    "current": drone_state["battery"]["current"],
                    "percent": drone_state["battery"]["percent"],
                    "rssi": drone_state["rssi"],
                    "ping": drone_state["ping"],
                    "videoLatency": drone_state["videoLatency"],
                    "mode": drone_state["mode"],
                    "armed": drone_state["armed"]
                    # TODO: sync with video frame if recording
                })

            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)
                await process_client_command(msg)
            except asyncio.TimeoutError:
                pass

            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        print("[WebSocket] Disconnected")


@app.get("/api/telemetry/log")
def get_telemetry_log():
    return {"telemetry": telemetry_log}


# === Placeholder for future command handler ===
async def process_client_command(msg: dict):
    """
    TODO: Interpret and act on messages received from the frontend.
    Expected examples:
        - {"joystick": {"throttle": 0.8, "yaw": 0.1, "pitch": -0.3, "roll": 0.0}}
        - {"command": "arm"}
        - {"control_mode": "rate"}
    """
    # For now, just print the input
    print(f"[Handler] TODO - Process message: {msg}")

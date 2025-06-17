from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from datetime import datetime
from threading import Thread
import asyncio
import random
import os
import atexit
import time

from process_mission import process_mission
from uav_server import UAVServer
from uav_connection import UAVConnection

telemetry_log = []
telemetry_recording_enabled = True
result = None  # global placeholder
mission_data = None
ats_mission_data = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # derive project_root = project_dir/frontend/.. → project_dir
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # point at the whole onboard/rpi folder
    base_dir = os.path.join(project_root, "onboard", "rpi")

    # start the directory‐serving HTTP server in a daemon thread
    server = UAVServer(port=8080, base_dir=base_dir)
    server_thread = Thread(target=server.start, daemon=True)
    server_thread.start()
    print("Update server started, serving:", base_dir)

    print("Connecting to rpi")
    await UAVConnection()


    # fire off your existing mainloop task
    main_task = asyncio.create_task(mainloop())

    try:
        yield
    finally:
        # on shutdown, cancel mainloop and stop HTTP server cleanly
        main_task.cancel()
        server.shutdown()    # calls httpd.shutdown()/server_close()
        server_thread.join()
        print("Update server stopped.")


app = FastAPI(lifespan=lifespan)

log_counter = 0  # top-level, above add_log()
log_entries = []

last_high_rate = {}
last_status_state = {}
high_rate_log = []
status_log = []
STATUS_KEYS = ["armed", "mode", "manual_control_enabled", "autopilot_active", "mission"]

# TODO: Remember to implement
drone_state = {
    # Connection and control status
    "uav_connected": True,
    "armed": False,
    "mode": "Stabilize",
    "failsafe": {
        "gps": False,
        "battery": False,
        "rc": False,
        "gcs": False,
    },
    "manual_control_enabled": False,
    "autopilot_active": False,

    # Communication
    "rssi": "--%",  # Signal strength
    "ping": "--ms",  # Ground-to-air ping
    "videoLatency": "--ms",
    "last_heartbeat": "--s",
    "link_status": {
        "mavlink": True,
        "video": True,
        "telemetry": True,
        "mission": True,
    },

    # Positioning and navigation
    "gps": {
        "lat": 0.0,
        "lon": 0.0,
        "alt": 0.0,
        "relative_alt": 0.0,
        "hdop": 0.0,
        "vdop": 0.0,
        "sats": 0,
        "fix_type": "No Fix",  # e.g., "No Fix", "2D Fix", "3D Fix", "RTK"
    },
    "ekf_status": {
        "pos_horiz_abs": True,
        "pos_vert_abs": True,
        "vel_horiz_abs": True,
        "yaw_align": True,
        "imu_consistent": True,
    },
    "imu": {
        "accel": {"x": 0.0, "y": 0.0, "z": 0.0},
        "gyro": {"x": 0.0, "y": 0.0, "z": 0.0},
        "mag": {"x": 0.0, "y": 0.0, "z": 0.0},
        "temp": 0.0,
    },

    # Orientation and movement
    "attitude": {
        "roll": 0.0,
        "pitch": 0.0,
        "yaw": 0.0,
    },
    "velocity": {
        "x": 0.0,
        "y": 0.0,
        "z": 0.0,
        "airspeed": 0.0,
        "groundspeed": 0.0,
    },

    # Battery and power
    "battery": {
        "voltage": 0.0,
        "current": 0.0,
        "percent": 0.0,
        "temperature": 0.0,
        "cell_count": 6,
    },
    "power_module": {
        "input_voltage": 0.0,
        "output_voltage": 0.0,
        "consumption_mAh": 0,
    },

    # Recording and camera
    "recording": False,
    "camera": {
        "streaming": True,
        "resolution": "1280x720",
        "framerate": 30,
        "exposure": "auto",
        "lens_temperature": 0.0,
    },

    # Mission status
    "mission": {
        "active": False,
        "current_wp": 0,
        "total_wp": 0,
        "progress": 0.0,  # percentage
        "paused": False,
    },

    # System health
    "health": {
        "cpu_temp": 0.0,
        "cpu_usage": 0.0,
        "memory_usage": 0.0,
        "disk_usage": 0.0,
        "uptime": "--s",
        "errors": [],
        "warnings": [],
    },

    # Time and sync
    "time": {
        "system_time": "--:--:--",
        "gps_time": "--:--:--",
        "synced": True,
    },

    # Custom data for UI / debugging
    "debug": {
        "last_command": None,
        "last_mission_event": None,
        "custom_flags": {},
    },
}


# === CORS for React frontend ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def write_csv_log(data, prefix):
    pass  # TODO: delete this during prod
    '''
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
    '''


def save_telemetry_to_csv():
    add_log("Exiting backend", importance="major")
    write_csv_log(telemetry_log, "telemetry")
    write_csv_log(log_entries, "logs")


atexit.register(save_telemetry_to_csv)

VALID_IMPORTANCE = {"minor", "major", "critical"}
VALID_SEVERITY = {"debug", "info", "warn", "error", "system"}

def add_log(message: str, *, source: str = "GCS", importance: str = "minor", severity: str = "info"):
    global log_counter

    # Validate inputs
    if importance not in VALID_IMPORTANCE:
        raise ValueError(f"Invalid importance '{importance}'. Must be one of {VALID_IMPORTANCE}")
    if severity not in VALID_SEVERITY:
        raise ValueError(f"Invalid severity '{severity}'. Must be one of {VALID_SEVERITY}")

    timestamp = datetime.now().strftime("%H:%M:%S")
    entry = {
        "id": log_counter,
        "timestamp": timestamp,
        "message": message,
        "source": source,
        "importance": importance,
        "severity": severity,
    }
    log_counter += 1

    # Add to top
    log_entries.insert(0, entry)

    # Trim if too large
    if len(log_entries) > 5000:
        log_entries.pop()

    # Optional: hook for printing / writing to file / broadcasting
    # print(f"[{timestamp}] [{severity.upper()}] [{source}] {message}")



# === Background simulation task ===
async def mainloop():
    global last_high_rate, last_status_state, high_rate_log, last_full_snapshot_time

    while True:
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time()))

        # --- Update telemetry ---
        drone_state["battery"]["voltage"] = round(random.uniform(10.5, 12.6), 2)

        drone_state["gps"]["lat"] = round(drone_state["gps"]["lat"] + random.uniform(-0.0001, 0.0001), 6)

        drone_state["rssi"] = f"{random.randint(60, 95)}%"
        drone_state["ping"] = f"{random.randint(20, 120)}ms"
        drone_state["videoLatency"] = f"{random.randint(50, 300)}ms"


        # --- High-rate logging ---
        MAX_LOG_ENTRIES = 20000
        FULL_SNAPSHOT_INTERVAL = 30  # seconds

        if "last_high_rate" not in locals():
            last_high_rate = {}
            last_full_snapshot_time = time.time()

        # Build current high-rate data
        high_data = {
            "timestamp": timestamp,
            "rssi": drone_state["rssi"],
            "ping": drone_state["ping"],
            "videoLatency": drone_state["videoLatency"],
            "gps_lat": drone_state["gps"]["lat"],
            "gps_lon": drone_state["gps"]["lon"],
            "gps_alt": drone_state["gps"]["alt"],
            "gps_relative_alt": drone_state["gps"]["relative_alt"],
            "gps_hdop": drone_state["gps"]["hdop"],
            "gps_vdop": drone_state["gps"]["vdop"],
            "gps_sats": drone_state["gps"]["sats"],
            "imu_accel": drone_state["imu"]["accel"],
            "imu_gyro": drone_state["imu"]["gyro"],
            "imu_mag": drone_state["imu"]["mag"],
            "imu_temp": drone_state["imu"]["temp"],
            "attitude_roll": drone_state["attitude"]["roll"],
            "attitude_pitch": drone_state["attitude"]["pitch"],
            "attitude_yaw": drone_state["attitude"]["yaw"],
            "velocity_x": drone_state["velocity"]["x"],
            "velocity_y": drone_state["velocity"]["y"],
            "velocity_z": drone_state["velocity"]["z"],
            "velocity_airspeed": drone_state["velocity"]["airspeed"],
            "velocity_groundspeed": drone_state["velocity"]["groundspeed"],
            "battery_voltage": drone_state["battery"]["voltage"],
            "battery_current": drone_state["battery"]["current"],
            "battery_percent": drone_state["battery"]["percent"],
            "battery_temperature": drone_state["battery"]["temperature"],
            "camera_lens_temperature": drone_state["camera"]["lens_temperature"],
            "mission_progress": drone_state["mission"]["progress"],
            "health_cpu_temp": drone_state["health"]["cpu_temp"],
            "health_cpu_usage": drone_state["health"]["cpu_usage"],
            "health_memory_usage": drone_state["health"]["memory_usage"],
            "health_disk_usage": drone_state["health"]["disk_usage"],
        }

        # Only log what changed (delta)
        delta_data = {"timestamp": timestamp}
        for key, val in high_data.items():
            if key == "timestamp":
                continue
            if last_high_rate.get(key) != val:
                delta_data[key] = val

        # Snapshot override every 30 seconds
        now = time.time()
        force_snapshot = now - last_full_snapshot_time >= FULL_SNAPSHOT_INTERVAL
        if force_snapshot:
            add_log("full telemetry logged", importance="major")
            delta_data = high_data.copy()
            last_full_snapshot_time = now

        # Append to rolling buffer
        if len(delta_data) > 1:  # skip empty deltas
            high_rate_log.append(delta_data)
            last_high_rate = high_data.copy()

        # Trim to last N entries
        if len(high_rate_log) > MAX_LOG_ENTRIES:
            high_rate_log = high_rate_log[-MAX_LOG_ENTRIES:]


        # --- Status logging ---
        WATCHED_STATUS_PATHS = [
            "uav_connected",
            "armed",
            "mode",
            "failsafe.gps",
            "failsafe.battery",
            "failsafe.rc",
            "failsafe.gcs",
            "manual_control_enabled",
            "autopilot_active",
            "link_status.mavlink",
            "link_status.video",
            "link_status.telemetry",
            "link_status.mission",
            "gps.fix_type",
            "ekf_status.pos_horiz_abs",
            "ekf_status.pos_vert_abs",
            "ekf_status.vel_horiz_abs",
            "ekf_status.yaw_align",
            "ekf_status.imu_consistent",
            "recording",
            "camera.streaming",
            "camera.resolution",
            "camera.framerate",
            "camera.exposure",
            "mission.active",
            "mission.current_wp",
            "mission.paused",
        ]

        if "last_status_state" not in locals():
            last_status_state = {}

        current_status = {}
        for path in WATCHED_STATUS_PATHS:
            parts = path.split(".")
            val = drone_state
            for part in parts:
                val = val.get(part) if isinstance(val, dict) else None
                if val is None:
                    break
            current_status[path] = val

        if current_status != last_status_state:
            for key in WATCHED_STATUS_PATHS:
                old = last_status_state.get(key)
                new = current_status.get(key)
                if old != new:
                    status_log.append({
                        "timestamp": timestamp,
                        "field": key,
                        "old_value": old,
                        "new_value": new,
                    })
            last_status_state = current_status.copy()

        await asyncio.sleep(0.1)



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
        if drone_state["armed"]:
            add_log("Drone already armed.", importance="major")
        else:
            add_log("Drone armed.", importance="major")
        drone_state["armed"] = True
    elif action == "disarm":
        if not drone_state["armed"]:
            add_log("Drone already disarmed.", importance="major")
        else:
            add_log("Drone disarmed.", importance="major")
        drone_state["armed"] = False
    elif action == "hold_alt":
        drone_state["mode"] = "Alt Hold"
        add_log("Altitude hold")
    elif action == "rtl":
        drone_state["mode"] = "Return to Launch"
        add_log("Returning to Launch", importance="major", severity="warning")
    elif action == "abort":
        drone_state["mode"] = "Failsafe"
        drone_state["armed"] = False
        add_log("Mission abort, entering failsafe mode", importance="critical", severity="error")

    return JSONResponse(content={"result": "acknowledged", "action": action})


@app.get("/api/logs")
def get_logs():
    return {"logs": log_entries}


@app.post("/api/logs")
def add_logs(message: str, importance: str = "minor", severity: str = "info"):
    add_log(message, importance=importance, severity=severity)
    return JSONResponse(content={"result": "added", "action": message})


@app.post("/api/mission/process")
async def upload_mission(mission: dict):
    global mission_data, ats_mission_data, result
    mission_data = mission
    ats_mission_data = mission  # autosave here
    add_log("Mission uploaded and autosaved")
    result = process_mission(mission_data)
    return JSONResponse(content={"result": "Mission received", "analysis": result})


@app.get("/api/mission/process")
async def get_mission_result():
    if result is None:
        return JSONResponse(status_code=404, content={"error": "No mission processed yet"})
    return result


@app.get("/api/mission/autosave")
def get_autosave():
    if ats_mission_data is None:
        return JSONResponse(status_code=404, content={"error": "No autosave found"})
    add_log("Autosave loaded")
    return ats_mission_data


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
            if telemetry_recording_enabled:
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

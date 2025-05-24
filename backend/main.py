from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import random

app = FastAPI()

drone_state = {
    "armed": False,
    "mode": "Stabilize",
    "recording": False,
    "rssi": "--%",
    "ping": "--ms",
    "videoLatency": "--ms",
    "gps": {"lat": 0, "lon": 0, "sats": 0, "hdop": 0.0},
    "battery": {"voltage": 0, "current": 0, "percent": 0},
}

# === CORS for React frontend ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Background simulation task ===
async def simulate_drone():
    while True:
        # Simulate battery drain and current fluctuations
        drone_state["battery"]["voltage"] = round(random.uniform(10.5, 12.6), 2)
        drone_state["battery"]["current"] = round(random.uniform(0.5, 2.0), 2)
        drone_state["battery"]["percent"] = max(0, min(100, drone_state["battery"]["percent"] - random.uniform(0.01, 0.1)))

        # Simulate GPS movement
        drone_state["gps"]["lat"] += round(random.uniform(-0.0001, 0.0001), 6)
        drone_state["gps"]["lon"] += round(random.uniform(-0.0001, 0.0001), 6)
        drone_state["gps"]["sats"] = random.randint(6, 12)
        drone_state["gps"]["hdop"] = round(random.uniform(0.6, 1.8), 2)

        # Simulate signal/link quality
        drone_state["rssi"] = f"{random.randint(60, 95)}%"
        drone_state["ping"] = f"{random.randint(20, 120)}ms"
        drone_state["videoLatency"] = f"{random.randint(50, 300)}ms"

        await asyncio.sleep(1)  # update every second

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulate_drone())


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
    elif action == "disarm":
        drone_state["armed"] = False
    elif action == "hold_alt":
        drone_state["mode"] = "Alt Hold"
    elif action == "rtl":
        drone_state["mode"] = "Return to Launch"
    elif action == "abort":
        drone_state["mode"] = "Failsafe"
        drone_state["armed"] = False

    return JSONResponse(content={"result": "acknowledged", "action": action})


# === WebSocket for real-time telemetry and control ===
@app.websocket("/ws/telemetry")
async def telemetry_socket(websocket: WebSocket):
    await websocket.accept()
    print("[WebSocket] Telemetry socket connected")

    try:
        while True:
            await websocket.send_json(drone_state)

            # Optionally receive commands too
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)
                await process_client_command(msg)
            except asyncio.TimeoutError:
                pass

            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        print("[WebSocket] Disconnected")


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

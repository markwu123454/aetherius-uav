from collections import defaultdict
from typing import Optional, Any, Dict, List, Callable, Awaitable

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import atexit
import time

from process_mission import process_mission
from uav_server import start_update_server
from uav_connection import UAVConnection


# <editor-fold desc="global variables">
telemetry_log = []
result = None  # global placeholder
mission_data = None
ats_mission_data = None
connections: set[asyncio.Queue] = set()

log_entries = []

last_high_rate = {}
last_status_state = {}
high_rate_log = []
status_log = []

# TODO: Remember to implement
drone_state = {
    # Connection and control status
    "uav_connected": True,
    "armed": False,
    "mode": "Stabilize",
}
state = defaultdict(dict)

send_cmd = Callable[[dict], Awaitable[Any]]

# </editor-fold>


# <editor-fold desc="setup">
@asynccontextmanager
async def lifespan(app: FastAPI):
    global state, log_entries, send_cmd
    # start the directory‐serving HTTP server in a daemon thread
    start_update_server()

    uav_client = UAVConnection()

    send_cmd = uav_client.send
    uav_client.log_callback = add_log
    uav_client.telem_callback = send_to_client
    state = uav_client.state
    log_entries = uav_client.logs


    uav_client_task = asyncio.create_task(uav_client.mainloop())
    add_log("GC0001")
    try:
        yield
    finally:
        # on shutdown, cancel mainloop and stop HTTP server cleanly
        uav_client_task.cancel()
        print("Update server stopped.")


def write_csv_log(data, prefix):
    pass  # TODO: delete this during prod
    '''

    # Ensure subdirectory exists
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)

    # Create full path
    filename = os.path.join(log_dir, f"{prefix}_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")

    # Write CSV
    with open(filename, mode="w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

    '''


def save_telemetry_to_csv():
    add_log("GC0100")
    write_csv_log(telemetry_log, "telemetry")
    write_csv_log(log_entries, "logs")


app = FastAPI(lifespan=lifespan)

# === CORS for React frontend ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

atexit.register(save_telemetry_to_csv)


def add_log(
        log_id: str,
        variables: Optional[Dict[str, Any]] = None,
        timestamp: Optional[int] = None,
) -> None:
    variables = variables or {}

    # ensure all values are strings
    converted_vars: Dict[str, str] = {}
    for key, val in variables.items():
        if isinstance(val, str):
            converted_vars[key] = val
        else:
            converted_vars[key] = repr(val)
    variables = converted_vars

    print(f"log_id: {log_id}, variables: {variables}, timestamp: {timestamp}")
    # default timestamp
    if not timestamp:
        timestamp = time.time_ns()

    payload = {
        "log_id": log_id,
        "timestamp": timestamp,
        "variables": variables,
    }

    # insert newest at front
    log_entries.insert(0, payload)

    # optional: print or broadcast here, e.g.:
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            send_to_client({"type": "log", "data": {"timestamp": timestamp, "log_id": log_id, "variables": variables}}))
    except RuntimeError:
        pass


# === Mainloop ===
async def mainloop():
    global last_high_rate, last_status_state, high_rate_log, last_full_snapshot_time

    while True:
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(time.time()))

        # --- High-rate logging ---
        FULL_SNAPSHOT_INTERVAL = 30  # seconds

        if "last_high_rate" not in locals():
            last_high_rate = {}
            last_full_snapshot_time = time.time()
        '''
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
            add_log("GC0000")
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
            '''
        await asyncio.sleep(0.1)

# </editor-fold>

# === Basic REST Endpoints ===
# <editor-fold>
@app.get("/")
def root():
    return {"message": "Aetherius GCS backend is live!"}


@app.get("/status")
def read_status():
    return {"status": "running"}


@app.get("/api/telemetry/historical")
def get_telemetry(start: int = 0, end: Optional[int] | None = None) -> List[Dict[str, Any]]:
    return [{"telemetry": state}]


@app.get("/api/log/historical")
def get_logs(start: int = 0, end: Optional[int] = None) -> List[Dict[str, Any]]:
    return [
        log for log in log_entries
        if start <= log["timestamp"] <= (end if end is not None else int(time.time_ns()))
    ]



@app.post("/api/log/logs")
def add_logs(
        log_id: str = "EX9999",
        variables: Optional[Dict[str, Any]] = None,
        timestamp: Optional[int] = None,
) -> JSONResponse:
    """
    FastAPI endpoint to add a log entry via HTTP POST.
    """
    add_log(log_id=log_id, variables=variables, timestamp=timestamp)
    return JSONResponse(content={"result": "added", "log_id": log_id})


@app.post("/api/mission/process")
async def upload_mission(mission: dict):
    global mission_data, ats_mission_data, result
    mission_data = mission
    ats_mission_data = mission  # autosave here
    add_log("MP0001")
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
    add_log("MP0000")
    return ats_mission_data


# </editor-fold>

# === WebSocket for real-time telemetry and control ===
# <editor-fold  desc="Websocket">

@app.websocket("/ws/telemetry")
async def live_socket(websocket: WebSocket):
    await websocket.accept()
    add_log("UI0000", {"ip": websocket.client.host})

    send_queue: asyncio.Queue = asyncio.Queue()
    connections.add(send_queue)

    async def sender_loop():
        try:
            while True:
                msg = await send_queue.get()  # wait for anything to send
                await websocket.send_json(msg)
        except asyncio.CancelledError:
            pass

    async def telemetry_loop():
        '''
        last_log_id = -1
        try:
            while True:
                # build your telemetry payload
                new_logs = [l for l in log_entries if l["id"] > last_log_id]
                if new_logs:
                    last_log_id = new_logs[-1]["id"]
                payload = {**drone_state, "logs": new_logs}
                await send_queue.put(payload)    # enqueue for sending
                await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            pass'''
        while True:
            try:
                await asyncio.sleep(5)
            except asyncio.CancelledError:
                return

    async def command_loop():
        try:
            while True:
                msg = await websocket.receive_json()
                await process_client_command(msg)
        except (asyncio.CancelledError, WebSocketDisconnect):
            pass

    # start all three
    sender_task = asyncio.create_task(sender_loop())
    telemetry_task = asyncio.create_task(telemetry_loop())
    command_task = asyncio.create_task(command_loop())

    try:
        # wait until the command loop dies (e.g. client disconnect)
        await command_task
    finally:
        # clean up on disconnect
        for task in (sender_task, telemetry_task):
            task.cancel()
        connections.remove(send_queue)


async def send_to_client(payload: dict) -> None:
    if not connections:
        return
    #print(payload)
    # since we know there's only one:
    queue = next(iter(connections))
    await queue.put(payload)


async def process_client_command(msg: dict):

    try:
        assert "type" in msg and "message" in msg
    except AssertionError as e:
        print(repr(e))

    msg_body = msg["message"]

    print(repr(msg_body))

    match msg["type"]:

        case "command_raw":
            add_log("NW0102", {"command": msg})
            await send_cmd({"type": "command", "msg": {"command": msg_body["command"], "params": msg_body["params"]}})

        case "command":
            add_log("EX4200", {"msg": msg})

        case "log":
            add_log(msg_body["log_id"], msg_body["variables"])

        case _:
            print("unmatched command")

# </editor-fold>

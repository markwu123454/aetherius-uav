import json
from collections import defaultdict
from typing import Optional, Any, Dict, List, Callable, Awaitable

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from pathlib import Path
import hashlib
import asyncio
import atexit
import time

from process_mission import process_mission
from update_server import start_update_server
from uav_comms import UavComms


# <editor-fold desc="global variables">
telemetry_log = []
result = None  # global placeholder
mission_data = None
ats_mission_data = None
connections: set[tuple[WebSocket, asyncio.Queue]] = set()

with (Path(__file__).resolve().parent.parent/"logs_template.json").open("r", encoding="utf-8") as f:
    template = json.load(f)

log_entries = []
error_entries = []


# TODO: Remember to implement
drone_state = defaultdict(dict)

send_cmd = Callable[[dict], Awaitable[Any]]

# </editor-fold>


# <editor-fold desc="setup">
@asynccontextmanager
async def lifespan(app: FastAPI):
    global drone_state, log_entries, send_cmd
    # start the directory‐serving HTTP server in a daemon thread
    start_update_server()

    uav_comms = UavComms()

    send_cmd = uav_comms.send
    uav_comms.log_callback = add_log
    uav_comms.telem_callback = send_to_client
    drone_state = uav_comms.state
    log_entries = uav_comms.logs


    uav_client_task = asyncio.create_task(uav_comms.mainloop())
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

# === CORS for React frontend-old ===
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
        error: Optional[bool] = False,
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

    # default timestamp
    if not timestamp:
        timestamp = time.time_ns()

    if not error:
        print(f"log_id: {log_id}, variables: {variables}, timestamp: {timestamp}")


        payload = {
            "log_id": log_id,
            "timestamp": timestamp,
            "variables": variables,
        }

        # insert newest at front
        log_entries.insert(0, payload)

        if log_id == "PH2000":
            if variables["text"].startswith("PreArm: "):
                next_id = f"{max(
                    (int(entry["log_id"][2:]) for entry in log_entries if entry["log_id"].startswith("EA")),
                    default=-1
                ) + 1:04d}"
                add_log(log_id="EA"+next_id, timestamp=timestamp, variables={"text": template[log_id].format(**variables)}, error=True)

        # optional: print or broadcast here, e.g.:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(
                send_to_client({"type": "log", "data": {"timestamp": timestamp, "log_id": log_id, "variables": variables}}))
        except RuntimeError:
            pass
    else:
        # Error log path
        text = variables.get("text")
        if not text:
            raise KeyError(log_id)

        error_id = hashlib.md5(text.encode()).hexdigest()[:4]

        if log_id.startswith("EA"):
            log_id = f"EA{error_id}"
        elif log_id.startswith("ER"):
            log_id = f"ER{error_id}"
        else:
            KeyError(log_id)

        print(f"log_id: {log_id}, variables: {variables}, timestamp: {timestamp}")

        payload = {
            "log_id": log_id,
            "timestamp": timestamp,
            "variables": variables,
        }

        log_entries.insert(0, payload)

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(
                send_to_client({"type": "log", "data": payload}))
        except RuntimeError:
            pass


# === Mainloop ===
async def mainloop():

    while True:


        await asyncio.sleep(1)

# </editor-fold>

# === Basic REST Endpoints ===
# <editor-fold desc="fastapi">
@app.get("/")
def root():
    return {"message": "Aetherius GCS backend is live!"}

@app.get("/status")
def read_status():
    return {"status": "running"}

@app.get("/api/telemetry/historical")
def get_telemetry(start: int = 0, end: Optional[int] | None = None) -> List[Dict[str, Any]]:
    return [{"telemetry": drone_state}]

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
    #add_log("MP0001")
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
    #add_log("MP0000")
    return ats_mission_data

@app.post("/api/command/command_long")
async def get_command_long(
        command: str | int = None,
        params: List[Any] = None
):
    if command is None:
        pass
    add_log("NW0102", {"command": command})
    await send_cmd({"type": "command", "msg": {"command": command, "params": params}})
    send_cmd(command, params)

@app.post("/api/setting/update")
async def get_command_long(
        setting: str = None,
        value: Any = None
):
    # Load existing settings
    try:
        with open("settings.json", "r") as f:
            settings = json.load(f)
        settings[setting] = value
        with open("settings.json", "w") as f:
            json.dump(settings, f, indent=4)
        return {"status": "ok", "updated": {setting: value}}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": repr(e)})

@app.get("/api/setting/full")
async def get_setting_full():
    try:
        with open("settings.json", "r") as f:
            settings = json.load(f)
        return {"settings": settings}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": repr(e)})

@app.get("/api/command/command_int")
def get_command_int():
    pass

# </editor-fold>

# === WebSocket for real-time telemetry and control ===
# <editor-fold  desc="Websocket">

@app.websocket("/ws/telemetry")
async def live_socket(websocket: WebSocket):
    await websocket.accept()
    add_log("UI0000", {"ip": websocket.client.host})

    send_queue: asyncio.Queue = asyncio.Queue()
    connections.add((websocket, send_queue))

    async def sender_loop():
        try:
            while True:
                msg = await send_queue.get()
                await websocket.send_json(msg)
        except (asyncio.CancelledError, WebSocketDisconnect):
            print("WebSocket disconnected")

    async def telemetry_loop():
        try:
            while True:
                # replace with actual telemetry as needed
                await asyncio.sleep(5)
        except asyncio.CancelledError:
            pass

    async def command_loop():
        try:
            while True:
                msg = await websocket.receive_json()
                await process_client_command(msg)
        except (asyncio.CancelledError, WebSocketDisconnect):
            pass


    sender_task = asyncio.create_task(sender_loop())
    telemetry_task = asyncio.create_task(telemetry_loop())
    command_task = asyncio.create_task(command_loop())
    try:
        await command_task
    finally:
        for task in (sender_task, telemetry_task):
            task.cancel()
        connections.remove((websocket, send_queue))


async def send_to_client(payload: dict) -> None:
    for _, queue in connections:
        await queue.put(payload)


async def process_client_command(msg: dict):
    try:
        assert "type" in msg and "message" in msg
    except AssertionError as e:
        print(repr(e))
        return

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
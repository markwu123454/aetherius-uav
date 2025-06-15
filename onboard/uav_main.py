# uav_main.py
from pymavlink import mavutil
import argparse, asyncio, websockets, time, os

### Argument parsing ###
parser = argparse.ArgumentParser(description="UAV main loop")
parser.add_argument("--server-ip", type=str, default="127.0.0.1",
                    help="IP address of the backend server")
args = parser.parse_args()


### Pixhawk / MAVLink client ###
class PixhawkClient:
    def __init__(self, device: str, baud: int):
        self.device = device
        self.baud = baud
        self.master = None

    async def connect(self):
        print(f"[INFO] Waiting for {self.device}…", flush=True)
        while not os.path.exists(self.device):
            await asyncio.sleep(1)
        self.master = mavutil.mavlink_connection(self.device, baud=self.baud)
        print("[INFO] Waiting for first heartbeat…", flush=True)
        # block in thread so it doesn’t stall the event‐loop
        await asyncio.get_event_loop().run_in_executor(None, self.master.wait_heartbeat)
        print(f"[INFO] Connected to system {self.master.target_system}, "
              f"component {self.master.target_component}", flush=True)

    async def heartbeat_loop(self, send_func):
        """Poll MAVLink heartbeat and hand off to send_func(msg)."""
        while True:
            try:
                await asyncio.get_event_loop().run_in_executor(None, self.master.wait_heartbeat)
                msg = {
                    "type": "heartbeat",
                    "system": self.master.target_system,
                    "component": self.master.target_component,
                    "timestamp": time.time(),
                }
                await send_func(msg)
                print(f"[SENT] {msg}", flush=True)
            except Exception as e:
                print(f"[ERROR] PixhawkClient.heartbeat_loop: {e}", flush=True)
                await asyncio.sleep(1)


### WebSocket ↔ Backend client ###
class WebSocketClient:
    def __init__(self, uri: str):
        self.uri = uri
        self.ws = None

    async def connect(self):
        """Keep trying until connected, then return the socket."""
        while True:
            try:
                self.ws = await websockets.connect(self.uri)
                print(f"[INFO] WebSocket connected to {self.uri}", flush=True)
                return self.ws
            except Exception as e:
                print(f"[ERROR] WS connect failed: {e}", flush=True)
                await asyncio.sleep(5)

    async def send(self, msg: dict):
        await self.ws.send(str(msg))

    async def recv_loop(self):
        """Print incoming messages; on close, return to trigger reconnect."""
        while True:
            try:
                msg = await self.ws.recv()
                print(f"[RECV WS] {msg}", flush=True)
            except websockets.ConnectionClosed:
                print("[WARN] WS connection closed, will reconnect", flush=True)
                return
            except Exception as e:
                print(f"[ERROR] WebSocketClient.recv_loop: {e}", flush=True)
                await asyncio.sleep(1)


### Orchestration in main() ###
async def main():
    # 1) Spin up Pixhawk client
    pix = PixhawkClient(device="/dev/ttyACM0", baud=115200)
    await pix.connect()

    # 2) Spin up WS client
    uri = f"ws://{args.server_ip}:8765"
    ws_client = WebSocketClient(uri)
    await ws_client.connect()

    # 3) Loop forever: run heartbeat sender + receiver, then reconnect on drop
    while True:
        # start both loops
        sender = asyncio.create_task(pix.heartbeat_loop(ws_client.send))
        receiver = asyncio.create_task(ws_client.recv_loop())

        # wait until receiver ends (i.e. WS dropped)
        await receiver

        # clean up sender
        sender.cancel()
        try:
            await sender
        except asyncio.CancelledError:
            pass

        # try reconnecting WS
        await ws_client.connect()

if __name__ == "__main__":
    asyncio.run(main())

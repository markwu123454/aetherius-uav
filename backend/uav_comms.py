import asyncio
import json
import logging
import time
from collections import defaultdict
from pathlib import Path
import websockets


class UavComms:
    def __init__(self, host: str = "0.0.0.0", port: int = 55052):
        self.host = host
        self.port = port
        self._stop = asyncio.Event()
        self.websocket = None
        self.state = defaultdict(dict)
        self.logs = []
        self.params = None
        self.data = None
        self.log_callback = None
        self.telem_callback = None

    async def mainloop(self):
        # Load log template
        try:
            with open(Path(__file__).parent.parent / "logs_template.json", 'r') as file:
                self.data = json.load(file)
        except Exception as e:
            self._log_task("GC2200", {"e": repr(e)})

        """Outer loop that waits for connections and handles messages per client."""
        self._log_task("NW0100", {"host": self.host, "port": self.port})

        async def wait_for_connection():
            async with websockets.serve(self._accept_once, self.host, self.port, ping_interval=20, ping_timeout=20):
                await self._stop.wait()  # hold the server open

        await wait_for_connection()

    async def _accept_once(self, websocket):
        """Accept a client, then block on messages until it disconnects."""
        self.websocket = websocket
        client = websocket.remote_address
        self._log_task("NW0101", {"ip": str(client[0])})

        raw = None

        try:
            while True:
                raw = await websocket.recv()  # blocking wait
                await self._handle_message(raw)
        except websockets.exceptions.ConnectionClosed:
            self._log_task("NW1100", {"ip": str(client[0])})
        except Exception as e:
            self._log_task("NW2100", {"location": "accepting connection", "e": repr(e), "message": repr(raw)})
        finally:
            self.websocket = None

    async def _handle_message(self, raw: str):
        msg = None
        try:
            msg = json.loads(raw)
            assert isinstance(msg, dict)
            assert "type" in msg

            msg_body = None
            match msg["type"]:
                case "Log":
                    assert "log_id" in msg
                    assert "timestamp" in msg
                    assert "variables" in msg

                case _:
                    assert "msg" in msg
                    msg_body = msg["msg"]
        except Exception as e:
            self._log_task("NW2100", {"location": "handling message", "e": repr(e), "message": type(msg)})
            return

        match msg["type"]:
            case "ping":
                await self.send({
                    "type": "pong",
                    "msg": msg_body
                })

            case "pong":
                pass  # acknowledge pong, no-op

            case "Log":
                self._log_task(
                    log_id=msg.get("log_id", "XE9999"),
                    variables=msg.get("variables", {}),
                    timestamp=msg.get("timestamp")
                )

            case "telemetry":
                pkt = msg["msg"]
                pkt_type = pkt.pop("mavpackettype", None)
                if pkt_type:
                    await self.telem_callback({
                        "type": "telemetry",
                        "data": {pkt_type: pkt}
                    })

            case "changelog_batch":
                pass

            case "params":
                self.params = msg_body

            case "command_response":
                print(f"command response: {msg}")

            case "requested_telemetry":
                for full_key, value in msg_body.items():
                    if '.' in full_key:
                        category, subkey = full_key.split('.', 1)
                        if category not in self.state or not isinstance(self.state[category], dict):
                            self.state[category] = {}
                        self.state[category][subkey] = value
                    else:
                        self.state[full_key] = value

            case _:
                self._log_task("NW2102", {
                    "type": msg["type"],
                    "message": msg_body
                })

    async def send(self, msg: dict):
        """Send a message to the connected client."""
        try:
            if self.websocket:
                await self.websocket.send(json.dumps(msg))
            else:
                self._log_task("NW2105", {"message": msg})
        except Exception as e:
            self._log_task("NW2100", {"location": "sending message", "send_error": str(e), "message": repr(msg)})

    def _log_task(self, log_id="EX9999", variables=None, timestamp=None) -> None:
        """Unified logging to stdout using log template formatting."""

        if not timestamp:
            timestamp = int(time.time_ns())
        self.log_callback(timestamp=timestamp, log_id=log_id, variables=variables)
        '''
        # Format log message
        try:
            if isinstance(variables, dict):
                safe_vars = {str(k): v for k, v in variables.items()}
            else:
                safe_vars = {"value": variables}

            try:
                to_print = self.data[log_id].format(**safe_vars)
            except KeyError as e:
                print(f"{log_id} | format error: missing variable: {e} | raw: {repr(variables)}")
                return
            except Exception as e:
                print(f"{log_id} | format error: {repr(e)} | raw: {repr(variables)}")
                return

        except Exception as e:
            print(f"Log format error for {log_id}: {repr(e)} | raw: {repr(variables)}")
            return

        # Format timestamp
        formatted_time = datetime.datetime.fromtimestamp(timestamp / 1e9)
        formatted = formatted_time.strftime("%H:%M:%S.") + f"{formatted_time.microsecond // 1000:03d}"

        # Color logic from log ID
        color = ""

        bold = False
        fourth = log_id[3] if len(log_id) > 3 else ""
        if fourth == "0":
            color = "\033[90m"
        elif fourth == "1":
            color = "\033[37m"
        elif fourth == "2":
            bold = True

        third = log_id[2] if len(log_id) > 2 else ""
        if third == "2":
            color = "\033[31m"
        elif third == "1":
            color = "\033[33m"

        prefix = "\033[1m" if bold else ""
        prefix += color
        suffix = "\033[0m" if prefix else ""

        # Final print
        print(f"{formatted}: {prefix}[{log_id}] {to_print}{suffix}", flush=True)'''

    async def stop(self):
        """Signal the server to stop."""
        self._stop.set()


def run_server():
    """Configure logging and run until Ctrl+C."""
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    server = UavComms()
    try:
        asyncio.run(server.mainloop())
    except KeyboardInterrupt:
        logging.info("Server shutdown requested by user.")


if __name__ == "__main__":
    run_server()

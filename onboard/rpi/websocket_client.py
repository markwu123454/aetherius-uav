# websocket_client.py
import asyncio
import json
import traceback

import websockets
import time
from typing import Dict, Deque, Optional, Any
from collections import defaultdict, deque


class WebSocketClient:
    def __init__(self, uri: str):
        self.uri = uri
        self.ws = None
        self.state = defaultdict(dict)
        self.changelog: Deque[dict] = deque()
        self.rate = {}
        self._send_queue: Deque[dict] = deque()
        self._stop = asyncio.Event()
        self._last_rate_time: Dict[str, float] = {}
        self.changelog_overflow = 0
        self.send_command = None

    async def mainloop(self):
        while not self._stop.is_set():
            rate_task = None
            flush_changelog_task = None
            try:
                await self._connect()
                await self._flush_send_queue()

                rate_task = asyncio.create_task(self._rate_loop())
                flush_changelog_task = asyncio.create_task(self._flush_changelog_loop())

                # Inner loop: handle messages until connection breaks
                while self.ws:
                    await self._handle_messages()

            except websockets.exceptions.ConnectionClosed:
                self._log_task("NW2101", {"location": "recv loop", "e": "ConnectionClosed", "message": ""})
            except Exception as e:
                self._log_task("NW2101",
                               {"location": "mainloop", "e": repr(e), "message": repr(traceback.format_exc())})

            finally:
                if rate_task:
                    rate_task.cancel()
                if flush_changelog_task:
                    flush_changelog_task.cancel()
                self.ws = None  # force reconnect
                # short pause before reconnect, but allow immediate exit

                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=2)
                except asyncio.TimeoutError:
                    pass

    async def stop(self):
        self._stop.set()
        if self.ws:
            await self.ws.close()

    async def _connect(self):
        while True:
            try:
                self.ws = await websockets.connect(self.uri)
                return
            except Exception as e:
                self._log_task("NW2101", {"location": "connecting", "e": repr(e), "message": ""})
                await asyncio.sleep(5)

    async def _flush_send_queue(self):
        while self._send_queue:
            msg = self._send_queue.popleft()
            await self.send_msg(msg)

    async def _handle_messages(self):
        msg = None
        try:
            msg = json.loads(await self.ws.recv())
            assert isinstance(msg, dict)
            assert "type" in msg and "msg" in msg
        except Exception as e:
            self._log_task("NW2101", {"location": "parsing message", "e": repr(e), "message": repr(msg) if msg else ""})
            return

        for key, value in self.state.items():
            if isinstance(value, dict):
                if key not in self.rate or not isinstance(self.rate[key], dict):
                    self.rate[key] = {}

                for subkey in value:
                    if subkey not in {"mavpackettype", "time_boot_ms", "time_usec"}:
                        if subkey not in self.rate[key]:
                            self.rate[key][subkey] = 0.0

        msg_body = msg["msg"]
        print("[MESSAGE] " + str(msg), flush=True)

        match msg["type"]:

            case "ping":
                asyncio.create_task(self.send_msg(msg["msg"]))

            case "rate_request":
                try:
                    category = msg_body.get("category")
                    field = msg_body.get("field")
                    freq = float(msg_body.get("rate"))

                    # 1) Ensure the top‐level category dict exists
                    if category not in self.rate or not isinstance(self.rate[category], dict):
                        self.rate[category] = {}

                    # 2) See if this is a brand‐new field or an update
                    old_value = self.rate[category].get(field)
                    if field in self.rate[category]:
                        # existing field → log an update
                        self._log_task("PX0010", {
                            "category": category,
                            "field": field,
                            "old": old_value,
                            "new": freq
                        })
                    else:
                        # new field → log a creation
                        self._log_task("PX0102", {
                            "category": category,
                            "field": field,
                            "new": freq
                        })

                    # 3) Finally, set the new rate
                    self.rate[category][field] = freq

                except Exception as e:
                    self._log_task("NW2101", {"location": "handling message", "e": repr(e), "message": msg_body})

            case "telemetry_update":
                print(self.state, flush=True)
                # asyncio.create_task(self.send_msg(msg = {"type": "telemetry_update", "msg": self.state}))

            case "command":
                self.send_command(command=msg_body["command"], params=msg_body["params"])

            case _:
                self._log_task("NW2103", {
                    "type": msg["type"],
                    "message": msg["msg"]
                })

    async def send_msg(self, msg: dict) -> None:
        def sanitize(obj):
            if isinstance(obj, bytearray):
                return obj.hex()  # or decode() if it's text data
            elif isinstance(obj, dict):
                return {k: sanitize(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [sanitize(v) for v in obj]
            else:
                return obj

        if self.ws:
            try:
                assert "type" in msg, "Message must contain a 'type' field"
                #print("sending: " + repr(msg), flush=True)
                await self.ws.send(json.dumps(sanitize(msg)))
            except Exception as e:
                try:
                    await self.ws.send(json.dumps({
                        "type": "Log",
                        "log_id": "NW2101",
                        "timestamp": time.time_ns(),
                        "variables": {
                            "location": "sending message",
                            "e": repr(e),
                            "message": repr(msg)
                        }
                    }))
                except:
                    print("FATAL ERROR while logging", flush=True)  # prevent logging from causing another crash
        else:

            self._send_queue.append(msg)

    async def send_log(self,
                       log_id: str = "EX9999",
                       variables: Optional[Dict[str, Any]] = None,
                       timestamp: Optional[int] = None,
                       ) -> None:
        if timestamp is None:
            timestamp = time.time_ns()

        print(f"[LOG] {timestamp}: {log_id} [{variables}]", flush=True)

        payload = {
            "type": "Log",
            "log_id": log_id,
            "timestamp": timestamp,
            "variables": variables
        }

        if self.ws:
            asyncio.create_task(self.send_msg(payload))
        else:
            self._send_queue.append(payload)

    def _log_task(self, log_id: str, variables: dict | None = None):
        return asyncio.create_task(self.send_log(log_id=log_id, variables=variables))

    async def _rate_loop(self):
        """Periodically batch and send all requested-telemetry in one message."""
        try:
            while not self._stop.is_set():
                now = time.time()
                telemetry_batch: dict[str, Any] = {}

                # Outer: each telemetry category
                for category, field_rates in self.rate.items():
                    if not isinstance(field_rates, dict):
                        continue

                    state_msg = self.state.get(category)
                    if not isinstance(state_msg, dict):
                        state_msg = {}  # fallback to empty so we still mark missing fields

                    for field, freq in field_rates.items():
                        if not isinstance(freq, (int, float)) or freq <= 0:
                            continue

                        key = f"{category}.{field}"
                        last = self._last_rate_time.get((category, field), 0.0)
                        if now - last < 1.0 / freq:
                            continue

                        value = state_msg.get(field, None)
                        telemetry_batch[key] = value
                        self._last_rate_time[(category, field)] = now

                if telemetry_batch:
                    batch_msg = {
                        "type": "requested_telemetry",
                        "msg": telemetry_batch
                    }
                    asyncio.create_task(self.send_msg(batch_msg))

                await asyncio.sleep(0.01)

        except asyncio.CancelledError:
            raise
        except Exception as e:
            self._log_task(
                "NW2101",
                {
                    "location": "telemetry update",
                    "e": repr(e),
                    "message": repr(key) if 'key' in locals() else ""
                }
            )

    async def _flush_changelog_loop(self):
        send_interval = 0.1  # ~10 Hz

        while not self._stop.is_set():
            backlog = len(self.changelog)

            # Emergency drop if backlog is totally out of control
            if backlog > 15000:
                if self.changelog_overflow == 0:
                    self._log_task("NW1200", {"length": str(sum(len(json.dumps(entry)) for entry in self.changelog))})
                    self.changelog_overflow = 20
                # Optional: raise exception, drop oldest, or just pause sending non-critical data
            self.changelog_overflow = max(self.changelog_overflow - 1, 0)

            # Dynamically scale batch size
            if backlog > 3000:
                batch_size = min(1000, backlog)  # drain quickly
            elif backlog > 1000:
                batch_size = min(700, backlog)
            elif backlog > 350:
                batch_size = min(350, backlog)
            else:
                batch_size = 0

            if self.ws and backlog > 0:
                batch = [self.changelog.popleft() for _ in range(batch_size)]
                await self.send_msg({"type": "changelog_batch", "msg": batch})

            await asyncio.sleep(send_interval)

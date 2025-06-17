# websocket_client.py
import asyncio
import websockets
import time
from typing import Literal, Optional
from collections import defaultdict

class WebSocketClient:
    def __init__(self, uri: str):
        self.uri = uri
        self.ws = None
        self.state = defaultdict(dict)  # bind to pixhawk in main
        self.changelog = []             # bind to pixhawk in main

    async def mainloop(self):
        """Outer loop handles reconnection; inner loop handles messages."""
        while True:
            try:
                await self._connect()
                while True:
                    await self._handle_messages()
            except websockets.ConnectionClosed:
                # non-blocking log
                asyncio.create_task(self.send_log(
                    message="Connection closed, reconnecting...",
                    source="Network",
                    severity="warning",
                ))
                await asyncio.sleep(2)
            except Exception as e:
                # non-blocking log
                asyncio.create_task(self.send_log(
                    message=f"mainloop exception: {e}",
                    source="Network",
                    severity="error",
                ))
                await asyncio.sleep(2)

    async def _connect(self):
        """Attempt connection and assign websocket."""
        while True:
            try:
                self.ws = await websockets.connect(self.uri)
                # non-blocking log
                asyncio.create_task(self.send_log(
                    message=f"Connected to {self.uri}",
                    source="Network",
                    severity="info",
                ))
                return
            except Exception as e:
                # non-blocking log
                asyncio.create_task(self.send_log(
                    message=f"Connect failed: {e}",
                    source="Network",
                    severity="error",
                ))
                await asyncio.sleep(5)

    async def _handle_messages(self):
        """Handle a single incoming message."""
        msg = await self.ws.recv()
        # non-blocking log
        asyncio.create_task(self.send_log(
            message=f"RECV: {msg}",
            source="Network",
            severity="info",
        ))
        # Add routing/handling logic here

    async def send_msg(self, msg: dict) -> None:
        if self.ws:
            await self.ws.send(str(msg))

    async def send_log(
        self,
        timestamp: Optional[int] = None,
        message: str = "",
        source: Literal[
            "Pixhawk", "Telemetry", "Network", "AI", "Vision", "GCS", "Mission", "RPi"
        ] = "RPi",
        importance: Literal["minor", "major", "critical"] = "minor",
        severity: Literal["info", "warning", "error", "system", "debug"] = "info",
    ) -> None:
        """Print locally and enqueue the log send without blocking."""
        if timestamp is None:
            timestamp = time.time_ns()

        # local print (still synchronous)
        print(f"{timestamp}: [{source}] [{severity}] [{importance}] {message}", flush=True)

        entry = {
            "type": "Log",
            "timestamp": timestamp,
            "message": message,
            "source": source,
            "importance": importance,
            "severity": severity,
        }

        # schedule actual send in background, don't await
        asyncio.create_task(self.send_msg(entry))

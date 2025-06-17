import asyncio
import time
import os
from typing import *
from collections import defaultdict
from pymavlink import mavutil
import serial.tools.list_ports

message_rates = {
    mavutil.mavlink.MAV_DATA_STREAM_RAW_SENSORS: 5,  # IMU, pressure sensors – useful for graphs or analysis
    mavutil.mavlink.MAV_DATA_STREAM_EXTENDED_STATUS: 1,  # Battery, system health – slow update okay
    mavutil.mavlink.MAV_DATA_STREAM_RC_CHANNELS: 3,  # RC input/output – midrate
    mavutil.mavlink.MAV_DATA_STREAM_RAW_CONTROLLER: 3,  # Attitude control loop data – for debugging
    mavutil.mavlink.MAV_DATA_STREAM_POSITION: 2,  # GPS and global position – update a few times/sec
    mavutil.mavlink.MAV_DATA_STREAM_EXTRA1: 3,  # ATTITUDE, VFR_HUD – UI display updates
    mavutil.mavlink.MAV_DATA_STREAM_EXTRA2: 1,  # Secondary sensors – not critical
    mavutil.mavlink.MAV_DATA_STREAM_EXTRA3: 1,  # Rarely needed sensors – minimal rate
}


class PixHawkClient:
    def __init__(self, device: str, baud: int) -> None:
        self.device = device
        self.baud = baud
        self.master = None
        self.send_msg = Callable[[Dict[str, Any]], Awaitable[None]]
        self.send_log = Callable[..., Awaitable[None]]

        self.state = defaultdict(dict)
        self.changelog = []
        self._lock = asyncio.Lock()
        self._stop = asyncio.Event()

    async def _connect(self):
        # announce and wait for device file
        await self.send_log(
            source="Pixhawk",
            severity="info",
            message=f"Waiting for device {self.device}..."
        )
        while not os.path.exists(self.device):
            await self.send_log(
                source="Pixhawk",
                severity="info",
                message=f"Awaiting device {self.device}..."
            )
            await asyncio.sleep(1)

        # once found, open Mavlink connection
        await self.send_log(
            source="Pixhawk",
            severity="info",
            message="Connected to Pixhawk, waiting for first heartbeat..."
        )
        self.master = mavutil.mavlink_connection(self.device, baud=self.baud)

        await self.send_log(
            source="Pixhawk",
            severity="info",
            message="Waiting for first heartbeat..."
        )
        await asyncio.to_thread(self.master.wait_heartbeat)

        await self.send_log(
            source="Pixhawk",
            severity="info",
            message=(
                f"First heartbeat received. "
                f"System={self.master.target_system} "
                f"Component={self.master.target_component}"
            )
        )
        await self.send_log(
            source="Pixhawk",
            importance="major",
            severity="info",
            message="Pixhawk online and connected."
        )

    async def _message_loop(self):
        try:
            msg = await asyncio.to_thread(self.master.recv_match, blocking=True, timeout=1)
            if msg:
                await self._handle_message(msg)
        except Exception as e:
            await self.send_log(
                source="Pixhawk",
                importance="major",
                severity="error",
                message=f"message_loop error: {e}"
            )
            await asyncio.sleep(0.1)

    async def _handle_message(self, msg):
        now = time.time()
        mtype = msg.get_type()
        fields = msg.to_dict()

        changed = []
        async with self._lock:
            prev = self.state[mtype]
            for k, new in fields.items():
                old = prev.get(k)
                if old != new:
                    prev[k] = new
                    changed.append((k, old, new))

        for field, old, new in changed:
            self.changelog.append({
                "time": now,
                "msg": mtype,
                "field": field,
                "old": old,
                "new": new
            })
            # if you want per-field logs, uncomment:
            # await self.send_log(
            #     source="Pixhawk",
            #     importance="minor",
            #     severity="debug",
            #     message=f"{mtype}.{field} changed: {old} → {new}"
            # )

        try:
            await self.send_msg(msg.to_dict())
        except Exception as e:
            await self.send_log(
                source="Pixhawk",
                importance="major",
                severity="error",
                message=f"send_msg error: {e}"
            )

    async def _shutdown(self):
        await self.send_log(
            source="Pixhawk",
            severity="info",
            message="Shutdown initiated. Final state dump:"
        )
        for mtype, fields in self.state.items():
            await self.send_log(
                source="Pixhawk",
                severity="info",
                message=f"  {mtype}: {fields}"
            )
        await self.send_log(
            source="Pixhawk",
            severity="info",
            message="Exiting."
        )

    async def mainloop(self):
        try:
            await self._connect()

            await self.send_log(
                source="Pixhawk",
                severity="info",
                message="Starting telemetry update loop..."
            )

            # request all streams at their rates
            for stream, rate in message_rates.items():
                self.master.mav.request_data_stream_send(
                    self.master.target_system,
                    self.master.target_component,
                    stream,
                    rate,
                    1
                )

            while not self._stop.is_set():
                await self._message_loop()

        except KeyboardInterrupt:
            self._stop.set()
            await self._shutdown()


async def _send_log_temp(
        timestamp: Optional[int] = None,
        message: str = "",
        source: Literal[
            "Pixhawk", "Telemetry", "Network", "AI", "Vision", "GCS", "Mission", "RPi"
        ] = "RPi",
        importance: Literal["minor", "major", "critical"] = "minor",
        severity: Literal["info", "warning", "error", "system", "debug"] = "info") -> None:
    print(f"{timestamp}: [{source}] [{severity}] [{importance}] {message}")


async def _send_msg_temp(
        message: Dict[str, Any] = "") -> None:
    print(f"{message}")


if __name__ == '__main__':
    ports = serial.tools.list_ports.comports()
    for p in ports:
        print(p.device, p.description)

    client = PixHawkClient('COM4', 115200)
    client.send_log = _send_log_temp
    client.send_msg = _send_msg_temp
    asyncio.run(client.mainloop())

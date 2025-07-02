import asyncio
import json
import time
import datetime
import os
from pathlib import Path
from typing import Callable, Dict, Any, Sequence, Optional, Deque, Union, Literal, Coroutine, get_args
from collections import defaultdict, deque
import serial.tools.list_ports
from pymavlink import mavutil

streams = Literal["MAV_DATA_STREAM_RAW_SENSORS", "MAV_DATA_STREAM_EXTENDED_STATUS",
"MAV_DATA_STREAM_RC_CHANNELS", "MAV_DATA_STREAM_RAW_CONTROLLER",
"MAV_DATA_STREAM_POSITION", "MAV_DATA_STREAM_EXTRA1", "MAV_DATA_STREAM_EXTRA2",
"MAV_DATA_STREAM_EXTRA3"]


class PixHawkClient:
    send_log: Optional[Callable[..., Coroutine[Any, Any, None]]] = None
    send_msg: Optional[Callable[[Dict[str, Any]], asyncio.Future]] = None

    def __init__(self, device: str, baud: int) -> None:
        self.device = device
        self.baud = baud
        self.master = None
        self.send_msg: Callable[[Dict[str, Any]], asyncio.Future]
        self.send_log: Callable[..., Coroutine[Any, Any, None]]

        self.telemetry: Dict[str, Dict[str, Any]] = defaultdict(dict)
        self.state: Dict[str, Any] = defaultdict(dict)
        self.state["connected"] = False
        self.state["param_loaded"] = False

        self.changelog: Deque[dict] = deque()
        self.params: Dict[str, float] = {}
        self.dynamic_params = {}

        self.futures: dict[str, Any] = {"command_ack": {},
                                        "params": None}
        self.temps: dict[str, Any] = {"params": {"buffer": {}, "expected": None, "received_indexes": set(), "last_received": time.time()}}

        self._hb_event = asyncio.Event()
        self._last_hb_time = time.time()
        self._stop = asyncio.Event()
        self._tasks: list[asyncio.Task] = []
        # track pending ACKs with timestamp
        self._ack_pending: Dict[int, float] = {}

        self.message_rates = {}

    async def mainloop(self) -> None:
        try:
            await self._connect()

            self._tasks.append(asyncio.create_task(self._reader_loop()))

            self._tasks.append(asyncio.create_task(self._event_loop()))

            asyncio.create_task(self.fetch_param())

            asyncio.create_task(self._temp_sequence())

            await self._stop.wait()

        except asyncio.CancelledError:
            pass

        finally:
            for task in self._tasks:
                task.cancel()
            await asyncio.gather(*self._tasks, return_exceptions=True)
            await self._shutdown()

    def stop(self) -> None:
        print("stoping")
        self._stop.set()

    async def send_command(self,
                           command: Union[int, str],
                           params: Sequence[Union[float, int, str]] = (),
                           timeout: float = 3.0
                           ) -> str:
        # resolve command ID
        cmd_int = getattr(mavutil.mavlink, command, command)

        # resolve each param
        processed = []
        for p in params:
            if isinstance(p, str):
                val = getattr(mavutil.mavlink, p, None)
                if val is None:
                    try:
                        val = float(p)
                    except ValueError:
                        self._log("PX02202", {"parameter": p})
                        raise ValueError(f"Invalid parameter: {p}")
            elif isinstance(p, (int, float)):
                val = float(p)
            else:
                self._log("PX2203", {"format": type(p)})
                raise TypeError(f"Unsupported parameter type: {type(p)}")
            processed.append(val)

        p = processed[:7] + [0.0] * max(0, 7 - len(processed))

        '''# clear stale ACKs
        for _ in range(10):
            self.master.recv_match(type='COMMAND_ACK', blocking=False)'''

        # create future
        fut = asyncio.get_event_loop().create_future()
        self.futures["command_ack"][cmd_int] = fut

        # send command
        self.master.mav.command_long_send(
            self.master.target_system,
            self.master.target_component,
            cmd_int,
            0,
            *p
        )

        # track pending ack time (optional)
        self._ack_pending[cmd_int] = time.time()

        try:
            result = await asyncio.wait_for(fut, timeout)
            return result  # this is a MAV_RESULT name string
        except asyncio.TimeoutError:
            self.futures["command_ack"].pop(cmd_int, None)
            raise TimeoutError(f"COMMAND_ACK timeout for command {cmd_int}")

    def request_rate(self, stream: str, rate: int) -> None:
        sid = getattr(mavutil.mavlink, stream)
        # initialize only once per stream ID
        if sid not in self.message_rates:
            self.message_rates[sid] = 0
        # update desired rate
        self.message_rates[sid] = rate
        # send just this one request (or iterate all if you really need to)
        self.master.mav.request_data_stream_send(
            self.master.target_system,
            self.master.target_component,
            sid, rate, 1
        )

    async def fetch_param(self):
        self._log("PX0005")

        self.temps["params"] = {
            "buffer": {},
            "dynamic": {},
            "received_indexes": set(),
            "last_received": time.time(),
            "expected": None
        }

        # Send param request
        self.master.mav.param_request_list_send(
            self.master.target_system,
            self.master.target_component
        )

        try:
            while True:
                await asyncio.sleep(0.5)
                state = self.temps["params"]
                last = state["last_received"]
                expected = state["expected"]

                # Stop if nothing new arrived in 5s
                if time.time() - last > 5:
                    break

                # Optional: early exit if all expected indexes are received
                if expected is not None and len(state["received_indexes"]) >= expected:
                    break

        finally:
            self.futures.pop("params", None)

            self.params = self.temps["params"]["buffer"]
            self.dynamic_params = self.temps["params"]["dynamic"]
            self.temps.pop("params", None)

            self._log("PX0003", {"number": len(self.params)})

    async def _temp_sequence(self) -> None:
        await asyncio.sleep(6)
        while True:
            for stream in get_args(streams):
                self.request_rate(stream, 1)
            await asyncio.sleep(10)

    async def _connect(self) -> None:
        # Wait for device to appear
        interval = 1.0
        while not os.path.exists(self.device):
            await asyncio.sleep(interval)
            self._log("PX0000", {"device": self.device, "duration": str(round(interval, 2))})
            interval = min(interval * 1.1, 5.0)

        # Connect to MAVLink
        self.master = mavutil.mavlink_connection(
            self.device, baud=self.baud, autoreconnect=True, source_system=255
        )
        self._log("PX0101")
        self.state["connected"] = True

        # Wait for heartbeat
        await asyncio.to_thread(self.master.wait_heartbeat)
        self._hb_event.set()
        self._last_hb_time = time.time()
        self._log("PX0002", {"SysID": self.master.target_system, "CompID": self.master.target_component})

        self.master.mav.heartbeat_send(
            mavutil.mavlink.MAV_TYPE_ONBOARD_CONTROLLER,
            mavutil.mavlink.MAV_AUTOPILOT_INVALID,
            0, 0, 0
        )

    async def _event_loop(self) -> None:
        while not self._stop.is_set():
            # send heartbeat (fails silently if unplugged)
            self.master.mav.heartbeat_send(
                mavutil.mavlink.MAV_TYPE_ONBOARD_CONTROLLER,
                mavutil.mavlink.MAV_AUTOPILOT_INVALID,
                0, 0, 0
            )

            # wait for autopilot heartbeat
            try:
                self._hb_event.clear()
                await asyncio.wait_for(self._hb_event.wait(), timeout=2)
                self._last_hb_time = time.time()
            except asyncio.TimeoutError:
                now = time.time()
                gap = now - self._last_hb_time
                self._log("PX2200", {"missed_by_s": int(gap)})

            #  Check if serial connection is dead
            if not any(p.device == self.device for p in serial.tools.list_ports.comports()):
                print(f"{self.device} is no longer connected.")
                self.stop()
                return

            # check pending ACKs
            now = time.time()
            expired = [cmd for cmd, ts in self._ack_pending.items() if now - ts > 5]
            for cmd in expired:
                ts = self._ack_pending.pop(cmd, None)
                timeout_duration = now - ts if ts else None
                self._log("PX2201", {"command": cmd, "duration": round(timeout_duration, 2)})

    async def _reader_loop(self) -> None:
        while not self._stop.is_set():
            msg = await asyncio.to_thread(
                self.master.recv_match, blocking=True, timeout=2
            )
            #print(msg)
            if msg:
                await self._process_message(msg)

    async def _process_message(self, msg) -> None:
        mtype = msg.get_type()
        fields = msg.to_dict()

        match msg.get_type():

            case "HEARTBEAT":
                self._hb_event.set()
                self._last_hb_time = time.time()

            case "COMMAND_ACK":
                cmd = msg.command
                self._ack_pending.pop(cmd, None)

                try:
                    status = mavutil.mavlink.enums['MAV_RESULT'][msg.result].name
                except KeyError:
                    status = str(msg.result)

                self._log("PX0103", {"command": cmd, "result": status})

                fut = self.futures["command_ack"].pop(cmd, None)
                if fut and not fut.done():
                    fut.set_result(status)
                else:
                    self._log("PX0200", {"unexpected_ack": cmd, "result": status})

            case "PARAM_VALUE":
                pid = msg.param_id.strip('\x00')
                pidx = msg.param_index
                pcount = msg.param_count
                pval = msg.param_value

                state = self.temps.setdefault("params", {
                    "buffer": {},  # indexed, completeable parameters
                    "dynamic": {},  # 0xFFFF parameters
                    "received_indexes": set(),
                    "last_received": time.time(),
                    "expected": None
                })

                if pidx == 0xFFFF:
                    # Store dynamic params separately
                    state["dynamic"][pid] = pval
                    return

                state["buffer"][pid] = pval
                state["received_indexes"].add(pidx)
                state["last_received"] = time.time()

                if state["expected"] is None:
                    state["expected"] = pcount

            case "AHRS" | "ATTITUDE" | "GLOBAL_POSITION_INT" | "VFR_HUD" | "SYS_STATUS" | "POWER_STATUS" | "MEMINFO" | \
                 "MISSION_CURRENT" | "SERVO_OUTPUT_RAW" | "RC_CHANNELS" | "RAW_IMU" | "SCALED_IMU2" | "SCALED_IMU3" | \
                 "SCALED_PRESSURE" | "SCALED_PRESSURE2" | "GPS_RAW_INT" | "SYSTEM_TIME" | "WIND" | "TERRAIN_REPORT" | \
                 "EKF_STATUS_REPORT" | "VIBRATION" | "BATTERY_STATUS" | "AOA_SSA" | "MCU_STATUS" | "UNKNOWN_295" | \
                 "POSITION_TARGET_GLOBAL_INT" | "NAV_CONTROLLER_OUTPUT" | "EXTENDED_SYS_STATE":
                #print(mtype, flush=True)
                await self.send_msg({"type": "telemetry", "msg": fields})
                async with asyncio.Lock():
                    prev = self.telemetry[mtype]
                    for k, v in fields.items():
                        if prev.get(k) != v and not k in {"mavpackettype", "time_boot_ms", "time_usec"}:
                            prev[k] = v

            case "STATUSTEXT":
                self._log(f"PH{fields['severity']}000", {"text": fields["text"]})

            case "TIMESYNC":
                # Estimate Pixhawk boot time as current time minus reported onboard time
                new_boot_time = time.time() - msg.ts1 / 1e9

                # Compare new estimate with previous one (if any)
                if self.temps.get("boot_time") is not None:
                    old_boot_time = self.temps["boot_time"]
                    drift = new_boot_time - old_boot_time
                    self._log("PX0011", {"time": round(drift, 6)})

                # Update the boot_time
                self.temps["boot_time"] = new_boot_time

            case _:
                self._log("PX1100", {"message": fields, "type": mtype})

    async def _shutdown(self) -> None:
        self._log("PX0004")
        print(self.temps)
        print(self.telemetry)
        print(self.state)
        await asyncio.sleep(0.1)
        try:
            if self.master:
                self.master.close()
            self._log("PX1104")
        except Exception:
            pass

    def _log(self, log_id: str, variables: dict = None) -> None:
        asyncio.create_task(self.send_log(log_id=log_id, variables=variables))


# <editor-fold desc="utils">

async def _send_log_temp(
        timestamp: Optional[int] = None,
        log_id: str = "EX9999",
        variables: Optional[Dict[str, Any]] = None) -> None:
    if timestamp is None:
        timestamp = time.time_ns()

    with open(Path(__file__).parent.parent.parent / "logs_template.json", 'r') as file:
        data = json.load(file)

    to_print = data[log_id].format(**variables) if variables else data[log_id]
    formatted_time = datetime.datetime.fromtimestamp(timestamp / 1e9)
    formatted = formatted_time.strftime("%H:%M:%S.") + f"{formatted_time.microsecond // 10000:02d}"

    if log_id[2] == "2":
        print(f"{formatted}: \033[31m[{log_id}] {to_print}\033[0m")
    elif log_id[3] == "1":
        print(f"{formatted}: [{log_id}] {to_print}")
    else:
        print(f"{formatted}: \033[90m[{log_id}] {to_print}\033[0m")


async def _send_msg_temp(
        message: Dict[str, Any] = "") -> None:
    print(f"{message}")


async def _main():
    client = PixHawkClient('COM4', 115200)
    client.send_log = _send_log_temp
    client.send_msg = _send_msg_temp

    client_task = asyncio.create_task(client.mainloop())

    # Run mainloop as a background task
    try:
        await client_task
    except asyncio.CancelledError:
        pass


if __name__ == '__main__':
    asyncio.run(_main())

# </editor-fold>

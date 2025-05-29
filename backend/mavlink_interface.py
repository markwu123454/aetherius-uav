# mavlink_interface.py

from pymavlink import mavutil
from typing import List, Dict, Optional
import time


class MavlinkInterface:
    def __init__(self, connection_str: str, baudrate: int = 57600):
        """
        Initialize MAVLink connection.
        connection_str: e.g. 'udp:127.0.0.1:14550' or '/dev/ttyAMA0'
        """
        print(f"[MAVLINK] Connecting to {connection_str}...")
        self.master = mavutil.mavlink_connection(connection_str, baud=baudrate)
        self.master.wait_heartbeat()
        print(f"[MAVLINK] Connected to system {self.master.target_system}, component {self.master.target_component}")

    def arm(self):
        """Send arm command."""
        print("[MAVLINK] Arming...")
        self.master.mav.command_long_send(
            self.master.target_system,
            self.master.target_component,
            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
            0,
            1, 0, 0, 0, 0, 0, 0
        )

    def disarm(self):
        """Send disarm command."""
        print("[MAVLINK] Disarming...")
        self.master.mav.command_long_send(
            self.master.target_system,
            self.master.target_component,
            mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
            0,
            0, 0, 0, 0, 0, 0, 0
        )

    def set_mode(self, mode_name: str):
        """Set flight mode (e.g. 'AUTO', 'STABILIZE')."""
        print(f"[MAVLINK] Switching to mode: {mode_name}")
        mode_id = self.master.mode_mapping()[mode_name]
        self.master.set_mode(mode_id)

    def upload_mission(self, waypoints: List[Dict]):
        """
        Upload a list of waypoints to the FC.
        Each waypoint: {"lat": float, "lon": float, "alt": float}
        """
        print(f"[MAVLINK] Uploading mission with {len(waypoints)} waypoints...")

        # Step 1: Clear existing mission
        self.master.mav.mission_clear_all_send(
            self.master.target_system,
            self.master.target_component
        )
        time.sleep(1)

        # Step 2: Send mission count
        self.master.mav.mission_count_send(
            self.master.target_system,
            self.master.target_component,
            len(waypoints)
        )

        # Step 3: Send each waypoint
        for i, wp in enumerate(waypoints):
            self.master.mav.mission_item_send(
                self.master.target_system,
                self.master.target_component,
                i,
                mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT,
                mavutil.mavlink.MAV_CMD_NAV_WAYPOINT,
                0, 1,        # current=0, autocontinue=1
                0, 0, 0, 0,  # params 1–4 not used here
                wp["lat"],
                wp["lon"],
                wp["alt"]
            )
            time.sleep(0.1)

        print("[MAVLINK] Mission upload complete.")

    def set_mission_start(self, index: int):
        """Set mission current index (to begin from a specific waypoint)."""
        self.master.mav.mission_set_current_send(
            self.master.target_system,
            self.master.target_component,
            index
        )

    def get_message(self, msg_type: str = '', blocking: bool = True, timeout: float = 1.0):
        """Receive MAVLink message of a specific type (or any if blank)."""
        return self.master.recv_match(type=msg_type, blocking=blocking, timeout=timeout)

    def send_manual_control(self, x: int, y: int, z: int, r: int, buttons: int = 0):
        """
        Manual control via joystick (RC override-style).
        Inputs: x, y, z, r = pitch, roll, throttle, yaw in range -1000 to 1000
        """
        self.master.mav.manual_control_send(
            self.master.target_system,
            x, y, z, r, buttons
        )

    # === SKELETONS / TO-DO ===

    def download_mission(self) -> List[Dict]:
        """TO-DO: Fetch mission from FC."""
        # Step 1: Request mission count
        # Step 2: Fetch each MISSION_ITEM
        # Step 3: Rebuild as lat/lon/alt list
        pass

    def stream_telemetry(self):
        """TO-DO: Run continuous loop to receive telemetry and forward to frontend."""
        # Could use GLOBAL_POSITION_INT, SYS_STATUS, ATTITUDE
        pass

    def monitor_heartbeat(self):
        """TO-DO: Detect FC heartbeat loss and trigger failsafe or alert."""
        pass

    def send_position_target(self, lat: float, lon: float, alt: float):
        """TO-DO: Stream guided setpoint (for dynamic tracking)."""
        pass

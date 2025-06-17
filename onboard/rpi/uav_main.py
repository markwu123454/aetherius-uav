# main.py
import argparse
import asyncio

from pixhawk_client import PixHawkClient
from websocket_client import WebSocketClient

async def main():

    # Retrieve gcs ip
    parser = argparse.ArgumentParser(description="UAV main loop")
    parser.add_argument(
        "--server-ip",
        type=str,
        default="127.0.0.1",
        help="IP address of the backend server"
        )
    ip = parser.parse_args().server_ip


    ##### Init #####

    ws_client = WebSocketClient(f"ws://{ip}:8765")
    pix_client = PixHawkClient(device="/dev/ttyACM0", baud=115200)

    pix_client.send_log = ws_client.send_log
    pix_client.send_msg = ws_client.send_msg

    ws_client.state = pix_client.state
    ws_client.changelog = pix_client.changelog


    ##### Loop #####

    await ws_client.mainloop()
    await pix_client.mainloop()



if __name__ == "__main__":
    asyncio.run(main())

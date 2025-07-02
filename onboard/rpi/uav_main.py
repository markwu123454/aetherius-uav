import argparse
import asyncio
import signal
import logging
import sys

from pixhawk_client import PixHawkClient
from websocket_client import WebSocketClient

# Simple UAV main loop: only needs server IP

def parse_args() -> str:
    parser = argparse.ArgumentParser(description="UAV main loop")
    parser.add_argument(
        "--server-ip",
        type=str,
        default="127.0.0.1",
        help="IP address of the backend WebSocket server"
    )
    return parser.parse_args().server_ip


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )


async def main() -> None:
    server_ip = parse_args()
    setup_logging()

    ws_url = f"ws://{server_ip}:55052"
    logging.info(f"Connecting to WebSocket at {ws_url}")

    ws_client = WebSocketClient(ws_url)
    pix_client = PixHawkClient(device=("/dev/ttyACM0" if server_ip != "127.0.0.1" else "COM4"),
                                baud=115200)

    # Wire messaging callbacks
    pix_client.send_log = ws_client.send_log
    pix_client.send_msg = ws_client.send_msg
    ws_client.state = pix_client.telemetry
    ws_client.changelog = pix_client.changelog
    ws_client.send_command = pix_client.send_command

    # Graceful shutdown setup
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def on_shutdown() -> None:
        logging.info("Shutdown signal received, stopping tasks...")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, on_shutdown)

    # Start mainloop tasks
    ws_task = asyncio.create_task(ws_client.mainloop())
    pix_task = asyncio.create_task(pix_client.mainloop())

    # Wait for shutdown
    await stop_event.wait()

    # Cancel and await
    pix_task.cancel()
    await asyncio.sleep(1)
    ws_task.cancel()

    await asyncio.gather(ws_task, pix_task, return_exceptions=True)

    logging.info("UAV main loop terminated")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception:
        logging.exception("Unexpected error in main loop")
        sys.exit(1)

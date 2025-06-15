# uav_connection.py
import asyncio
import websockets

async def handler(ws):
    """Handle one WebSocket client."""
    client = ws.remote_address
    print(f"[INFO] Client connected: {client}")
    try:
        async for message in ws:
            print(f"[RECV] {message}")
            resp = f"Echo: {message}"
            await ws.send(resp)
            print(f"[SENT] {resp}")
    except websockets.exceptions.ConnectionClosedOK:
        print(f"[INFO] Client {client} disconnected cleanly")
    except Exception as e:
        print(f"[ERROR] in handler: {e}")

async def main():
    server = await websockets.serve(handler, "0.0.0.0", 8765)
    print("[INFO] WebSocket server listening on ws://0.0.0.0:8765")
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())

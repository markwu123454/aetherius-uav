from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio

app = FastAPI()

# Allow CORS from frontend (Vite runs on port 5173 by default)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Basic REST endpoint to verify server status
@app.get("/status")
def read_status():
    return {"status": "running"}

# Root endpoint
@app.get("/")
def root():
    return {"message": "Aetherius GCS backend is live!"}

# WebSocket for telemetry (real-time data stream)
@app.websocket("/ws/telemetry")
async def telemetry(websocket: WebSocket):
    await websocket.accept()
    while True:
        await websocket.send_json({
            "gps": {"lat": 37.7749, "lon": -122.4194},
            "battery": "11.8V"
        })
        await asyncio.sleep(1)  # Simulate 1Hz telemetry

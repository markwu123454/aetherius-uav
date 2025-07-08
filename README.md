# Aetherius GCS

Aetherius GCS is a modular ground control station for fixed-wing UAVs, designed for real-time mission planning, telemetry monitoring, and system diagnostics. It features a modern React-based frontend and a Python FastAPI backend, with MAVLink integration for communication with ArduPilot-based flight controllers.

## Features

- **Mission Planning**: Waypoint editor with Dubins path support, geofence validation, and mission preview.
- **Telemetry Monitoring**: Live aircraft data via MAVLink, including GPS, battery, and attitude.
- **Driver Station**: Arm/disarm controls, flight mode switcher, and system status.
- **Log Viewer**: Stream and display real-time and historical logs with filtering and deduplication.
- **Persistent State**: Auto-caches unsaved missions and settings via `localStorage`.

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS  
  - Cesium for map rendering  
  - React Context for telemetry and API state  
- **Backend**: FastAPI (Python 3.11+), Websocket, HTTPServer 
  - Serves log endpoints, mission persistence, and telemetry websocket  
  - Interfaces with MAVLink stream via pyMAVLink  

## Folder Structure (WIP)

```plaintext
aetherius-uav/
├── frontend/             # React-based UI
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── ui/
│   │   ├── lib/
├── backend/              # FastAPI + MAVLink bridge
│   ├── main.py
├── onboard/              # Raspberry Pi side program
│   ├── rpi/
```

## Running the Project

### Prerequisites

- Node.js (v18+)
- Python 3.11+
- MAVProxy or pyMAVLink dependencies

### Dev Setup

**Frontend:**

```bash
cd frontend-old
npm install
npm run dev
```

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 55050 --reload
```

**Combined:**

```bash
python3 run_gcs.py
```

## TODO

- [x] Comms with Pi
- [x] Comms with PixHawk
- [x] Comms with backend
- [x] Send&receive message from Pixhawk
- [x] UI - Driver Station
- [ ] UI - Dashboard
- [ ] UI - Telemetry
- [ ] UI - Mission planning
- [ ] UI - Mission control
- [x] UI - Logs
- [ ] UI - Settings
- [ ] Lidar
- [ ] Mission execution
- [ ] Cesium 3d map
- [ ] Live camera
- [ ] Lidar 3d map


Big problems i've had to solve so far:
- Tailwind not loading
- Page not loading
- Pi not connecting to wifi
- Pi not ssh-ing
- Rechart not working
- Cesium not working
- Pixhawk not calibrating
- Pi crashing after a while
- Websocket not reconnecting
- Mavlink dying
- Mavlink freezing
- Tailwind not working
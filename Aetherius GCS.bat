@echo off
echo [Aetherius UAV Dev] Starting backend and frontend...

:: Start backend
start "Backend" cmd /k "cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Optional: wait before starting frontend
timeout /t 2 >nul

:: Start frontend
start "Frontend" cmd /k "cd frontend && npm run dev -- --host"

echo Done.
exit

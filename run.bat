@echo off
echo ================================================
echo VisionLab - Local Computer Vision Platform
echo ================================================
echo.

REM Check if Redis is running in WSL2
echo [1/4] Starting Redis (WSL2)...
wsl sudo service redis-server status >nul 2>&1
if errorlevel 1 (
    wsl sudo service redis-server start
    echo Redis started successfully.
) else (
    echo Redis is already running.
)
echo.

REM Start Celery Worker
echo [2/4] Starting Celery Worker...
start "VisionLab Celery Worker" cmd /k "celery -A backend.celery_app worker --loglevel=info -P solo"
timeout /t 2 /nobreak >nul
echo.

REM Start FastAPI Backend
echo [3/4] Starting FastAPI Backend...
start "VisionLab Backend" cmd /k "uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul
echo.

REM Start Next.js Frontend
echo [4/4] Starting Next.js Frontend...
start "VisionLab Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 2 /nobreak >nul
echo.

echo ================================================
echo All services starting...
echo.
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Press Ctrl+C in each window to stop services
echo ================================================
pause

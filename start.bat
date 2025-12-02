@echo off
echo Starting VisionLab Platform...

:: Start Redis in WSL
echo Starting Redis in WSL...
wsl sudo service redis-server start

:: Start Celery Worker
echo Starting Celery Worker...
start "VisionLab Worker" cmd /k "celery -A backend.celery_app worker --loglevel=info --pool=solo"

:: Start Backend API
echo Starting FastAPI Backend...
start "VisionLab API" cmd /k "uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000"

:: Start Frontend
echo Starting Next.js Frontend...
cd frontend
start "VisionLab Frontend" cmd /k "npm run dev"
cd ..

echo All services launched!
echo Frontend: http://localhost:3000
echo Backend: http://localhost:8000/docs
pause

#!/bin/bash

echo "================================================"
echo "VisionLab - Local Computer Vision Platform"
echo "================================================"
echo ""

# Start Redis
echo "[1/4] Starting Redis..."
if ! pgrep -x redis-server > /dev/null; then
    sudo service redis-server start
    echo "Redis started successfully."
else
    echo "Redis is already running."
fi
echo ""

# Start Celery Worker
echo "[2/4] Starting Celery Worker..."
celery -A backend.celery_app worker --loglevel=info &
CELERY_PID=$!
echo "Celery Worker (PID: $CELERY_PID)"
echo ""

# Start FastAPI Backend
echo "[3/4] Starting FastAPI Backend..."
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend (PID: $BACKEND_PID)"
echo ""

# Start Next.js Frontend
echo "[4/4] Starting Next.js Frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..
echo "Frontend (PID: $FRONTEND_PID)"
echo ""

echo "================================================"
echo "All services started!"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"
echo "================================================"

# Cleanup on exit
trap "kill $CELERY_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait

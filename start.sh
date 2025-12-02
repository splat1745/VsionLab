#!/bin/bash

echo "Starting VisionLab Platform..."

# Start Redis
if command -v redis-server &> /dev/null; then
    echo "Starting Redis..."
    sudo service redis-server start
else
    echo "Redis not found. Skipping..."
fi

# Start Celery Worker
echo "Starting Celery Worker..."
celery -A backend.celery_app worker --loglevel=info &
CELERY_PID=$!

# Start Backend API
echo "Starting FastAPI Backend..."
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000 &
API_PID=$!

# Start Frontend
echo "Starting Next.js Frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "All services launched!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:8000/docs"

# Handle shutdown
trap "kill $CELERY_PID $API_PID $FRONTEND_PID; exit" SIGINT SIGTERM

wait

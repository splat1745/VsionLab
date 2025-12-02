# VisionLab - Local Computer Vision Platform

A locally-hosted, all-in-one computer vision platform replicating Roboflow's core functionalities with distributed training support, multi-user authentication, and modern UI/UX.

## ⚡ Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- Redis (via WSL2 on Windows or native on Linux)
- CUDA-capable GPU (optional, for training)

### Installation

1. **Install Dependencies**
   ```bash
   python setup.py
   cd frontend
   npm install
   ```

2. **Initialize Shadcn UI** (First time only)
   ```bash
   cd frontend
   npx -y shadcn@latest init --defaults
   npx -y shadcn@latest add button input card label select progress tabs dropdown-menu badge alert
   ```

3. **Create Utils File** (Required - gitignored)
   ```bash
   # Create frontend/lib directory
   mkdir frontend/lib
   
   # Create frontend/lib/utils.ts with:
   ```
   ```typescript
   import { clsx, type ClassValue } from "clsx"
   import { twMerge } from "tailwind-merge"

   export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs))
   }
   ```

### Running the Application

#### Windows
```batch
run.bat
```

#### Linux / WSL
```bash
chmod +x run.sh
./run.sh
```

#### Manual Start (All Platforms)
```bash
# Terminal 1: Redis (WSL2 on Windows)
wsl sudo service redis-server start

# Terminal 2: Celery Worker
celery -A backend.celery_app worker --loglevel=info -P solo

# Terminal 3: Backend
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 4: Frontend
cd frontend
npm run dev
```

## 🌐 Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 📁 Backend Structure

```
backend/
├── app.py              # Main FastAPI application
├── auth.py             # JWT authentication & API keys
├── nodes.py            # Training node registry
├── registry.py         # Model versioning
├── tasks.py            # Distributed Celery tasks
├── training.py         # Training pipeline
├── database.py         # SQLAlchemy models
├── config.py           # Settings
└── celery_app.py       # Celery configuration
```

## 💻 Frontend Structure

```
frontend/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── login/page.tsx              # Login
│   ├── register/page.tsx           # Registration
│   ├── universe/page.tsx           # Model Registry
│   └── projects/[id]/
│       ├── page.tsx                # Project Overview
│       ├── train/page.tsx          # Training
│       └── deploy/page.tsx         # Deployment
├── components/
│   ├── auth-provider.tsx           # Auth context
│   ├── sidebar.tsx                 # Navigation
│   ├── theme-provider.tsx          # Dark mode
│   └── ui/                         # Shadcn components (10 files)
└── lib/
    └── utils.ts                    # CN utility (create manually)
```

## 🔑 Features

### ✅ Implemented
- **Multi-User Authentication**: JWT tokens with bcrypt hashing
- **Distributed Training**: Remote GPU node dispatch with retries
- **Model Registry**: Version tracking with metrics (mAP, precision, recall)
- **Node Management**: GPU resource monitoring (VRAM, load, active jobs)
- **Export**: ONNX, TensorRT, TFLite, TorchScript
- **Modern UI**: Dark mode, conflict alerts, live progress
- **Automation**: Setup, startup, and verification scripts

### ⏳ Pending
- Annotation interface (Label Studio integration)
- DVC dataset versioning workflow
- WebSocket live training logs
- Database concurrency control (row locking)

## 🚀 Usage

### Register & Login
1. Navigate to http://localhost:3000
2. Click "Register" to create an account
3. Login with your credentials

### Create a Project
1. Click "New Project" on the Dashboard
2. Enter project name and select type (Object Detection / Classification / Segmentation)
3. Add classes for your dataset

### Train a Model
1. Open your project
2. Navigate to the "Train" tab
3. Select a training node (local or remote)
4. Configure training parameters (epochs, batch size, architecture)
5. Click "Start Training"

### Deploy & Export
1. Navigate to "Universe" to browse trained models
2. Select a model and click "Download"
3. Choose export format (ONNX, TensorRT, etc.)
4. Use API snippets for inference

## 📊 API Endpoints

### Authentication
- `POST /token` - Login
- `GET /users/me/` - Current user

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/{id}` - Get project
- `GET /api/projects/{id}/stats` - Project statistics

### Training Nodes
- `GET /api/nodes/` - List nodes
- `POST /api/nodes/register` - Register node
- `POST /api/nodes/{id}/heartbeat` - Update node status
- `POST /api/nodes/agent/train` - Dispatch training

### Model Registry
- `GET /api/registry/` - List models
- `GET /api/registry/{id}` - Get model
- `POST /api/registry/{id}/promote` - Promote model

## 🔧 Configuration

### Environment Variables
Create a `.env` file (or edit `backend/config.py`):
```env
DATABASE_URL=sqlite:///./visionlab.db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key-here
NODE_API_KEY=your-node-api-key
```

### Remote Node Setup
1. Install dependencies on remote machine
2. Register node:
   ```bash
   curl -X POST http://main-server:8000/api/nodes/register \
     -H "X-API-Key: your-node-api-key" \
     -H "Content-Type: application/json" \
     -d '{"name":"remote-gpu-1","ip_address":"192.168.1.100","has_gpu":true,"gpu_name":"RTX 3090","vram_total":24.0}'
   ```
3. Start node agent:
   ```bash
   uvicorn backend.app:app --host 0.0.0.0 --port 8000
   ```

## 🐛 Troubleshooting

### Frontend Build Errors
- **Module not found '@/components/ui/xxx'**: Run `npx shadcn@latest add xxx`
- **Module not found '@/lib/utils'**: Create `frontend/lib/utils.ts` (see Installation step 3)

### Backend Errors
- **Redis connection failed**: Check if Redis is running (`wsl sudo service redis-server status`)
- **IndentationError in app.py**: File corruption during editing - restore from backup or re-clone

### Training Issues
- **No GPU detected**: Ensure CUDA is installed and `nvidia-smi` works
- **DVC errors**: Initialize with `dvc init` in project root

## 📝 License
MIT

## 🙏 Credits
Built with FastAPI, Next.js, Celery, DVC, and Shadcn UI

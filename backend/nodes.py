from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.database import Base, get_db
from backend import auth

router = APIRouter(prefix="/api/nodes", tags=["nodes"])

# --- Database Model ---
class TrainingNode(Base):
    __tablename__ = "training_nodes"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    ip_address = Column(String)
    port = Column(Integer, default=8000)
    is_active = Column(Boolean, default=True)
    last_seen = Column(DateTime, default=datetime.utcnow)
    
    # Capabilities
    has_gpu = Column(Boolean, default=False)
    gpu_name = Column(String, nullable=True)
    vram_total = Column(Float, default=0.0) # GB
    vram_used = Column(Float, default=0.0) # GB
    
    # Status
    current_load = Column(Float, default=0.0) # 0-100%
    active_jobs = Column(Integer, default=0)

# --- Pydantic Schemas ---
class NodeRegister(BaseModel):
    name: str
    ip_address: str
    port: int = 8000
    has_gpu: bool = False
    gpu_name: str | None = None
    vram_total: float = 0.0

class NodeStatus(BaseModel):
    vram_used: float
    current_load: float
    active_jobs: int

class NodeResponse(NodeRegister):
    id: int
    is_active: bool
    last_seen: datetime
    vram_used: float
    current_load: float
    active_jobs: int
    
    class Config:
        from_attributes = True

# --- Endpoints ---

@router.post("/register", response_model=NodeResponse)
async def register_node(
    node: NodeRegister, 
    db: AsyncSession = Depends(get_db),
    authorized: bool = Depends(auth.verify_api_key)
):
    """Register a new training node (or update existing)"""
    result = await db.execute(select(TrainingNode).where(TrainingNode.name == node.name))
    db_node = result.scalar_one_or_none()
    
    if db_node:
        # Update existing
        db_node.ip_address = node.ip_address
        db_node.port = node.port
        db_node.has_gpu = node.has_gpu
        db_node.gpu_name = node.gpu_name
        db_node.vram_total = node.vram_total
        db_node.last_seen = datetime.utcnow()
        db_node.is_active = True
    else:
        # Create new
        db_node = TrainingNode(
            name=node.name,
            ip_address=node.ip_address,
            port=node.port,
            has_gpu=node.has_gpu,
            gpu_name=node.gpu_name,
            vram_total=node.vram_total,
            last_seen=datetime.utcnow()
        )
        db.add(db_node)
    
    await db.commit()
    await db.refresh(db_node)
    return db_node

@router.post("/{node_id}/heartbeat")
async def node_heartbeat(
    node_id: int, 
    status: NodeStatus,
    db: AsyncSession = Depends(get_db),
    authorized: bool = Depends(auth.verify_api_key)
):
    """Update node status (heartbeat)"""
    result = await db.execute(select(TrainingNode).where(TrainingNode.id == node_id))
    db_node = result.scalar_one_or_none()
    
    if not db_node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    db_node.last_seen = datetime.utcnow()
    db_node.is_active = True
    db_node.vram_used = status.vram_used
    db_node.current_load = status.current_load
    db_node.active_jobs = status.active_jobs
    
    await db.commit()
    return {"status": "ok"}

@router.get("/", response_model=List[NodeResponse])
async def list_nodes(
    db: AsyncSession = Depends(get_db),
    current_user: auth.User = Depends(auth.get_current_active_user)
):
    """List all registered nodes"""
    # Check for stale nodes (inactive > 5 mins)
    # This logic could be moved to a background task
    cutoff = datetime.utcnow() - datetime.timedelta(minutes=5)
    
    result = await db.execute(select(TrainingNode))
    nodes = result.scalars().all()
    
    return nodes

# --- Agent Endpoints (For Remote Execution) ---

class TrainRequest(BaseModel):
    model_id: int
    data_yaml_path: str
    model_architecture: str
    epochs: int
    batch_size: int
    img_size: int
    learning_rate: float
    device: str

@router.post("/agent/train")
async def agent_train(
    request: TrainRequest,
    background_tasks: BackgroundTasks,
    authorized: bool = Depends(auth.verify_api_key)
):
    """(Agent) Start training on this node"""
    # Import here to avoid circular deps
    from backend.tasks import train_model_task
    
    # Dispatch to local Celery worker
    task = train_model_task.delay(
        model_id=request.model_id,
        data_yaml_path=request.data_yaml_path,
        model_architecture=request.model_architecture,
        epochs=request.epochs,
        batch_size=request.batch_size,
        img_size=request.img_size,
        learning_rate=request.learning_rate,
        device=request.device
    )
    
    return {"status": "queued", "job_id": str(task.id)}

@router.get("/agent/status")
async def agent_status(authorized: bool = Depends(auth.verify_api_key)):
    """(Agent) Get current node status"""
    # TODO: Implement real GPU check
    return {
        "status": "active",
        "gpu_load": 0.0,
        "vram_used": 0.0
    }

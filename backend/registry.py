from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend.database import get_db, Model, Project
from backend import auth
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api/registry", tags=["registry"])

# --- Schemas ---
class ModelVersionResponse(BaseModel):
    id: int
    project_id: int
    name: str
    version: int
    architecture: str
    status: str
    metrics: dict
    created_at: datetime
    path: str | None
    
    class Config:
        from_attributes = True

# --- Endpoints ---

@router.get("/", response_model=List[ModelVersionResponse])
async def list_models(
    project_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: auth.User = Depends(auth.get_current_active_user)
):
    """List all models in the registry, optionally filtered by project"""
    query = select(Model).order_by(Model.created_at.desc())
    
    if project_id:
        query = query.where(Model.project_id == project_id)
        
    result = await db.execute(query)
    models = result.scalars().all()
    return models

@router.get("/{model_id}", response_model=ModelVersionResponse)
async def get_model(
    model_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: auth.User = Depends(auth.get_current_active_user)
):
    """Get specific model details"""
    result = await db.execute(select(Model).where(Model.id == model_id))
    model = result.scalar_one_or_none()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
        
    return model

@router.post("/{model_id}/promote")
async def promote_model(
    model_id: int,
    stage: str, # e.g., "production", "staging"
    db: AsyncSession = Depends(get_db),
    current_user: auth.User = Depends(auth.get_current_active_user)
):
    """Promote a model to a specific stage (Deployment)"""
    # This would typically involve tagging the model or moving files
    # For now, we'll just update a tag in metadata (if we had a tag field)
    # or just return success as a placeholder for deployment logic
    
    return {"status": "promoted", "stage": stage, "model_id": model_id}

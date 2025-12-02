import asyncio
from backend.celery_app import celery_app
from backend.training import TrainingPipeline
from backend.config import get_settings

settings = get_settings()
import asyncio
from backend.celery_app import celery_app
from backend.training import TrainingPipeline
from backend.config import get_settings

settings = get_settings()
training_pipeline = TrainingPipeline(
    settings.models_dir, 
    settings.datasets_dir,
    use_wsl2=settings.use_wsl2
)

@celery_app.task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def train_model_task(self, model_id: int, data_yaml_path: str, model_architecture: str, epochs: int, batch_size: int, img_size: int, learning_rate: float, device: str, node_url: str = None):
    """
    Celery task to train a model.
    Wraps the async training pipeline.
    """
    from backend.database import SessionLocal, Model
    from sqlalchemy import select
    
    loop = asyncio.get_event_loop()
    
    async def run_training():
        # If node_url is provided, dispatch remotely
        if node_url:
            import httpx
            from backend.config import get_settings
            settings = get_settings()
            
            headers = {"X-API-Key": settings.node_api_key}
            payload = {
                "model_id": model_id,
                "data_yaml_path": data_yaml_path,
                "model_architecture": model_architecture,
                "epochs": epochs,
                "batch_size": batch_size,
                "img_size": img_size,
                "learning_rate": learning_rate,
                "device": device
            }
            
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.post(f"{node_url}/api/nodes/agent/train", json=payload, headers=headers)
                    response.raise_for_status()
                    return response.json()
                except Exception as e:
                    # If remote call fails, retry (handled by Celery)
                    raise e
        
        # Local Execution
        # Define a callback to update task state and database
        async def progress_callback(status):
            # Update Celery task state
            self.update_state(state='TRAINING', meta=status)
            
            # Update Database
            async with SessionLocal() as session:
                result = await session.execute(select(Model).where(Model.id == model_id))
                m = result.scalar_one_or_none()
                if m:
                    m.metrics = status.get('metrics', {})
                    # Also update status if completed/failed
                    if status.get('status') in ['completed', 'failed']:
                        m.status = status.get('status')
                    elif status.get('status') == 'training':
                        m.status = 'training'
                await session.commit()
        
        if model_architecture == 'rf-detr':
            await training_pipeline.train_rfdetr(
                model_id=model_id,
                data_yaml=data_yaml_path,
                epochs=epochs,
                batch_size=batch_size,
                img_size=img_size,
                learning_rate=learning_rate,
                device=device,
                callback=progress_callback
            )
        else:
             await training_pipeline.train_yolo(
                model_id=model_id,
                data_yaml=data_yaml_path,
                epochs=epochs,
                batch_size=batch_size,
                img_size=img_size,
                device=device,
                callback=progress_callback
            )
        
        return {"status": "completed", "model_id": model_id}

    try:
        result = loop.run_until_complete(run_training())
        return result
    except Exception as e:
        # Update DB on failure
        async def mark_failed():
             async with SessionLocal() as session:
                result = await session.execute(select(Model).where(Model.id == model_id))
                m = result.scalar_one_or_none()
                if m:
                    m.status = 'failed'
                await session.commit()
        loop.run_until_complete(mark_failed())
        # Re-raise to mark task as failed
        raise e

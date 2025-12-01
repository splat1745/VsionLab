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

@celery_app.task(bind=True)
def train_model_task(self, model_id: int, data_yaml_path: str, model_architecture: str, epochs: int, batch_size: int, img_size: int, learning_rate: float, device: str):
    """
    Celery task to train a model.
    Wraps the async training pipeline.
    """
    from backend.database import SessionLocal, Model
    from sqlalchemy import select
    
    async def run_training():
        # Define a callback to update task state and database
        async def progress_callback(status):
            # Update Celery task state
            self.update_state(state='TRAINING', meta=status)
            
            # Update Database
            # Note: We create a new session for each update to ensure thread safety
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
        
        if "rf-detr" in model_architecture:
            return await training_pipeline.train_rfdetr(
                model_id, data_yaml_path, model_architecture,
                epochs, batch_size, img_size, learning_rate,
                device, callback=progress_callback
            )
        else:
            return await training_pipeline.train_yolo(
                model_id, data_yaml_path, model_architecture,
                epochs, batch_size, img_size, learning_rate,
                device, callback=progress_callback
            )

    # Run async code in sync task
    loop = asyncio.get_event_loop()
    if loop.is_closed():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    try:
        result = loop.run_until_complete(run_training())
        return result
    except Exception as e:
        # Re-raise to mark task as failed
        raise e

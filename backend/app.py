"""
VisionLab - Main FastAPI Application
"""

import os
import uuid
import shutil
import asyncio
from typing import List, Dict, Optional
from pathlib import Path

import aiofiles
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, delete

from backend.config import get_settings
from backend.database import get_db, init_db, Project, Dataset, Image, Annotation, ProjectClass, Model, get_database_engine, create_tables, get_session_maker
from backend.training import TrainingPipeline
from backend.inference import InferencePipeline
from backend.augmentation import DataAugmentor
from backend.dataset_export import DatasetExporter
from backend import auth, nodes, registry

settings = get_settings()

app = FastAPI(title="VisionLab API", version="1.0.0")

# Include Routers
app.include_router(nodes.router)
app.include_router(registry.router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize pipelines
image_processor = DataAugmentor()
training_pipeline = TrainingPipeline(
    settings.models_dir, 
    settings.datasets_dir,
    use_wsl2=settings.use_wsl2
)
inference_pipeline = InferencePipeline(cache_dir=settings.cache_dir)
dataset_exporter = DatasetExporter(settings.exports_dir)

# WebSocket connections for real-time updates
active_connections: Dict[str, List[WebSocket]] = {}

async def get_db() -> AsyncSession:
    """Dependency for database session"""
    async with SessionLocal() as session:
        yield session


@app.on_event("startup")
async def startup():
    """Initialize database and directories on startup"""
    global engine, SessionLocal
    
    settings.setup_directories()
    engine = await get_database_engine(settings.database_url)
    await create_tables(engine)
    SessionLocal = get_session_maker(engine)
    
    print(f"VisionLab started on http://{settings.host}:{settings.port}")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    if engine:
        await engine.dispose()


# ============== Static Files ==============
app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/")
async def root():
    """Serve main application"""
    return FileResponse("frontend/index.html")


# ============== Projects ==============
@app.get("/api/projects", response_model=List[ProjectResponse])
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    """Get project by ID"""
    result = await db.execute(
        select(Project).options(selectinload(Project.classes)).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    """Delete project and all associated data"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete project directory
    project_dir = settings.datasets_dir / str(project_id)
    if project_dir.exists():
        shutil.rmtree(project_dir)
    
    await db.delete(project)
    await db.commit()
    return {"status": "deleted"}


@app.get("/api/projects/{project_id}/stats", response_model=ProjectStats)
async def get_project_stats(project_id: int, db: AsyncSession = Depends(get_db)):
    """Get project statistics"""
    # Get total images
    result = await db.execute(
        select(func.count(Image.id))
        .join(Dataset)
        .where(Dataset.project_id == project_id)
    )
    total_images = result.scalar() or 0
    
    # Get annotated images
    result = await db.execute(
        select(func.count(Image.id))
        .join(Dataset)
        .where(Dataset.project_id == project_id, Image.is_annotated == True)
    )
    annotated_images = result.scalar() or 0
    
    # Get total annotations
    result = await db.execute(
        select(func.count(Annotation.id))
        .join(Image)
        .join(Dataset)
        .where(Dataset.project_id == project_id)
    )
    total_annotations = result.scalar() or 0
    
    # Get class distribution
    result = await db.execute(
        select(ProjectClass.name, func.count(Annotation.id))
        .join(Annotation, Annotation.class_id == ProjectClass.id)
        .where(ProjectClass.project_id == project_id)
        .group_by(ProjectClass.name)
    )
    class_distribution = dict(result.all())
    
    # Get split distribution
    result = await db.execute(
        select(Dataset.split, func.count(Image.id))
        .join(Image)
        .where(Dataset.project_id == project_id)
        .group_by(Dataset.split)
    )
    split_distribution = dict(result.all())
    
    return ProjectStats(
        total_images=total_images,
        annotated_images=annotated_images,
        total_annotations=total_annotations,
        class_distribution=class_distribution,
        split_distribution=split_distribution
    )


# ============== Classes ==============
@app.post("/api/projects/{project_id}/classes", response_model=ProjectClassResponse)
async def add_class(project_id: int, cls: ProjectClassCreate, db: AsyncSession = Depends(get_db)):
    """Add a class to project"""
    db_class = ProjectClass(
        project_id=project_id,
        name=cls.name,
        color=cls.color
    )
    db.add(db_class)
    await db.commit()
    await db.refresh(db_class)
    return db_class


@app.delete("/api/classes/{class_id}")
async def delete_class(class_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a class"""
    result = await db.execute(select(ProjectClass).where(ProjectClass.id == class_id))
    cls = result.scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    
    await db.delete(cls)
    await db.commit()
    return {"status": "deleted"}


# ============== Datasets ==============
@app.get("/api/projects/{project_id}/datasets", response_model=List[DatasetResponse])
async def list_datasets(project_id: int, db: AsyncSession = Depends(get_db)):
    """List datasets for a project"""
    result = await db.execute(
        select(Dataset).where(Dataset.project_id == project_id)
    )
    datasets = result.scalars().all()
    
    # Add image counts
    response = []
    for ds in datasets:
        result = await db.execute(
            select(func.count(Image.id)).where(Image.dataset_id == ds.id)
        )
        image_count = result.scalar() or 0
        
        result = await db.execute(
            select(func.count(Image.id)).where(
                Image.dataset_id == ds.id,
                Image.is_annotated == True
            )
        )
        annotated_count = result.scalar() or 0
        
        response.append(DatasetResponse(
            id=ds.id,
            project_id=ds.project_id,
            name=ds.name,
            split=ds.split,
            created_at=ds.created_at,
            image_count=image_count,
            annotated_count=annotated_count
        ))
    
    return response


@app.post("/api/datasets", response_model=DatasetResponse)
async def create_dataset(dataset: DatasetCreate, db: AsyncSession = Depends(get_db)):
    """Create a new dataset"""
    db_dataset = Dataset(
        project_id=dataset.project_id,
        name=dataset.name,
        split=dataset.split
    )
    db.add(db_dataset)
    await db.commit()
    await db.refresh(db_dataset)
    
    # Create dataset directory
    dataset_dir = settings.datasets_dir / str(dataset.project_id) / str(db_dataset.id)
    dataset_dir.mkdir(parents=True, exist_ok=True)
    
    return DatasetResponse(
        id=db_dataset.id,
        project_id=db_dataset.project_id,
        name=db_dataset.name,
        split=db_dataset.split,
        created_at=db_dataset.created_at,
        image_count=0,
        annotated_count=0
    )


# ============== Images ==============
@app.get("/api/projects/{project_id}/images", response_model=List[ImageResponse])
async def list_project_images(
    project_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all images in a project across all datasets"""
    result = await db.execute(
        select(Image)
        .join(Dataset)
        .where(Dataset.project_id == project_id)
    )
    return result.scalars().all()


@app.get("/api/datasets/{dataset_id}/images", response_model=List[ImageResponse])
async def list_images(
    dataset_id: int,
    skip: int = 0,
    limit: int = 100,
    annotated_only: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """List images in a dataset"""
    query = select(Image).where(Image.dataset_id == dataset_id)
    if annotated_only:
        query = query.where(Image.is_annotated == True)
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


@app.post("/api/datasets/{dataset_id}/upload")
        # Generate unique filename
        ext = Path(file.filename).suffix
        unique_name = f"{uuid.uuid4()}{ext}"
        file_path = dataset_dir / unique_name
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # Get dimensions
        try:
            width, height = image_processor.get_image_dimensions(str(file_path))
        except:
            width, height = 0, 0
        
        # Save to database
        db_image = Image(
            dataset_id=dataset_id,
            filename=unique_name,
            filepath=str(file_path),
            width=width,
            height=height
        )
        db.add(db_image)
        await db.flush()
        
        uploaded.append({
            'id': db_image.id,
            'filename': unique_name,
            'original_name': file.filename,
            'width': width,
            'height': height
        })
    
    await db.commit()
    return {"uploaded": len(uploaded), "images": uploaded}


@app.get("/api/images/{image_id}")
async def get_image(image_id: int, db: AsyncSession = Depends(get_db)):
    """Get image details with annotations"""
    result = await db.execute(
        select(Image).options(selectinload(Image.annotations)).where(Image.id == image_id)
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Get class info for annotations
    annotations = []
    for ann in image.annotations:
        result = await db.execute(
            select(ProjectClass).where(ProjectClass.id == ann.class_id)
        )
        cls = result.scalar_one_or_none()
        annotations.append(AnnotationResponse(
            id=ann.id,
            image_id=ann.image_id,
            class_id=ann.class_id,
            annotation_type=ann.annotation_type,
            data=ann.data,
            created_at=ann.created_at,
            class_name=cls.name if cls else None,
            class_color=cls.color if cls else None
        ))
    
    return {
        "id": image.id,
        "dataset_id": image.dataset_id,
        "filename": image.filename,
        "filepath": image.filepath,
        "width": image.width,
        "height": image.height,
        "is_annotated": image.is_annotated,
        "created_at": image.created_at,
        "annotations": annotations
    }


@app.get("/api/images/{image_id}/file")
async def get_image_file(image_id: int, db: AsyncSession = Depends(get_db)):
    """Serve image file"""
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(image.filepath)


@app.get("/api/images/{image_id}/thumbnail")
async def get_image_thumbnail(image_id: int, db: AsyncSession = Depends(get_db)):
    """Get image thumbnail"""
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    thumbnail = image_processor.create_thumbnail(image.filepath)
    return StreamingResponse(
        iter([thumbnail]),
        media_type="image/jpeg"
    )


@app.delete("/api/images/{image_id}")
async def delete_image(image_id: int, db: AsyncSession = Depends(get_db)):
    """Delete an image"""
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Delete file
    if os.path.exists(image.filepath):
        os.remove(image.filepath)
    
    await db.delete(image)
    await db.commit()
    return {"status": "deleted"}


# ============== Annotations ==============
@app.post("/api/annotations", response_model=AnnotationResponse)
async def create_annotation(annotation: AnnotationCreate, db: AsyncSession = Depends(get_db)):
    """Create a single annotation"""
    db_annotation = Annotation(
        image_id=annotation.image_id,
        class_id=annotation.class_id,
        annotation_type=annotation.annotation_type,
        data=annotation.data
    )
    db.add(db_annotation)
    
    # Mark image as annotated
    result = await db.execute(select(Image).where(Image.id == annotation.image_id))
    image = result.scalar_one_or_none()
    if image:
        image.is_annotated = True
    
    await db.commit()
    await db.refresh(db_annotation)
    
    result = await db.execute(
        select(ProjectClass).where(ProjectClass.id == annotation.class_id)
    )
    cls = result.scalar_one_or_none()
    
    return AnnotationResponse(
        id=db_annotation.id,
        image_id=db_annotation.image_id,
        class_id=db_annotation.class_id,
        annotation_type=db_annotation.annotation_type,
        data=db_annotation.data,
        created_at=db_annotation.created_at,
        class_name=cls.name if cls else None,
        class_color=cls.color if cls else None
    )


@app.post("/api/annotations/bulk")
async def save_annotations_bulk(data: AnnotationBulkSave, db: AsyncSession = Depends(get_db)):
    """Save all annotations for an image (replaces existing)"""
    # Delete existing annotations
    await db.execute(
        delete(Annotation).where(Annotation.image_id == data.image_id)
    )
    
    # Add new annotations
    for ann in data.annotations:
        db_annotation = Annotation(
            image_id=data.image_id,
            class_id=ann.class_id,
            annotation_type=ann.annotation_type,
            data=ann.data
        )
        db.add(db_annotation)
    
    # Update image annotated status
    result = await db.execute(select(Image).where(Image.id == data.image_id))
    image = result.scalar_one_or_none()
    if image:
        image.is_annotated = len(data.annotations) > 0
    
    await db.commit()
    return {"status": "saved", "count": len(data.annotations)}


@app.delete("/api/annotations/{annotation_id}")
async def delete_annotation(annotation_id: int, db: AsyncSession = Depends(get_db)):
    """Delete an annotation"""
    result = await db.execute(select(Annotation).where(Annotation.id == annotation_id))
    annotation = result.scalar_one_or_none()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")
    
    image_id = annotation.image_id
    await db.delete(annotation)
    
    # Check if image still has annotations
    result = await db.execute(
        select(func.count(Annotation.id)).where(Annotation.image_id == image_id)
    )
    count = result.scalar() or 0
    
    if count == 0:
        result = await db.execute(select(Image).where(Image.id == image_id))
        image = result.scalar_one_or_none()
        if image:
            image.is_annotated = False
    
    await db.commit()
    return {"status": "deleted"}


# ============== Models ==============
@app.get("/api/projects/{project_id}/models", response_model=List[ModelResponse])
async def list_models(project_id: int, db: AsyncSession = Depends(get_db)):
    """List models for a project"""
    result = await db.execute(
        select(Model).where(Model.project_id == project_id).order_by(Model.created_at.desc())
    )
    return result.scalars().all()


@app.post("/api/models", response_model=ModelResponse)
async def create_model(model: ModelCreate, db: AsyncSession = Depends(get_db)):
    """Create a new model"""
    db_model = Model(
        project_id=model.project_id,
        name=model.name,
        architecture=model.architecture,
        epochs=model.epochs,
        batch_size=model.batch_size
    )
    db.add(db_model)
    await db.commit()
    await db.refresh(db_model)
    return db_model


@app.get("/api/models/{model_id}", response_model=ModelResponse)
async def get_model(model_id: int, db: AsyncSession = Depends(get_db)):
    """Get model details"""
    result = await db.execute(select(Model).where(Model.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


# ============== Training ==============
@app.post("/api/projects/{project_id}/split")
async def split_dataset(
    project_id: int,
    train_split: int = 70,
    valid_split: int = 20,
    test_split: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """Rebalance dataset split"""
    import random
    
    if train_split + valid_split + test_split != 100:
        raise HTTPException(status_code=400, detail="Splits must sum to 100")
    
    # Get or create datasets for each split
    splits = {'train': train_split, 'valid': valid_split, 'test': test_split}
    split_datasets = {}
    
    for split_name in splits.keys():
        result = await db.execute(
            select(Dataset).where(
                Dataset.project_id == project_id,
                Dataset.split == split_name
            )
        )
        dataset = result.scalar_one_or_none()
        
        if not dataset:
            dataset = Dataset(
                project_id=project_id,
                name=split_name,
                split=split_name
            )
            db.add(dataset)
            await db.flush()
            
            # Create directory
            dataset_dir = settings.datasets_dir / str(project_id) / str(dataset.id)
            dataset_dir.mkdir(parents=True, exist_ok=True)
            
        split_datasets[split_name] = dataset
    
    # Get all images in project
    result = await db.execute(
        select(Image).join(Dataset).where(Dataset.project_id == project_id)
    )
    images = result.scalars().all()
    
    # Shuffle images
    random.shuffle(images)
    
    # Calculate counts
    total = len(images)
    n_train = int(total * (train_split / 100))
    n_valid = int(total * (valid_split / 100))
    # Remaining go to test to ensure sum is total
    
    # Assign images
    train_imgs = images[:n_train]
    valid_imgs = images[n_train:n_train + n_valid]
    test_imgs = images[n_train + n_valid:]
    
    # Helper to move image files
    async def move_images(imgs, target_dataset):
        target_dir = settings.datasets_dir / str(project_id) / str(target_dataset.id)
        for img in imgs:
            if img.dataset_id != target_dataset.id:
                # Move file
                old_path = Path(img.filepath)
                new_path = target_dir / img.filename
                
                if old_path.exists():
                    # If moving across drives or filesystems, shutil.move is safer
                    shutil.move(str(old_path), str(new_path))
                    img.filepath = str(new_path)
                    img.dataset_id = target_dataset.id
    
    await move_images(train_imgs, split_datasets['train'])
    await move_images(valid_imgs, split_datasets['valid'])
    await move_images(test_imgs, split_datasets['test'])
    
    await db.commit()
    
    return {"status": "success", "counts": {
        "train": len(train_imgs),
        "valid": len(valid_imgs),
        "test": len(test_imgs)
    }}


@app.post("/api/projects/{project_id}/distribute")
async def distribute_images(
    project_id: int,
    request: DistributeImagesRequest,
    db: AsyncSession = Depends(get_db)
):
    """Distribute specific images to dataset splits"""
    import random
    
    if request.train_split + request.valid_split + request.test_split != 100:
        raise HTTPException(status_code=400, detail="Splits must sum to 100")
    
    # Get or create datasets for each split
    splits = {'train': request.train_split, 'valid': request.valid_split, 'test': request.test_split}
    split_datasets = {}
    
    for split_name in splits.keys():
        result = await db.execute(
            select(Dataset).where(
                Dataset.project_id == project_id,
                Dataset.split == split_name
            )
        )
        dataset = result.scalar_one_or_none()
        
        if not dataset:
            dataset = Dataset(
                project_id=project_id,
                name=split_name,
                split=split_name
            )
            db.add(dataset)
            await db.flush()
            
            # Create directory
            dataset_dir = settings.datasets_dir / str(project_id) / str(dataset.id)
            dataset_dir.mkdir(parents=True, exist_ok=True)
            
        split_datasets[split_name] = dataset
    
    # Get requested images
    result = await db.execute(
        select(Image).where(Image.id.in_(request.image_ids))
    )
    images = result.scalars().all()
    
    if not images:
        return {"status": "success", "counts": {"train": 0, "valid": 0, "test": 0}}
    
    # Shuffle images
    random.shuffle(images)
    
    # Calculate counts
    total = len(images)
    n_train = int(total * (request.train_split / 100))
    n_valid = int(total * (request.valid_split / 100))
    # Remaining go to test
    
    # Assign images
    train_imgs = images[:n_train]
    valid_imgs = images[n_train:n_train + n_valid]
    test_imgs = images[n_train + n_valid:]
    
    # Helper to move image files
    async def move_images(imgs, target_dataset):
        target_dir = settings.datasets_dir / str(project_id) / str(target_dataset.id)
        for img in imgs:
            if img.dataset_id != target_dataset.id:
                # Move file
                old_path = Path(img.filepath)
                new_path = target_dir / img.filename
                
                if old_path.exists():
                    shutil.move(str(old_path), str(new_path))
                    img.filepath = str(new_path)
                    img.dataset_id = target_dataset.id
    
    await move_images(train_imgs, split_datasets['train'])
    await move_images(valid_imgs, split_datasets['valid'])
    await move_images(test_imgs, split_datasets['test'])
    
    await db.commit()
    
    return {"status": "success", "counts": {
        "train": len(train_imgs),
        "valid": len(valid_imgs),
        "test": len(test_imgs)
    }}


@app.post("/api/training/start")
async def start_training(config: TrainingConfig, db: AsyncSession = Depends(get_db)):
    """Start model training"""
    # Get model
    result = await db.execute(select(Model).where(Model.id == config.model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Get project
    result = await db.execute(select(Project).where(Project.id == model.project_id))
    project = result.scalar_one_or_none()
    
    # Export dataset first
    result = await db.execute(
        select(Dataset).where(Dataset.project_id == model.project_id)
    )
    datasets = result.scalars().all()
    
    # Get all images and annotations
    images_data = []
    annotations_data = []
    
    for ds in datasets:
        result = await db.execute(
            select(Image).options(selectinload(Image.annotations)).where(Image.dataset_id == ds.id)
        )
        for img in result.scalars().all():
            img_dict = {
                'id': img.id,
                'filename': img.filename,
                'filepath': img.filepath,
                'width': img.width,
                'height': img.height,
                'split': ds.split
            }
            images_data.append(img_dict)
            for ann in img.annotations:
                annotations_data.append({
                    'id': ann.id,
                    'image_id': ann.image_id,
                    'class_id': ann.class_id,
                    'annotation_type': ann.annotation_type,
                    'data': ann.data
                })
    
    # Get classes
    result = await db.execute(
        select(ProjectClass).where(ProjectClass.project_id == model.project_id)
    )
    classes = [{'id': c.id, 'name': c.name} for c in result.scalars().all()]
    
    # Export to YOLO format
    export_path, stats = dataset_exporter.export_yolo(
        project.name,
        images_data,
        annotations_data,
        classes
    )
    
    data_yaml_path = os.path.join(export_path, 'data.yaml')
    
    # Update model status
    model.status = 'queued'
    await db.commit()
    
    # Start training via Celery
    from backend.tasks import train_model_task
    
    # Determine device
    device = config.device if hasattr(config, 'device') else 'auto'
    
    # Dispatch task
    task = train_model_task.delay(
        model_id=config.model_id,
        data_yaml_path=data_yaml_path,
        model_architecture=model.architecture,
        epochs=config.epochs,
        batch_size=config.batch_size,
        img_size=config.img_size,
        learning_rate=config.learning_rate,
        device=device
    )
    
    return {"status": "queued", "model_id": config.model_id, "job_id": str(task.id)}


@app.get("/api/training/{model_id}/status", response_model=TrainingStatus)
async def get_training_status(model_id: int, db: AsyncSession = Depends(get_db)):
    """Get training status"""
    status = training_pipeline.get_training_status(model_id)
    if not status:
        result = await db.execute(select(Model).where(Model.id == model_id))
        model = result.scalar_one_or_none()
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
        
        return TrainingStatus(
            model_id=model_id,
            status=model.status,
            current_epoch=0,
            total_epochs=model.epochs,
            metrics=model.metrics or {}
        )
    
    return TrainingStatus(
        model_id=model_id,
        status=status.get('status', 'unknown'),
        current_epoch=status.get('current_epoch', 0),
        total_epochs=status.get('total_epochs', 0),
        train_loss=status.get('train_loss'),
        val_loss=status.get('val_loss'),
        metrics=status.get('metrics', {})
    )


@app.post("/api/training/{model_id}/stop")
async def stop_training(model_id: int, db: AsyncSession = Depends(get_db)):
    """Stop training"""
    success = await training_pipeline.stop_training(model_id)
    
    if success:
        result = await db.execute(select(Model).where(Model.id == model_id))
        model = result.scalar_one_or_none()
        if model:
            model.status = 'cancelled'
            await db.commit()
    
    return {"status": "stopped" if success else "not_found"}


# ============== Inference ==============
@app.post("/api/inference/predict")
async def run_inference(
    model_id: int = Form(...),
    confidence: float = Form(0.25),
    iou_threshold: float = Form(0.45),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Run inference on uploaded image"""
    # Get model
    result = await db.execute(select(Model).where(Model.id == model_id))
    model = result.scalar_one_or_none()
    if not model or not model.weights_path:
        raise HTTPException(status_code=404, detail="Model or weights not found")
    
    # Save uploaded file temporarily
    temp_path = settings.cache_dir / f"temp_{uuid.uuid4()}{Path(file.filename).suffix}"
    async with aiofiles.open(temp_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    try:
        # Run inference
        result = inference_pipeline.predict(
            model.weights_path,
            str(temp_path),
            confidence=confidence,
            iou_threshold=iou_threshold
        )
        return result
    finally:
        # Cleanup temp file
        if temp_path.exists():
            temp_path.unlink()


@app.post("/api/inference/predict-image/{image_id}")
async def run_inference_on_image(
    image_id: int,
    request: InferenceRequest,
    db: AsyncSession = Depends(get_db)
):
    """Run inference on existing image"""
    # Get image
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Get model
    result = await db.execute(select(Model).where(Model.id == request.model_id))
    model = result.scalar_one_or_none()
    if not model or not model.weights_path:
        raise HTTPException(status_code=404, detail="Model or weights not found")
    
    # Run inference
    result = inference_pipeline.predict(
        model.weights_path,
        image.filepath,
        confidence=request.confidence_threshold,
        iou_threshold=request.iou_threshold
    )
    return result


# ============== Export ==============
@app.post("/api/export", response_model=ExportResponse)
async def export_dataset(request: ExportRequest, db: AsyncSession = Depends(get_db)):
    """Export dataset to specified format"""
    # Get project
    result = await db.execute(select(Project).where(Project.id == request.project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all data
    result = await db.execute(
        select(Dataset).where(Dataset.project_id == request.project_id)
    )
    datasets = result.scalars().all()
    
    images_data = []
    annotations_data = []
    
    for ds in datasets:
        result = await db.execute(
            select(Image).options(selectinload(Image.annotations)).where(Image.dataset_id == ds.id)
        )
        for img in result.scalars().all():
            images_data.append({
                'id': img.id,
                'filename': img.filename,
                'filepath': img.filepath,
                'width': img.width,
                'height': img.height,
                'split': ds.split
            })
            for ann in img.annotations:
                annotations_data.append({
                    'id': ann.id,
                    'image_id': ann.image_id,
                    'class_id': ann.class_id,
                    'annotation_type': ann.annotation_type,
                    'data': ann.data
                })
    
    result = await db.execute(
        select(ProjectClass).where(ProjectClass.project_id == request.project_id)
    )
    classes = [{'id': c.id, 'name': c.name} for c in result.scalars().all()]
    
    # Export based on format
    if request.format == 'yolo':
        export_path, stats = dataset_exporter.export_yolo(
            project.name, images_data, annotations_data, classes
        )
    elif request.format == 'coco':
        export_path, stats = dataset_exporter.export_coco(
            project.name, images_data, annotations_data, classes
        )
    elif request.format == 'voc':
        export_path, stats = dataset_exporter.export_voc(
            project.name, images_data, annotations_data, classes
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid export format")
    
    return ExportResponse(
        success=True,
        export_path=export_path,
        format=request.format,
        num_images=stats['total_images'],
        num_annotations=stats['total_annotations']
    )


# ============== Augmentation ==============
@app.post("/api/augmentation/preview")
async def preview_augmentation(
    image_id: int = Form(...),
    config: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Preview augmentation on an image"""
    import json
    
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    aug_config = json.loads(config)
    augmentor = DataAugmentor(aug_config)
    
    # Load image
    img = image_processor.load_image_rgb(image.filepath)
    
    # Get annotations
    result = await db.execute(
        select(Annotation).where(Annotation.image_id == image_id)
    )
    annotations = result.scalars().all()
    
    bboxes = []
    class_labels = []
    for ann in annotations:
        if ann.annotation_type == 'bbox':
            data = ann.data
            bboxes.append([data['x'], data['y'], 
                          data['x'] + data['width'], 
                          data['y'] + data['height']])
            class_labels.append(ann.class_id)
    
    # Apply augmentation
    aug_img, aug_bboxes, aug_labels = augmentor.augment(img, bboxes, class_labels)
    
    # Convert to base64 for preview
    import cv2
    import base64
    
    # Draw bboxes
    for bbox, label in zip(aug_bboxes, aug_labels):
        x1, y1, x2, y2 = map(int, bbox)
        cv2.rectangle(aug_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
    
    # Encode
    _, buffer = cv2.imencode('.jpg', cv2.cvtColor(aug_img, cv2.COLOR_RGB2BGR))
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    
    return {"image": f"data:image/jpeg;base64,{img_base64}"}


# ============== WebSocket for Real-time Updates ==============
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket connection for real-time updates"""
    await websocket.accept()
    
    if client_id not in active_connections:
        active_connections[client_id] = []
    active_connections[client_id].append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
    except WebSocketDisconnect:
        active_connections[client_id].remove(websocket)
        if not active_connections[client_id]:
            del active_connections[client_id]


async def broadcast_to_client(client_id: str, message: dict):
    """Send message to specific client"""
    if client_id in active_connections:
        for connection in active_connections[client_id]:
            await connection.send_json(message)


# ============== Health Check ==============
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }


# ============== System Info ==============
@app.get("/api/system/gpus")
async def get_available_gpus():
    """Get list of available GPUs"""
    gpus = []
    
    try:
        import torch
        if torch.cuda.is_available():
            for i in range(torch.cuda.device_count()):
                gpus.append({
                    "id": i,
                    "name": torch.cuda.get_device_name(i),
                    "memory": torch.cuda.get_device_properties(i).total_memory // (1024**3)  # GB
                })
    except ImportError:
        pass
    
    # Try nvidia-smi as fallback
    if not gpus:
        try:
            import subprocess
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=index,name,memory.total", "--format=csv,noheader,nounits"],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line:
                        parts = line.split(', ')
                        if len(parts) >= 3:
                            gpus.append({
                                "id": int(parts[0]),
                                "name": parts[1].strip(),
                                "memory": int(parts[2]) // 1024  # Convert MB to GB
                            })
        except Exception:
            pass
    
    return gpus


@app.get("/api/settings")
async def get_settings_endpoint():
    """Get current settings"""
    return {
        "data_dir": str(settings.data_dir),
        "models_dir": str(settings.models_dir),
        "exports_dir": str(settings.exports_dir),
        "datasets_dir": str(settings.datasets_dir),
        "use_wsl2": settings.use_wsl2,
        "max_workers": settings.max_workers
    }


@app.post("/api/settings")
async def update_settings_endpoint(new_settings: dict):
    """Update settings (storage paths)"""
    # Note: This updates the .env file or runtime settings
    # In production, you'd want to validate paths and handle restarts
    
    env_path = Path(".env")
    env_content = ""
    
    if env_path.exists():
        env_content = env_path.read_text()
    
    # Update or add settings
    for key, value in new_settings.items():
        key_upper = key.upper()
        
        # Remove existing line if present
        lines = [l for l in env_content.split('\n') if not l.startswith(f"{key_upper}=")]
        lines.append(f"{key_upper}={value}")
        env_content = '\n'.join(lines)
    
    env_path.write_text(env_content)
    
    # Create directories if they don't exist
    try:
        for key in ['data_dir', 'models_dir', 'exports_dir']:
            if key in new_settings:
                path = Path(new_settings[key])
                # Check if path is valid (e.g. drive exists)
                if not path.exists():
                    path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create directory: {str(e)}")
    
    return {"status": "updated"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)

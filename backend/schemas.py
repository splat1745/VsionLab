"""
Pydantic Schemas for API
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# Project Schemas
class ProjectClassBase(BaseModel):
    name: str
    color: str = "#FF0000"


class ProjectClassCreate(ProjectClassBase):
    pass


class ProjectClassResponse(ProjectClassBase):
    id: int
    project_id: int
    
    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    name: str
    description: str = ""
    project_type: str = "object_detection"


class ProjectCreate(ProjectBase):
    classes: List[ProjectClassCreate] = []


class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    classes: List[ProjectClassResponse] = []
    
    class Config:
        from_attributes = True


# Dataset Schemas
class DatasetBase(BaseModel):
    name: str
    split: str = "train"


class DatasetCreate(DatasetBase):
    project_id: int


class DatasetResponse(DatasetBase):
    id: int
    project_id: int
    created_at: datetime
    image_count: int = 0
    annotated_count: int = 0
    
    class Config:
        from_attributes = True


# Image Schemas
class ImageBase(BaseModel):
    filename: str
    filepath: str


class ImageCreate(ImageBase):
    dataset_id: int
    width: int = 0
    height: int = 0


class ImageResponse(ImageBase):
    id: int
    dataset_id: int
    width: int
    height: int
    is_annotated: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Annotation Schemas
class AnnotationBase(BaseModel):
    class_id: int
    annotation_type: str = "bbox"
    data: Dict[str, Any]  # {x, y, width, height} for bbox, {points: [...]} for polygon


class AnnotationCreate(AnnotationBase):
    image_id: int


class AnnotationResponse(AnnotationBase):
    id: int
    image_id: int
    created_at: datetime
    class_name: Optional[str] = None
    class_color: Optional[str] = None
    
    class Config:
        from_attributes = True


class AnnotationBulkSave(BaseModel):
    image_id: int
    annotations: List[AnnotationBase]


# Model Schemas
class ModelBase(BaseModel):
    name: str
    architecture: str = "yolov8n"
    epochs: int = 100
    batch_size: int = 16


class ModelCreate(ModelBase):
    project_id: int


class ModelResponse(ModelBase):
    id: int
    project_id: int
    weights_path: Optional[str]
    metrics: Dict[str, Any] = {}
    status: str
    created_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Training Schemas
class TrainingConfig(BaseModel):
    model_id: int
    epochs: int = 100
    batch_size: int = 16
    img_size: int = 640
    learning_rate: float = 0.01
    use_wsl2: bool = False
    augmentation: bool = True
    device: str = "auto"  # auto, cpu, 0, 1, 0,1 etc.


class TrainingLogResponse(BaseModel):
    id: int
    model_id: int
    epoch: int
    train_loss: Optional[float]
    val_loss: Optional[float]
    metrics: Dict[str, Any] = {}
    created_at: datetime
    
    class Config:
        from_attributes = True


class TrainingStatus(BaseModel):
    model_id: int
    status: str
    current_epoch: int = 0
    total_epochs: int = 0
    train_loss: Optional[float] = None
    val_loss: Optional[float] = None
    metrics: Dict[str, Any] = {}
    eta: Optional[str] = None


# Inference Schemas
class InferenceRequest(BaseModel):
    model_id: int
    confidence_threshold: float = 0.25
    iou_threshold: float = 0.45


class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2] normalized or absolute
    

class InferenceResponse(BaseModel):
    image_path: str
    detections: List[Detection]
    inference_time: float
    image_width: int
    image_height: int


# Export Schemas
class ExportRequest(BaseModel):
    project_id: int
    format: str = "yolo"  # yolo, coco, voc
    include_augmented: bool = False


class ExportResponse(BaseModel):
    success: bool
    export_path: str
    format: str
    num_images: int
    num_annotations: int


# Augmentation Schemas
class AugmentationConfig(BaseModel):
    flip_horizontal: bool = True
    flip_vertical: bool = False
    rotate_90: bool = True
    brightness: float = 0.2
    contrast: float = 0.2
    saturation: float = 0.2
    hue: float = 0.1
    blur: float = 0.0
    noise: float = 0.0
    crop: float = 0.0
    mosaic: bool = False
    num_augmented: int = 3


# Stats
class ProjectStats(BaseModel):
    total_images: int
    annotated_images: int
    total_annotations: int
    class_distribution: Dict[str, int]
    split_distribution: Dict[str, int]


class DistributeImagesRequest(BaseModel):
    image_ids: List[int]
    train_split: int = 70
    valid_split: int = 20
    test_split: int = 10


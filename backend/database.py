"""
Database Models and Connection
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker as async_sessionmaker

Base = declarative_base()


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    project_type = Column(String(50), default="object_detection")  # object_detection, classification, segmentation
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    datasets = relationship("Dataset", back_populates="project", cascade="all, delete-orphan")
    models = relationship("Model", back_populates="project", cascade="all, delete-orphan")
    classes = relationship("ProjectClass", back_populates="project", cascade="all, delete-orphan")


class ProjectClass(Base):
    __tablename__ = "project_classes"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    color = Column(String(7), default="#FF0000")  # Hex color
    
    project = relationship("Project", back_populates="classes")


class Dataset(Base):
    __tablename__ = "datasets"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    split = Column(String(20), default="train")  # train, valid, test
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="datasets")
    images = relationship("Image", back_populates="dataset", cascade="all, delete-orphan")


class Image(Base):
    __tablename__ = "images"
    
    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(512), nullable=False)
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    is_annotated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="images")
    annotations = relationship("Annotation", back_populates="image", cascade="all, delete-orphan")


class Annotation(Base):
    __tablename__ = "annotations"
    
    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("images.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("project_classes.id"), nullable=False)
    annotation_type = Column(String(50), default="bbox")  # bbox, polygon, segmentation
    data = Column(JSON, nullable=False)  # Stores coordinates based on type
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    image = relationship("Image", back_populates="annotations")
    project_class = relationship("ProjectClass")


class Model(Base):
    __tablename__ = "models"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    architecture = Column(String(100), default="yolov8n")
    weights_path = Column(String(512), nullable=True)
    metrics = Column(JSON, default={})  # mAP, precision, recall, etc.
    status = Column(String(50), default="created")  # created, training, completed, failed
    epochs = Column(Integer, default=100)
    batch_size = Column(Integer, default=16)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="models")
    training_logs = relationship("TrainingLog", back_populates="model", cascade="all, delete-orphan")


class TrainingLog(Base):
    __tablename__ = "training_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False)
    epoch = Column(Integer, nullable=False)
    train_loss = Column(Float, nullable=True)
    val_loss = Column(Float, nullable=True)
    metrics = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    model = relationship("Model", back_populates="training_logs")


class InferenceResult(Base):
    __tablename__ = "inference_results"
    
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False)
    image_path = Column(String(512), nullable=False)
    predictions = Column(JSON, default=[])
    inference_time = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# Database session management
async def get_database_engine(database_url: str):
    """Create async database engine"""
    engine = create_async_engine(database_url, echo=False)
    return engine


async def create_tables(engine):
    """Create all tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def get_session_maker(engine):
    """Get async session maker"""
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# Global session maker (initialized in app startup)
AsyncSessionLocal = None


async def get_db() -> AsyncSession:
    """Dependency for database session"""
    if AsyncSessionLocal is None:
        raise RuntimeError("Database session maker not initialized")
    
    async with AsyncSessionLocal() as session:
        yield session


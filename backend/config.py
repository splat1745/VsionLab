"""
VisionLab - Local Computer Vision Platform
Configuration Module
"""

import os
import subprocess
import sys
from pathlib import Path
from typing import Optional
from functools import lru_cache

# Ensure pydantic-settings is installed for pydantic v2
try:
    from pydantic_settings import BaseSettings
except ImportError:
    # Auto-install pydantic-settings
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pydantic-settings", "-q"])
    from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    app_name: str = "VisionLab"
    debug: bool = True
    host: str = "127.0.0.1"
    port: int = 8000
    
    # Base paths
    base_dir: Path = Path(__file__).parent.parent
    data_dir: Path = Path("./data")
    datasets_dir: Path = Path("./data/datasets")
    models_dir: Path = Path("./data/models")
    exports_dir: Path = Path("./data/exports")
    uploads_dir: Path = Path("./data/uploads")
    cache_dir: Path = Path("./data/cache")
    
    # Training
    use_wsl2: bool = True
    wsl2_distro: str = "Ubuntu"
    max_workers: int = 4
    batch_size: int = 16
    default_epochs: int = 100
    
    # Inference
    confidence_threshold: float = 0.25
    iou_threshold: float = 0.45
    max_detections: int = 300
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./data/visionlab.db"
    
    # Redis (WSL2)
    redis_url: str = "redis://localhost:6379/0"
    
    # Security
    node_api_key: str = "visionlab-node-secret-key"
    
    class Config:
        env_file = ".env"
        extra = "ignore"
    
    def setup_directories(self):
        """Create all required directories"""
        for dir_path in [
            self.data_dir,
            self.datasets_dir,
            self.models_dir,
            self.exports_dir,
            self.uploads_dir,
            self.cache_dir,
        ]:
            dir_path.mkdir(parents=True, exist_ok=True)


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.setup_directories()
    return settings

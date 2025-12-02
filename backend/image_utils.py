"""
Image Processing and Computer Vision Utilities
"""

import io
import cv2
import numpy as np
from PIL import Image
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
import albumentations as A
from concurrent.futures import ThreadPoolExecutor
import hashlib


class ImageProcessor:
    """Optimized image processing utilities"""
    
    def __init__(self, cache_dir: Path = None):
        self.cache_dir = cache_dir
        self._executor = ThreadPoolExecutor(max_workers=4)
    
    @staticmethod
    def load_image(path: str, max_size: Optional[int] = None) -> np.ndarray:
        """Load image with optional resizing for memory efficiency"""
        img = cv2.imread(path)
        if img is None:
            raise ValueError(f"Could not load image: {path}")
        
        if max_size:
            h, w = img.shape[:2]
            if max(h, w) > max_size:
                scale = max_size / max(h, w)
                img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        
        return img
    
    @staticmethod
    def load_image_rgb(path: str) -> np.ndarray:
        """Load image in RGB format"""
        img = cv2.imread(path)
        if img is None:
            raise ValueError(f"Could not load image: {path}")
        return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    @staticmethod
    def save_image(img: np.ndarray, path: str, quality: int = 95):
        """Save image with quality setting"""
        if path.lower().endswith('.jpg') or path.lower().endswith('.jpeg'):
            cv2.imwrite(path, img, [cv2.IMWRITE_JPEG_QUALITY, quality])
        elif path.lower().endswith('.png'):
            cv2.imwrite(path, img, [cv2.IMWRITE_PNG_COMPRESSION, 3])
        else:
            cv2.imwrite(path, img)
    
    @staticmethod
    def get_image_dimensions(path: str) -> Tuple[int, int]:
        """Get image width and height without loading full image"""
        with Image.open(path) as img:
            return img.size  # (width, height)
    
    @staticmethod
    def create_thumbnail(path: str, size: Tuple[int, int] = (256, 256)) -> bytes:
        """Create thumbnail for preview"""
        with Image.open(path) as img:
            img.thumbnail(size, Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=85)
            return buffer.getvalue()
    
    @staticmethod
    def draw_bbox(img: np.ndarray, bbox: List[float], color: Tuple[int, int, int], 
                  label: str = "", thickness: int = 2) -> np.ndarray:
        """Draw bounding box on image"""
        x1, y1, x2, y2 = map(int, bbox)
        cv2.rectangle(img, (x1, y1), (x2, y2), color, thickness)
        
        if label:
            font_scale = 0.5
            font = cv2.FONT_HERSHEY_SIMPLEX
            (w, h), _ = cv2.getTextSize(label, font, font_scale, 1)
            cv2.rectangle(img, (x1, y1 - h - 10), (x1 + w + 10, y1), color, -1)
            cv2.putText(img, label, (x1 + 5, y1 - 5), font, font_scale, (255, 255, 255), 1)
        
        return img
    
    @staticmethod
    def draw_polygon(img: np.ndarray, points: List[List[float]], color: Tuple[int, int, int],
                     fill: bool = False, alpha: float = 0.3) -> np.ndarray:
        """Draw polygon on image"""
        pts = np.array(points, dtype=np.int32)
        
        if fill:
            overlay = img.copy()
            cv2.fillPoly(overlay, [pts], color)
            img = cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0)
        
        cv2.polylines(img, [pts], True, color, 2)
        return img
    
    @staticmethod
    def hex_to_bgr(hex_color: str) -> Tuple[int, int, int]:
        """Convert hex color to BGR"""
        hex_color = hex_color.lstrip('#')
        rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        return (rgb[2], rgb[1], rgb[0])  # BGR
    
    def get_cached_path(self, original_path: str, suffix: str) -> Path:
        """Get cached file path"""
        if not self.cache_dir:
            return None
        hash_name = hashlib.md5(original_path.encode()).hexdigest()
        return self.cache_dir / f"{hash_name}_{suffix}"




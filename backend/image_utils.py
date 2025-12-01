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


class DataAugmentor:
    """Data augmentation pipeline using Albumentations"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.transform = self._build_transform()
    
    def _build_transform(self) -> A.Compose:
        """Build augmentation pipeline"""
        transforms = []
        
        if self.config.get('flip_horizontal', True):
            transforms.append(A.HorizontalFlip(p=0.5))
        
        if self.config.get('flip_vertical', False):
            transforms.append(A.VerticalFlip(p=0.5))
        
        if self.config.get('rotate_90', True):
            transforms.append(A.RandomRotate90(p=0.5))
        
        brightness = self.config.get('brightness', 0.2)
        contrast = self.config.get('contrast', 0.2)
        if brightness > 0 or contrast > 0:
            transforms.append(A.RandomBrightnessContrast(
                brightness_limit=brightness,
                contrast_limit=contrast,
                p=0.5
            ))
        
        saturation = self.config.get('saturation', 0.2)
        hue = self.config.get('hue', 0.1)
        if saturation > 0 or hue > 0:
            transforms.append(A.HueSaturationValue(
                hue_shift_limit=int(hue * 180),
                sat_shift_limit=int(saturation * 100),
                val_shift_limit=int(saturation * 100),
                p=0.5
            ))
        
        blur = self.config.get('blur', 0.0)
        if blur > 0:
            transforms.append(A.GaussianBlur(blur_limit=(3, 7), p=blur))
        
        noise = self.config.get('noise', 0.0)
        if noise > 0:
            transforms.append(A.GaussNoise(var_limit=(10.0, 50.0), p=noise))
        
        crop = self.config.get('crop', 0.0)
        if crop > 0:
            transforms.append(A.RandomCrop(
                height=int(640 * (1 - crop)),
                width=int(640 * (1 - crop)),
                p=crop
            ))
        
        return A.Compose(
            transforms,
            bbox_params=A.BboxParams(
                format='pascal_voc',  # [x_min, y_min, x_max, y_max]
                label_fields=['class_labels'],
                min_visibility=0.3
            )
        )
    
    def augment(self, image: np.ndarray, bboxes: List[List[float]], 
                class_labels: List[int]) -> Tuple[np.ndarray, List[List[float]], List[int]]:
        """Apply augmentation to image and annotations"""
        try:
            result = self.transform(
                image=image,
                bboxes=bboxes,
                class_labels=class_labels
            )
            return result['image'], result['bboxes'], result['class_labels']
        except Exception as e:
            # Return original if augmentation fails
            return image, bboxes, class_labels
    
    def generate_augmented_samples(self, image: np.ndarray, bboxes: List[List[float]],
                                   class_labels: List[int], num_samples: int = 3
                                   ) -> List[Tuple[np.ndarray, List[List[float]], List[int]]]:
        """Generate multiple augmented versions"""
        samples = []
        for _ in range(num_samples):
            aug_img, aug_bboxes, aug_labels = self.augment(image, bboxes, class_labels)
            samples.append((aug_img, list(aug_bboxes), list(aug_labels)))
        return samples


class MosaicAugmentor:
    """Mosaic augmentation for object detection"""
    
    @staticmethod
    def create_mosaic(images: List[np.ndarray], 
                      all_bboxes: List[List[List[float]]],
                      all_labels: List[List[int]],
                      output_size: int = 640) -> Tuple[np.ndarray, List[List[float]], List[int]]:
        """Create mosaic from 4 images"""
        if len(images) != 4:
            raise ValueError("Mosaic requires exactly 4 images")
        
        # Create output image
        mosaic = np.zeros((output_size, output_size, 3), dtype=np.uint8)
        half = output_size // 2
        
        new_bboxes = []
        new_labels = []
        
        positions = [(0, 0), (half, 0), (0, half), (half, half)]
        
        for idx, (img, bboxes, labels) in enumerate(zip(images, all_bboxes, all_labels)):
            # Resize image to half size
            img_resized = cv2.resize(img, (half, half))
            
            # Place in mosaic
            x_offset, y_offset = positions[idx]
            mosaic[y_offset:y_offset+half, x_offset:x_offset+half] = img_resized
            
            # Transform bboxes
            h, w = img.shape[:2]
            scale_x = half / w
            scale_y = half / h
            
            for bbox, label in zip(bboxes, labels):
                x1, y1, x2, y2 = bbox
                new_x1 = x1 * scale_x + x_offset
                new_y1 = y1 * scale_y + y_offset
                new_x2 = x2 * scale_x + x_offset
                new_y2 = y2 * scale_y + y_offset
                new_bboxes.append([new_x1, new_y1, new_x2, new_y2])
                new_labels.append(label)
        
        return mosaic, new_bboxes, new_labels

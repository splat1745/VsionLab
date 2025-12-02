"""
Inference Pipelines
Supports YOLOv8, YOLOv11, and RF-DETR models
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, Any, Optional, Callable, List

class RFDETRInference:
    """Run inference with RF-DETR models"""
    
    def __init__(self):
        self.loaded_models: Dict[str, Any] = {}
    
    def load_model(self, weights_path: str, model_variant: str = "rf-detr-base", force_reload: bool = False):
        """Load RF-DETR model weights"""
        if weights_path in self.loaded_models and not force_reload:
            return self.loaded_models[weights_path]
        
        from rfdetr import RFDETRBase, RFDETRLarge
        
        if model_variant == "rf-detr-large":
            model = RFDETRLarge()
        else:
            model = RFDETRBase()
        
        if weights_path and Path(weights_path).exists():
            model.load(weights_path)
        
        self.loaded_models[weights_path] = model
        return model
    
    def predict(
        self,
        weights_path: str,
        image_path: str,
        model_variant: str = "rf-detr-base",
        confidence: float = 0.5
    ) -> Dict[str, Any]:
        """Run RF-DETR inference on single image"""
        import cv2
        import time
        from PIL import Image
        
        model = self.load_model(weights_path, model_variant)
        
        img = Image.open(image_path)
        
        start_time = time.time()
        detections = model.predict(img, threshold=confidence)
        inference_time = time.time() - start_time
        
        # Parse results
        detection_list = []
        for det in detections:
            detection_list.append({
                'class_id': int(det.class_id),
                'class_name': det.class_name if hasattr(det, 'class_name') else str(det.class_id),
                'confidence': float(det.confidence),
                'bbox': [det.xyxy[0], det.xyxy[1], det.xyxy[2], det.xyxy[3]]
            })
        
        # Get image dimensions
        w, h = img.size
        
        return {
            'image_path': image_path,
            'detections': detection_list,
            'inference_time': inference_time,
            'image_width': w,
            'image_height': h,
            'model_type': 'rf-detr'
        }


class InferencePipeline:
    """Run inference with trained models"""
    
    def __init__(self, cache_dir: Path = None):
        self.loaded_models: Dict[str, Any] = {}
        self.cache_dir = cache_dir
    
    def load_model(self, weights_path: str, force_reload: bool = False):
        """Load model weights"""
        if weights_path in self.loaded_models and not force_reload:
            return self.loaded_models[weights_path]
        
        from ultralytics import YOLO
        model = YOLO(weights_path)
        self.loaded_models[weights_path] = model
        return model
    
    def predict(
        self,
        weights_path: str,
        image_path: str,
        confidence: float = 0.25,
        iou_threshold: float = 0.45,
        max_det: int = 300
    ) -> Dict[str, Any]:
        """Run inference on single image"""
        import cv2
        import time
        
        model = self.load_model(weights_path)
        
        start_time = time.time()
        results = model.predict(
            image_path,
            conf=confidence,
            iou=iou_threshold,
            max_det=max_det,
            verbose=False
        )[0]
        inference_time = time.time() - start_time
        
        # Parse results
        detections = []
        for box in results.boxes:
            detections.append({
                'class_id': int(box.cls[0]),
                'class_name': results.names[int(box.cls[0])],
                'confidence': float(box.conf[0]),
                'bbox': box.xyxy[0].tolist()  # [x1, y1, x2, y2]
            })
        
        # Get image dimensions
        img = cv2.imread(image_path)
        h, w = img.shape[:2]
        
        return {
            'image_path': image_path,
            'detections': detections,
            'inference_time': inference_time,
            'image_width': w,
            'image_height': h
        }
    
    def predict_batch(
        self,
        weights_path: str,
        image_paths: List[str],
        confidence: float = 0.25,
        iou_threshold: float = 0.45,
        max_det: int = 300
    ) -> List[Dict[str, Any]]:
        """Run batch inference"""
        results = []
        for path in image_paths:
            result = self.predict(weights_path, path, confidence, iou_threshold, max_det)
            results.append(result)
        return results
    
    def predict_video(
        self,
        weights_path: str,
        video_path: str,
        output_path: str,
        confidence: float = 0.25,
        iou_threshold: float = 0.45,
        callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Run inference on video"""
        import cv2
        import time
        
        model = self.load_model(weights_path)
        
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        frame_count = 0
        total_inference_time = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            start_time = time.time()
            results = model.predict(frame, conf=confidence, iou=iou_threshold, verbose=False)[0]
            inference_time = time.time() - start_time
            total_inference_time += inference_time
            
            # Draw results on frame
            annotated_frame = results.plot()
            out.write(annotated_frame)
            
            frame_count += 1
            
            if callback and frame_count % 10 == 0:
                callback({
                    'current_frame': frame_count,
                    'total_frames': total_frames,
                    'progress': frame_count / total_frames * 100
                })
        
        cap.release()
        out.release()
        
        return {
            'output_path': output_path,
            'total_frames': frame_count,
            'avg_inference_time': total_inference_time / frame_count if frame_count > 0 else 0,
            'fps': frame_count / total_inference_time if total_inference_time > 0 else 0
        }
    
    def unload_model(self, weights_path: str):
        """Unload model from memory"""
        if weights_path in self.loaded_models:
            del self.loaded_models[weights_path]
    
    def clear_cache(self):
        """Clear all loaded models"""
        self.loaded_models.clear()

"""
Training Pipeline with WSL2 Support
Supports YOLOv8, YOLOv11, and RF-DETR models
"""

import os
import sys
import json
import asyncio
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime
import shutil
import yaml


# Supported model architectures
YOLO_MODELS = {
    # YOLOv8 models
    "yolov8n": "yolov8n.pt",
    "yolov8s": "yolov8s.pt",
    "yolov8m": "yolov8m.pt",
    "yolov8l": "yolov8l.pt",
    "yolov8x": "yolov8x.pt",
    # YOLOv11 models
    "yolov11n": "yolo11n.pt",
    "yolov11s": "yolo11s.pt",
    "yolov11m": "yolo11m.pt",
    "yolov11l": "yolo11l.pt",
    "yolov11x": "yolo11x.pt",
}

RFDETR_MODELS = {
    "rf-detr-base": "rf-detr-base",
    "rf-detr-large": "rf-detr-large",
}


class TrainingPipeline:
    """Manage model training with local and WSL2 support"""
    
    def __init__(self, models_dir: Path, datasets_dir: Path, use_wsl2: bool = False):
        self.models_dir = models_dir
        self.datasets_dir = datasets_dir
        self.use_wsl2 = use_wsl2
        self.active_trainings: Dict[int, asyncio.Task] = {}
        self.training_status: Dict[int, Dict[str, Any]] = {}
    
    def _windows_to_wsl_path(self, path: str) -> str:
        """Convert Windows path to WSL path"""
        path = path.replace('\\', '/')
        if len(path) > 1 and path[1] == ':':
            drive = path[0].lower()
            return f"/mnt/{drive}{path[2:]}"
        return path
    
    def _wsl_to_windows_path(self, path: str) -> str:
        """Convert WSL path to Windows path"""
        if path.startswith('/mnt/') and len(path) > 5:
            drive = path[5].upper()
            return f"{drive}:{path[6:]}".replace('/', '\\')
        return path
    
    async def prepare_dataset(self, project_id: int, data_yaml_path: str) -> str:
        """Prepare dataset for training"""
        # Verify data.yaml exists and is valid
        with open(data_yaml_path, 'r') as f:
            data_config = yaml.safe_load(f)
        
        if self.use_wsl2:
            # Convert paths in data.yaml for WSL
            wsl_data_yaml = data_yaml_path.replace('.yaml', '_wsl.yaml')
            wsl_config = data_config.copy()
            wsl_config['path'] = self._windows_to_wsl_path(data_config['path'])
            
            with open(wsl_data_yaml, 'w') as f:
                yaml.dump(wsl_config, f)
            
            return wsl_data_yaml
        
        return data_yaml_path
    
    async def train_yolo(
        self,
        model_id: int,
        data_yaml_path: str,
        model_architecture: str = "yolov8n",
        epochs: int = 100,
        batch_size: int = 16,
        img_size: int = 640,
        learning_rate: float = 0.01,
        device: str = "auto",
        callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Train YOLO model (YOLOv8 or YOLOv11)
        
        Args:
            model_id: ID of the model in database
            data_yaml_path: Path to data.yaml
            model_architecture: yolov8n/s/m/l/x or yolov11n/s/m/l/x
            epochs: Number of training epochs
            batch_size: Batch size
            img_size: Image size for training
            learning_rate: Initial learning rate
            device: Device to use (auto, cpu, 0, 1, etc.)
            callback: Callback function for progress updates
        """
        # Get the correct model weights filename
        if model_architecture in YOLO_MODELS:
            model_weights = YOLO_MODELS[model_architecture]
        else:
            model_weights = f"{model_architecture}.pt"
        output_dir = self.models_dir / f"model_{model_id}"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        self.training_status[model_id] = {
            'status': 'starting',
            'current_epoch': 0,
            'total_epochs': epochs,
            'train_loss': None,
            'val_loss': None,
            'metrics': {},
            'started_at': datetime.now().isoformat()
        }
        
        try:
            if self.use_wsl2:
                result = await self._train_wsl2(
                    model_id, data_yaml_path, model_architecture,
                    epochs, batch_size, img_size, learning_rate,
                    str(output_dir), callback
                )
            else:
                result = await self._train_local(
                    model_id, data_yaml_path, model_architecture,
                    epochs, batch_size, img_size, learning_rate,
                    device, str(output_dir), callback
                )
            
            self.training_status[model_id]['status'] = 'completed'
            self.training_status[model_id]['completed_at'] = datetime.now().isoformat()
            return result
            
        except Exception as e:
            self.training_status[model_id]['status'] = 'failed'
            self.training_status[model_id]['error'] = str(e)
            raise
    
    async def _train_local(
        self,
        model_id: int,
        data_yaml_path: str,
        model_architecture: str,
        epochs: int,
        batch_size: int,
        img_size: int,
        learning_rate: float,
        device: str,
        output_dir: str,
        callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Train using local Python environment"""
        
        # Import ultralytics here to avoid loading at startup
        from ultralytics import YOLO
        
        # Get the correct model weights filename
        if model_architecture in YOLO_MODELS:
            model_weights = YOLO_MODELS[model_architecture]
        else:
            model_weights = f"{model_architecture}.pt"
        
        # Initialize model
        model = YOLO(model_weights)
        
        self.training_status[model_id]['status'] = 'training'
        
        # Custom callback for progress updates
        def on_train_epoch_end(trainer):
            epoch = trainer.epoch
            self.training_status[model_id].update({
                'current_epoch': epoch + 1,
                'train_loss': float(trainer.loss) if trainer.loss else None,
                'metrics': {
                    'box_loss': float(trainer.loss_items[0]) if len(trainer.loss_items) > 0 else None,
                    'cls_loss': float(trainer.loss_items[1]) if len(trainer.loss_items) > 1 else None,
                    'dfl_loss': float(trainer.loss_items[2]) if len(trainer.loss_items) > 2 else None,
                }
            })
            if callback:
                asyncio.create_task(callback(self.training_status[model_id]))
        
        # Train
        results = model.train(
            data=data_yaml_path,
            epochs=epochs,
            batch=batch_size,
            imgsz=img_size,
            lr0=learning_rate,
            device=device if device != "auto" else None,
            project=output_dir,
            name="train",
            exist_ok=True,
            verbose=True
        )
        
        # Get best weights path
        best_weights = Path(output_dir) / "train" / "weights" / "best.pt"
        
        return {
            'weights_path': str(best_weights),
            'metrics': {
                'mAP50': float(results.results_dict.get('metrics/mAP50(B)', 0)),
                'mAP50-95': float(results.results_dict.get('metrics/mAP50-95(B)', 0)),
                'precision': float(results.results_dict.get('metrics/precision(B)', 0)),
                'recall': float(results.results_dict.get('metrics/recall(B)', 0)),
            }
        }
    
    async def _train_wsl2(
        self,
        model_id: int,
        data_yaml_path: str,
        model_architecture: str,
        epochs: int,
        batch_size: int,
        img_size: int,
        learning_rate: float,
        output_dir: str,
        callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Train using WSL2 for GPU acceleration"""
        
        wsl_data_path = self._windows_to_wsl_path(data_yaml_path)
        wsl_output_dir = self._windows_to_wsl_path(output_dir)
        
        # Map architecture to model weights
        yolo_models_map = {
            "yolov8n": "yolov8n.pt", "yolov8s": "yolov8s.pt", "yolov8m": "yolov8m.pt",
            "yolov8l": "yolov8l.pt", "yolov8x": "yolov8x.pt",
            "yolov11n": "yolo11n.pt", "yolov11s": "yolo11s.pt", "yolov11m": "yolo11m.pt",
            "yolov11l": "yolo11l.pt", "yolov11x": "yolo11x.pt",
        }
        model_weights = yolo_models_map.get(model_architecture, f"{model_architecture}.pt")
        
        # Create training script
        train_script = f'''
import sys
sys.path.insert(0, '/mnt/c/Users/Rayan/Projects/VsionLab')
from ultralytics import YOLO
import json

model = YOLO("{model_weights}")

results = model.train(
    data="{wsl_data_path}",
    epochs={epochs},
    batch={batch_size},
    imgsz={img_size},
    lr0={learning_rate},
    project="{wsl_output_dir}",
    name="train",
    exist_ok=True,
    verbose=True
)

# Output results as JSON
output = {{
    "weights_path": str(results.save_dir / "weights" / "best.pt"),
    "metrics": {{
        "mAP50": float(results.results_dict.get("metrics/mAP50(B)", 0)),
        "mAP50-95": float(results.results_dict.get("metrics/mAP50-95(B)", 0)),
        "precision": float(results.results_dict.get("metrics/precision(B)", 0)),
        "recall": float(results.results_dict.get("metrics/recall(B)", 0)),
    }}
}}
print("TRAINING_RESULT:" + json.dumps(output))
'''
        
        # Write training script to temp file
        script_path = Path(output_dir) / "train_script.py"
        with open(script_path, 'w') as f:
            f.write(train_script)
        
        wsl_script_path = self._windows_to_wsl_path(str(script_path))
        
        # Run in WSL2
        self.training_status[model_id]['status'] = 'training'
        
        cmd = f'wsl python3 "{wsl_script_path}"'
        
        process = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        result_json = None
        
        async for line in process.stdout:
            line_str = line.decode('utf-8').strip()
            
            # Parse epoch progress
            if 'Epoch' in line_str:
                try:
                    # Parse YOLO training output
                    parts = line_str.split()
                    for i, part in enumerate(parts):
                        if 'Epoch' in part or part.isdigit():
                            if '/' in parts[i] if i < len(parts) else False:
                                current, total = parts[i].split('/')
                                self.training_status[model_id]['current_epoch'] = int(current)
                except:
                    pass
            
            # Capture final result
            if 'TRAINING_RESULT:' in line_str:
                result_json = line_str.split('TRAINING_RESULT:')[1]
            
            if callback:
                await callback(self.training_status[model_id])
        
        await process.wait()
        
        if result_json:
            result = json.loads(result_json)
            # Convert WSL path back to Windows
            result['weights_path'] = self._wsl_to_windows_path(result['weights_path'])
            return result
        
        raise Exception("Training failed - no result received")
    
    async def train_rfdetr(
        self,
        model_id: int,
        data_yaml_path: str,
        model_variant: str = "rf-detr-base",
        epochs: int = 100,
        batch_size: int = 16,
        img_size: int = 640,
        learning_rate: float = 0.0001,
        device: str = "auto",
        callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Train RF-DETR model (from Roboflow)
        
        Args:
            model_id: ID of the model in database
            data_yaml_path: Path to data.yaml
            model_variant: rf-detr-base or rf-detr-large
            epochs: Number of training epochs
            batch_size: Batch size
            img_size: Image size for training
            learning_rate: Initial learning rate
            device: Device to use (auto, cpu, cuda)
            callback: Callback function for progress updates
        """
        output_dir = self.models_dir / f"model_{model_id}"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        self.training_status[model_id] = {
            'status': 'starting',
            'current_epoch': 0,
            'total_epochs': epochs,
            'train_loss': None,
            'val_loss': None,
            'metrics': {},
            'started_at': datetime.now().isoformat(),
            'model_type': 'rf-detr'
        }
        
        try:
            if self.use_wsl2:
                result = await self._train_rfdetr_wsl2(
                    model_id, data_yaml_path, model_variant,
                    epochs, batch_size, img_size, learning_rate,
                    str(output_dir), callback
                )
            else:
                result = await self._train_rfdetr_local(
                    model_id, data_yaml_path, model_variant,
                    epochs, batch_size, img_size, learning_rate,
                    device, str(output_dir), callback
                )
            
            self.training_status[model_id]['status'] = 'completed'
            self.training_status[model_id]['completed_at'] = datetime.now().isoformat()
            return result
            
        except Exception as e:
            self.training_status[model_id]['status'] = 'failed'
            self.training_status[model_id]['error'] = str(e)
            raise
    
    async def _train_rfdetr_local(
        self,
        model_id: int,
        data_yaml_path: str,
        model_variant: str,
        epochs: int,
        batch_size: int,
        img_size: int,
        learning_rate: float,
        device: str,
        output_dir: str,
        callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Train RF-DETR using local Python environment"""
        
        from rfdetr import RFDETRBase, RFDETRLarge
        from rfdetr.util.coco_classes import COCO_CLASSES
        import torch
        
        # Select model variant
        if model_variant == "rf-detr-large":
            model = RFDETRLarge()
        else:
            model = RFDETRBase()
        
        self.training_status[model_id]['status'] = 'training'
        
        # Determine device
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Train with dataset
        model.train(
            dataset_dir=str(Path(data_yaml_path).parent),
            epochs=epochs,
            batch_size=batch_size,
            image_size=img_size,
            lr=learning_rate,
            device=device,
            output_dir=output_dir,
        )
        
        # Get best weights path
        best_weights = Path(output_dir) / "best.pt"
        
        return {
            'weights_path': str(best_weights),
            'metrics': {
                'mAP50': 0.0,  # RF-DETR reports differently
                'mAP50-95': 0.0,
                'precision': 0.0,
                'recall': 0.0,
            },
            'model_type': 'rf-detr'
        }
    
    async def _train_rfdetr_wsl2(
        self,
        model_id: int,
        data_yaml_path: str,
        model_variant: str,
        epochs: int,
        batch_size: int,
        img_size: int,
        learning_rate: float,
        output_dir: str,
        callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Train RF-DETR using WSL2 for GPU acceleration"""
        
        wsl_data_path = self._windows_to_wsl_path(str(Path(data_yaml_path).parent))
        wsl_output_dir = self._windows_to_wsl_path(output_dir)
        
        model_class = "RFDETRLarge" if model_variant == "rf-detr-large" else "RFDETRBase"
        
        train_script = f'''
import sys
sys.path.insert(0, '/mnt/c/Users/Rayan/Projects/VsionLab')
from rfdetr import {model_class}
import json
import torch

model = {model_class}()

model.train(
    dataset_dir="{wsl_data_path}",
    epochs={epochs},
    batch_size={batch_size},
    image_size={img_size},
    lr={learning_rate},
    device="cuda" if torch.cuda.is_available() else "cpu",
    output_dir="{wsl_output_dir}",
)

output = {{
    "weights_path": "{wsl_output_dir}/best.pt",
    "metrics": {{"mAP50": 0.0, "mAP50-95": 0.0, "precision": 0.0, "recall": 0.0}},
    "model_type": "rf-detr"
}}
print("TRAINING_RESULT:" + json.dumps(output))
'''
        
        script_path = Path(output_dir) / "train_rfdetr_script.py"
        with open(script_path, 'w') as f:
            f.write(train_script)
        
        wsl_script_path = self._windows_to_wsl_path(str(script_path))
        
        self.training_status[model_id]['status'] = 'training'
        
        cmd = f'wsl python3 "{wsl_script_path}"'
        
        process = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        result_json = None
        
        if process.stdout:
            async for line in process.stdout:
                line_str = line.decode('utf-8').strip()
                
                if 'TRAINING_RESULT:' in line_str:
                    result_json = line_str.split('TRAINING_RESULT:')[1]
                
                if callback:
                    await callback(self.training_status[model_id])
        
        await process.wait()
        
        if result_json:
            result = json.loads(result_json)
            result['weights_path'] = self._wsl_to_windows_path(result['weights_path'])
            return result
        
        raise Exception("RF-DETR training failed - no result received")
    
    def get_training_status(self, model_id: int) -> Optional[Dict[str, Any]]:
        """Get current training status"""
        return self.training_status.get(model_id)
    
    async def stop_training(self, model_id: int) -> bool:
        """Stop active training"""
        if model_id in self.active_trainings:
            task = self.active_trainings[model_id]
            task.cancel()
            self.training_status[model_id]['status'] = 'cancelled'
            return True
        return False




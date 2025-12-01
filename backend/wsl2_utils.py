"""
VisionLab - WSL2 Integration Utilities
Optimized for GPU acceleration via WSL2
"""

import os
import subprocess
import asyncio
import json
from pathlib import Path
from typing import Optional, Dict, Any, Callable
import shutil


class WSL2Manager:
    """Manage WSL2 environment for GPU-accelerated training"""
    
    def __init__(self, distro: str = "Ubuntu"):
        self.distro = distro
        self._wsl_available = None
        self._cuda_available = None
    
    @property
    def is_wsl_available(self) -> bool:
        """Check if WSL2 is available"""
        if self._wsl_available is None:
            try:
                result = subprocess.run(
                    ["wsl", "--list", "--verbose"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                self._wsl_available = self.distro in result.stdout
            except Exception:
                self._wsl_available = False
        return self._wsl_available
    
    @property
    def is_cuda_available(self) -> bool:
        """Check if CUDA is available in WSL2"""
        if self._cuda_available is None:
            try:
                result = subprocess.run(
                    ["wsl", "-d", self.distro, "--", "nvidia-smi"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                self._cuda_available = result.returncode == 0
            except Exception:
                self._cuda_available = False
        return self._cuda_available
    
    def windows_to_wsl_path(self, path: str) -> str:
        """Convert Windows path to WSL path"""
        path = str(path).replace('\\', '/')
        if len(path) > 1 and path[1] == ':':
            drive = path[0].lower()
            return f"/mnt/{drive}{path[2:]}"
        return path
    
    def wsl_to_windows_path(self, path: str) -> str:
        """Convert WSL path to Windows path"""
        if path.startswith('/mnt/') and len(path) > 5:
            drive = path[5].upper()
            return f"{drive}:{path[6:]}".replace('/', '\\')
        return path
    
    async def run_command(
        self,
        command: str,
        working_dir: Optional[str] = None,
        env: Optional[Dict[str, str]] = None
    ) -> tuple[int, str, str]:
        """Run command in WSL2"""
        if not self.is_wsl_available:
            raise RuntimeError("WSL2 is not available")
        
        wsl_cmd = ["wsl", "-d", self.distro]
        
        if working_dir:
            wsl_cmd.extend(["--cd", self.windows_to_wsl_path(working_dir)])
        
        wsl_cmd.extend(["--", "bash", "-c", command])
        
        process = await asyncio.create_subprocess_exec(
            *wsl_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, **(env or {})}
        )
        
        stdout, stderr = await process.communicate()
        return process.returncode, stdout.decode(), stderr.decode()
    
    async def run_training(
        self,
        data_yaml_path: str,
        model_architecture: str = "yolov8n",
        epochs: int = 100,
        batch_size: int = 16,
        img_size: int = 640,
        output_dir: str = "./runs",
        callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> Dict[str, Any]:
        """Run YOLO training in WSL2 with GPU acceleration"""
        
        if not self.is_wsl_available:
            raise RuntimeError("WSL2 is not available")
        
        if not self.is_cuda_available:
            raise RuntimeError("CUDA is not available in WSL2")
        
        wsl_data_yaml = self.windows_to_wsl_path(data_yaml_path)
        wsl_output_dir = self.windows_to_wsl_path(output_dir)
        
        # Create training script
        train_script = f'''
import os
import sys
import json
from ultralytics import YOLO

model = YOLO("{model_architecture}.pt")

results = model.train(
    data="{wsl_data_yaml}",
    epochs={epochs},
    batch={batch_size},
    imgsz={img_size},
    project="{wsl_output_dir}",
    name="train",
    exist_ok=True,
    verbose=True,
    device=0
)

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
        
        # Execute training
        process = await asyncio.create_subprocess_exec(
            "wsl", "-d", self.distro, "--",
            "python3", "-c", train_script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        result_json = None
        current_epoch = 0
        
        async for line in process.stdout:
            line_str = line.decode().strip()
            
            # Parse epoch from output
            if "Epoch" in line_str:
                try:
                    # Parse YOLO output format
                    parts = line_str.split()
                    for part in parts:
                        if "/" in part:
                            try:
                                current, total = part.split("/")
                                current_epoch = int(current)
                                if callback:
                                    await callback({
                                        'status': 'training',
                                        'current_epoch': current_epoch,
                                        'total_epochs': epochs
                                    })
                            except ValueError:
                                pass
                except Exception:
                    pass
            
            # Capture result
            if "TRAINING_RESULT:" in line_str:
                result_json = line_str.split("TRAINING_RESULT:")[1]
        
        await process.wait()
        
        if result_json:
            result = json.loads(result_json)
            # Convert paths back to Windows
            result['weights_path'] = self.wsl_to_windows_path(result['weights_path'])
            return result
        
        raise RuntimeError("Training failed - no result received")
    
    async def check_environment(self) -> Dict[str, Any]:
        """Check WSL2 environment status"""
        status = {
            'wsl_available': self.is_wsl_available,
            'cuda_available': False,
            'gpu_name': None,
            'python_version': None,
            'torch_version': None,
            'ultralytics_installed': False
        }
        
        if not self.is_wsl_available:
            return status
        
        # Check CUDA
        try:
            code, stdout, _ = await self.run_command("nvidia-smi --query-gpu=name --format=csv,noheader")
            if code == 0:
                status['cuda_available'] = True
                status['gpu_name'] = stdout.strip()
        except Exception:
            pass
        
        # Check Python
        try:
            code, stdout, _ = await self.run_command("python3 --version")
            if code == 0:
                status['python_version'] = stdout.strip()
        except Exception:
            pass
        
        # Check PyTorch
        try:
            code, stdout, _ = await self.run_command(
                "python3 -c \"import torch; print(torch.__version__)\""
            )
            if code == 0:
                status['torch_version'] = stdout.strip()
        except Exception:
            pass
        
        # Check ultralytics
        try:
            code, _, _ = await self.run_command(
                "python3 -c \"import ultralytics\""
            )
            status['ultralytics_installed'] = (code == 0)
        except Exception:
            pass
        
        return status
    
    async def setup_environment(self) -> bool:
        """Setup WSL2 environment with required packages"""
        if not self.is_wsl_available:
            return False
        
        # Install Python packages
        commands = [
            "pip3 install --upgrade pip",
            "pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu118",
            "pip3 install ultralytics",
        ]
        
        for cmd in commands:
            try:
                code, _, stderr = await self.run_command(cmd)
                if code != 0:
                    print(f"Warning: Command failed: {cmd}")
                    print(stderr)
            except Exception as e:
                print(f"Error running: {cmd}")
                print(str(e))
        
        return True


class GPUOptimizer:
    """GPU memory and performance optimizations"""
    
    @staticmethod
    def get_optimal_batch_size(img_size: int = 640, gpu_memory_gb: float = 8.0) -> int:
        """Calculate optimal batch size based on GPU memory and image size"""
        # Rough estimation of memory per image (in GB)
        # Higher resolution images need more memory
        memory_per_image = (img_size / 640) ** 2 * 0.5  # ~0.5GB for 640x640
        
        # Leave some headroom (60% of GPU memory)
        usable_memory = gpu_memory_gb * 0.6
        
        # Calculate batch size
        batch_size = int(usable_memory / memory_per_image)
        
        # Clamp to reasonable values
        return max(1, min(batch_size, 64))
    
    @staticmethod
    def get_optimal_workers(cpu_count: int = None) -> int:
        """Get optimal number of data loader workers"""
        if cpu_count is None:
            cpu_count = os.cpu_count() or 4
        
        # Use 2-4 workers per GPU, but not more than CPU cores
        return min(cpu_count, 8)
    
    @staticmethod
    def clear_gpu_cache():
        """Clear GPU memory cache"""
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
        except ImportError:
            pass


class InferenceOptimizer:
    """Optimize inference for production"""
    
    @staticmethod
    def export_to_onnx(
        weights_path: str,
        output_path: str,
        img_size: int = 640,
        dynamic: bool = True
    ) -> str:
        """Export model to ONNX format for optimized inference"""
        from ultralytics import YOLO
        
        model = YOLO(weights_path)
        
        # Export to ONNX
        model.export(
            format='onnx',
            imgsz=img_size,
            dynamic=dynamic,
            simplify=True,
            opset=12
        )
        
        onnx_path = weights_path.replace('.pt', '.onnx')
        if output_path:
            shutil.move(onnx_path, output_path)
            return output_path
        return onnx_path
    
    @staticmethod
    def export_to_tensorrt(
        weights_path: str,
        output_path: str,
        img_size: int = 640,
        half: bool = True
    ) -> str:
        """Export model to TensorRT for maximum GPU inference speed"""
        from ultralytics import YOLO
        
        model = YOLO(weights_path)
        
        # Export to TensorRT
        model.export(
            format='engine',
            imgsz=img_size,
            half=half,
            device=0
        )
        
        engine_path = weights_path.replace('.pt', '.engine')
        if output_path:
            shutil.move(engine_path, output_path)
            return output_path
        return engine_path


class CacheManager:
    """Manage caching for optimized performance"""
    
    def __init__(self, cache_dir: Path):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Subdirectories
        self.thumbnails_dir = cache_dir / "thumbnails"
        self.predictions_dir = cache_dir / "predictions"
        self.embeddings_dir = cache_dir / "embeddings"
        
        for d in [self.thumbnails_dir, self.predictions_dir, self.embeddings_dir]:
            d.mkdir(exist_ok=True)
    
    def get_thumbnail_path(self, image_id: int) -> Path:
        """Get cached thumbnail path"""
        return self.thumbnails_dir / f"{image_id}.jpg"
    
    def get_prediction_path(self, model_id: int, image_id: int) -> Path:
        """Get cached prediction path"""
        return self.predictions_dir / f"{model_id}_{image_id}.json"
    
    def clear_all(self):
        """Clear all caches"""
        shutil.rmtree(self.cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    def clear_predictions(self, model_id: Optional[int] = None):
        """Clear prediction cache"""
        if model_id:
            for f in self.predictions_dir.glob(f"{model_id}_*.json"):
                f.unlink()
        else:
            shutil.rmtree(self.predictions_dir)
            self.predictions_dir.mkdir()
    
    def get_cache_size(self) -> int:
        """Get total cache size in bytes"""
        total = 0
        for f in self.cache_dir.rglob("*"):
            if f.is_file():
                total += f.stat().st_size
        return total

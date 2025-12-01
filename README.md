# VisionLab - Local Computer Vision Platform

A full-featured, locally-hosted computer vision platform similar to Roboflow, with support for object detection, classification, and segmentation tasks.

![VisionLab](https://img.shields.io/badge/VisionLab-v1.0.0-blue)
![Python](https://img.shields.io/badge/Python-3.10+-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

### 🖼️ Dataset Management
- Upload and organize images into projects and datasets
- Split datasets into train/validation/test sets
- Browse images with thumbnails and status indicators

### ✏️ Annotation Tools
- **Bounding Box**: Draw rectangular annotations for object detection
- **Polygon**: Create precise polygon annotations for segmentation
- **Keyboard Shortcuts**: Fast annotation workflow with hotkeys
- **Undo/Redo**: Full history support
- **Zoom & Pan**: Navigate large images with ease

### 🎨 Class Management
- Create and manage object classes
- Custom colors for each class
- Class distribution statistics

### 🧠 Model Training
- **YOLO Architecture**: Support for YOLOv8 (nano to xlarge)
- **WSL2 GPU Acceleration**: Leverage NVIDIA GPUs through WSL2 for 10-50x faster training
- **Real-time Progress**: Monitor training with live metrics
- **Data Augmentation**: Built-in augmentation pipeline

### 🚀 Deployment & Inference
- Run inference on images
- Real-time webcam inference
- Batch processing support
- Confidence and IOU threshold adjustment

### 📦 Export Formats
- **YOLO**: YOLOv5/v8 format with data.yaml
- **COCO**: JSON annotations
- **Pascal VOC**: XML annotations

## Installation

### Prerequisites
- Python 3.10 or higher
- NVIDIA GPU (optional, for accelerated training)
- WSL2 with Ubuntu (optional, for GPU acceleration on Windows)

### Quick Start

1. **Clone or download the project**:
   ```bash
   cd VisionLab
   ```

2. **Create a virtual environment** (recommended):
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   # or
   source venv/bin/activate  # Linux/Mac
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**:
   ```bash
   python main.py
   ```

5. **Open in browser**:
   Navigate to `http://127.0.0.1:8000`

## WSL2 GPU Setup (Windows)

For maximum training performance on Windows, use WSL2 with GPU passthrough:

1. **Install WSL2 with Ubuntu**:
   ```powershell
   wsl --install -d Ubuntu
   ```

2. **Install NVIDIA drivers for WSL**:
   Download from [NVIDIA CUDA on WSL](https://docs.nvidia.com/cuda/wsl-user-guide/index.html)

3. **Install CUDA toolkit in WSL**:
   ```bash
   # In WSL terminal
   sudo apt update
   sudo apt install python3-pip
   pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu118
   pip3 install ultralytics
   ```

4. **Enable WSL2 in VisionLab**:
   - Check "Use WSL2 for GPU Acceleration" in training settings
   - Or set `USE_WSL2=true` in `.env`

## Project Structure

```
VisionLab/
├── main.py                 # Application entry point
├── requirements.txt        # Python dependencies
├── .env                    # Configuration
├── backend/
│   ├── app.py             # FastAPI application
│   ├── config.py          # Settings management
│   ├── database.py        # SQLite database models
│   ├── schemas.py         # Pydantic schemas
│   ├── image_utils.py     # Image processing utilities
│   ├── export_utils.py    # Dataset export utilities
│   ├── training.py        # Training pipeline
│   └── wsl2_utils.py      # WSL2 integration
├── frontend/
│   ├── index.html         # Main HTML
│   ├── styles.css         # CSS styles
│   └── app.js             # JavaScript application
├── scripts/
│   └── wsl2_train.sh      # WSL2 training script
└── data/                   # Data directory (created on startup)
    ├── datasets/          # Project datasets
    ├── models/            # Trained models
    ├── exports/           # Exported datasets
    └── cache/             # Cached files
```

## Usage Guide

### Creating a Project

1. Click "New Project" on the Projects page
2. Enter project name and description
3. Select project type (Object Detection, Classification, or Segmentation)
4. Add initial classes with colors
5. Click "Create Project"

### Uploading Images

1. Open a project
2. Click "Upload Images"
3. Select or create a dataset
4. Drag and drop images or click to browse
5. Click "Upload"

### Annotating Images

1. Open a project and click on an image
2. Select a class from the sidebar
3. Choose a tool (Bounding Box, Polygon)
4. Draw annotations on the image
5. Press Ctrl+S to save

**Keyboard Shortcuts:**
- `V` - Select tool
- `B` - Bounding box tool
- `P` - Polygon tool
- `A` / `D` - Previous/Next image
- `+` / `-` - Zoom in/out
- `F` - Fit to view
- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo
- `Ctrl+S` - Save
- `Delete` - Delete selected annotation

### Training a Model

1. Navigate to the "Train" section
2. Select a project with annotated data
3. Choose model architecture (YOLOv8n recommended for speed)
4. Configure training parameters:
   - Epochs: 100 (default)
   - Batch Size: 16 (adjust based on GPU memory)
   - Image Size: 640 (higher for better accuracy)
5. Enable WSL2 for GPU acceleration (if available)
6. Click "Start Training"

### Running Inference

1. Go to "Deploy" section
2. Select a trained model
3. Adjust confidence and IOU thresholds
4. Upload an image or enable webcam
5. View detection results

### Exporting Datasets

1. Open a project
2. Click "Export"
3. Choose format (YOLO, COCO, or Pascal VOC)
4. Click "Export"

## API Documentation

The application exposes a REST API for programmatic access:

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/{id}` - Get project details
- `DELETE /api/projects/{id}` - Delete project

### Images
- `GET /api/datasets/{id}/images` - List images
- `POST /api/datasets/{id}/upload` - Upload images
- `GET /api/images/{id}/file` - Get image file

### Annotations
- `POST /api/annotations` - Create annotation
- `POST /api/annotations/bulk` - Save all annotations for image
- `DELETE /api/annotations/{id}` - Delete annotation

### Training
- `POST /api/training/start` - Start training
- `GET /api/training/{id}/status` - Get training status
- `POST /api/training/{id}/stop` - Stop training

### Inference
- `POST /api/inference/predict` - Run inference on image

## Performance Optimization

### CPU Training
- Uses PyTorch with optimized data loading
- Multi-threaded image preprocessing
- Automatic mixed precision when available

### GPU Training (WSL2)
- Full CUDA acceleration through WSL2
- Automatic batch size optimization
- TensorRT export for fastest inference

### Memory Optimization
- Lazy image loading
- Thumbnail caching
- Automatic garbage collection

## Troubleshooting

### "Cannot connect to database"
- Ensure the `data` directory exists and is writable
- Delete `data/visionlab.db` to reset the database

### "CUDA not available in WSL2"
- Verify NVIDIA drivers are installed on Windows
- Run `nvidia-smi` in WSL to check GPU access
- Ensure you're using WSL2 (not WSL1): `wsl --set-version Ubuntu 2`

### "Training is slow"
- Enable WSL2 GPU acceleration for 10-50x speedup
- Reduce image size (e.g., 416 instead of 640)
- Use a smaller model (yolov8n instead of yolov8x)
- Reduce batch size if running out of memory

### "Out of memory during training"
- Reduce batch size
- Use a smaller image size
- Close other GPU-using applications
- Try a smaller model architecture

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - feel free to use for personal and commercial projects.

## Acknowledgments

- [Ultralytics YOLO](https://github.com/ultralytics/ultralytics) - State-of-the-art object detection
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Albumentations](https://albumentations.ai/) - Image augmentation library

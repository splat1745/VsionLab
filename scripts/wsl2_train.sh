#!/bin/bash
# VisionLab WSL2 Training Script
# This script runs training with GPU acceleration in WSL2

set -e

# Configuration
DATA_YAML=$1
MODEL_ARCH=${2:-yolov8n}
EPOCHS=${3:-100}
BATCH_SIZE=${4:-16}
IMG_SIZE=${5:-640}
OUTPUT_DIR=${6:-./runs}

echo "============================================"
echo "VisionLab WSL2 GPU Training"
echo "============================================"
echo "Model Architecture: $MODEL_ARCH"
echo "Epochs: $EPOCHS"
echo "Batch Size: $BATCH_SIZE"
echo "Image Size: $IMG_SIZE"
echo "Data Config: $DATA_YAML"
echo "Output Directory: $OUTPUT_DIR"
echo "============================================"

# Check CUDA availability
python3 -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}')"

# Install dependencies if needed
pip3 install --quiet ultralytics torch torchvision

# Run training
python3 << EOF
import os
import sys
import json
from ultralytics import YOLO

# Initialize model
print("Loading model: ${MODEL_ARCH}")
model = YOLO("${MODEL_ARCH}.pt")

# Train
print("Starting training...")
results = model.train(
    data="${DATA_YAML}",
    epochs=${EPOCHS},
    batch=${BATCH_SIZE},
    imgsz=${IMG_SIZE},
    project="${OUTPUT_DIR}",
    name="train",
    exist_ok=True,
    verbose=True,
    device=0  # Use first GPU
)

# Output results
output = {
    "weights_path": str(results.save_dir / "weights" / "best.pt"),
    "metrics": {
        "mAP50": float(results.results_dict.get("metrics/mAP50(B)", 0)),
        "mAP50-95": float(results.results_dict.get("metrics/mAP50-95(B)", 0)),
        "precision": float(results.results_dict.get("metrics/precision(B)", 0)),
        "recall": float(results.results_dict.get("metrics/recall(B)", 0)),
    }
}

print("TRAINING_COMPLETE")
print("RESULT:" + json.dumps(output))
EOF

echo "============================================"
echo "Training Complete!"
echo "============================================"

import uvicorn
import os
import sys

if __name__ == "__main__":
    # Add project root to path
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    
    print("Starting VisionLab Backend...")
    print("Docs available at http://localhost:8000/docs")
    
    uvicorn.run(
        "backend.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

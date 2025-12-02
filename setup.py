import sys
import platform
import subprocess
import shutil
import os
from pathlib import Path

def print_step(step):
    print(f"\n{'='*50}\n{step}\n{'='*50}")

def check_python_version():
    print_step("Checking Python Version")
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 9):
        print("Error: Python 3.9+ is required.")
        sys.exit(1)
    print(f"Python {version.major}.{version.minor} detected. OK.")

def check_gpu():
    print_step("Checking GPU & CUDA")
    
    # Check nvidia-smi
    try:
        subprocess.run(["nvidia-smi"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("NVIDIA GPU detected via nvidia-smi. OK.")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Warning: nvidia-smi not found. GPU acceleration might not work.")
    
    # Check PyTorch CUDA
    try:
        import torch
        if torch.cuda.is_available():
            print(f"PyTorch CUDA available: {torch.cuda.get_device_name(0)}")
            print(f"CUDA Version: {torch.version.cuda}")
        else:
            print("Warning: PyTorch cannot detect CUDA. Training will be slow (CPU only).")
    except ImportError:
        print("PyTorch not installed yet. Skipping CUDA check.")

def install_dependencies():
    print_step("Installing Python Dependencies")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("Dependencies installed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Error installing dependencies: {e}")
        sys.exit(1)

def setup_dvc():
    print_step("Setting up DVC")
    
    # Check if DVC is installed
    if shutil.which("dvc") is None:
        print("Installing DVC...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "dvc"])
    
    # Initialize DVC if not already initialized
    if not os.path.exists(".dvc"):
        print("Initializing DVC...")
        subprocess.run(["dvc", "init"], check=True)
    else:
        print("DVC already initialized.")
    
    # Configure remote (Local shared folder for now, can be changed to S3/SSH)
    # For cross-machine LAN, we might want a shared network drive or SSH remote
    # Here we set a placeholder that user should configure
    print("Note: DVC remote not configured. Run 'dvc remote add -d myremote <path>' to set up shared storage.")

def setup_redis_wsl():
    print_step("Checking Redis (WSL2)")
    
    if platform.system() == "Windows":
        # Check if running in WSL or can access WSL
        try:
            subprocess.run(["wsl", "--status"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            print("WSL2 detected.")
            
            # Check if redis-server is installed in default distro
            print("Checking Redis in WSL2...")
            result = subprocess.run(["wsl", "bash", "-c", "which redis-server"], stdout=subprocess.PIPE)
            if result.returncode != 0:
                print("Redis not found in WSL2. Attempting installation...")
                subprocess.run(["wsl", "sudo", "apt-get", "update"], check=True)
                subprocess.run(["wsl", "sudo", "apt-get", "install", "-y", "redis-server"], check=True)
                print("Redis installed in WSL2.")
            else:
                print("Redis found in WSL2.")
                
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Warning: WSL2 not detected or accessible. Redis setup skipped.")
    elif platform.system() == "Linux":
        # Check local redis
        if shutil.which("redis-server") is None:
             print("Redis not found. Please install redis-server (e.g., sudo apt install redis-server).")
        else:
            print("Redis detected locally.")

def main():
    print("Starting VisionLab Setup...")
    
    check_python_version()
    install_dependencies() # Install torch first for GPU check
    check_gpu()
    setup_dvc()
    setup_redis_wsl()
    
    print("\nSetup Complete! \nRun 'python start_system.py' (to be created) to launch services.")

if __name__ == "__main__":
    main()

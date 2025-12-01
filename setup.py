"""
VisionLab Setup Script
Checks environment and installs dependencies
"""

import sys
import subprocess
import platform


def check_python_version():
    """Check Python version is 3.10+"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 10):
        print(f"❌ Python 3.10+ required. You have {version.major}.{version.minor}")
        return False
    print(f"✓ Python {version.major}.{version.minor}.{version.micro}")
    return True


def check_pip():
    """Check pip is available"""
    try:
        subprocess.run([sys.executable, "-m", "pip", "--version"], 
                      capture_output=True, check=True)
        print("✓ pip is available")
        return True
    except subprocess.CalledProcessError:
        print("❌ pip is not available")
        return False


def install_dependencies():
    """Install Python dependencies"""
    print("\nInstalling dependencies...")
    try:
        subprocess.run([
            sys.executable, "-m", "pip", "install", "-r", "requirements.txt"
        ], check=True)
        print("✓ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to install dependencies")
        return False


def check_wsl2():
    """Check WSL2 availability on Windows"""
    if platform.system() != "Windows":
        return None
    
    try:
        result = subprocess.run(
            ["wsl", "--list", "--verbose"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0 and "Ubuntu" in result.stdout:
            print("✓ WSL2 with Ubuntu is available")
            return True
        else:
            print("ℹ WSL2 not configured (optional for GPU acceleration)")
            return False
    except Exception:
        print("ℹ WSL2 not available (optional for GPU acceleration)")
        return False


def check_cuda():
    """Check CUDA availability"""
    try:
        import torch
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            print(f"✓ CUDA is available - GPU: {gpu_name}")
            return True
        else:
            print("ℹ CUDA not available (training will use CPU)")
            return False
    except ImportError:
        print("ℹ PyTorch not installed yet (CUDA check skipped)")
        return None


def create_directories():
    """Create required directories"""
    import os
    
    dirs = [
        "data",
        "data/datasets",
        "data/models",
        "data/exports",
        "data/uploads",
        "data/cache"
    ]
    
    for d in dirs:
        os.makedirs(d, exist_ok=True)
    
    print("✓ Data directories created")
    return True


def main():
    print("=" * 50)
    print("VisionLab Setup")
    print("=" * 50)
    print()
    
    # Run checks
    checks = [
        ("Python Version", check_python_version),
        ("pip", check_pip),
    ]
    
    all_passed = True
    for name, check in checks:
        if not check():
            all_passed = False
    
    if not all_passed:
        print("\n❌ Some requirements are not met. Please fix the issues above.")
        return 1
    
    # Install dependencies
    if not install_dependencies():
        return 1
    
    # Post-install checks
    print("\n" + "-" * 50)
    print("Optional Features")
    print("-" * 50)
    check_cuda()
    check_wsl2()
    
    # Create directories
    print("\n" + "-" * 50)
    print("Setup")
    print("-" * 50)
    create_directories()
    
    print("\n" + "=" * 50)
    print("✓ Setup Complete!")
    print("=" * 50)
    print("\nTo start VisionLab, run:")
    print("  python main.py")
    print("\nThen open http://127.0.0.1:8000 in your browser")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

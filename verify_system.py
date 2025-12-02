import requests
import sys
import time
import subprocess
from pathlib import Path

BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3000"

def print_step(step):
    print(f"\n{'='*50}\n{step}\n{'='*50}")

def check_service(name, url):
    print(f"Checking {name} at {url}...")
    try:
        response = requests.get(url)
        if response.status_code == 200:
            print(f"{name} is UP.")
            return True
        else:
            print(f"{name} returned status {response.status_code}.")
            return False
    except requests.ConnectionError:
        print(f"{name} is DOWN.")
        return False

def check_backend_health():
    print_step("Checking Backend Health")
    if check_service("Backend API", f"{BASE_URL}/api/health"):
        # Check GPU info
        try:
            response = requests.get(f"{BASE_URL}/api/system/gpus")
            gpus = response.json()
            print(f"Detected GPUs: {len(gpus)}")
            for gpu in gpus:
                print(f" - {gpu['name']} ({gpu['memory']} GB)")
        except Exception as e:
            print(f"Failed to get GPU info: {e}")

def check_frontend_health():
    print_step("Checking Frontend Health")
    check_service("Frontend", FRONTEND_URL)

def check_dvc():
    print_step("Checking DVC Status")
    try:
        subprocess.run(["dvc", "status"], check=True)
        print("DVC is initialized and clean.")
    except subprocess.CalledProcessError:
        print("DVC check failed or has changes.")
    except FileNotFoundError:
        print("DVC not installed.")

def check_redis():
    print_step("Checking Redis Connection")
    # We can check this via backend if we add a redis health endpoint, 
    # or just assume backend health check covers it if it depends on redis.
    # For now, let's try to ping it via wsl if on windows
    if sys.platform == "win32":
        try:
            result = subprocess.run(["wsl", "redis-cli", "ping"], capture_output=True, text=True)
            if "PONG" in result.stdout:
                print("Redis (WSL2) is UP.")
            else:
                print("Redis (WSL2) check failed.")
        except Exception:
            print("Could not check Redis via WSL.")

def main():
    print("Starting System Verification...")
    
    check_backend_health()
    check_frontend_health()
    check_dvc()
    check_redis()
    
    print("\nVerification Complete.")

if __name__ == "__main__":
    main()

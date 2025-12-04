import requests
import os

BASE_URL = "http://localhost:8000/api"

def seed():
    # 1. Create Project
    print("Creating project...")
    p_data = {
        "name": "E2E Test Project",
        "description": "Created by automated test",
        "project_type": "object_detection",
        "classes": [{"name": "test_class", "color": "#ff0000"}]
    }
    try:
        resp = requests.post(f"{BASE_URL}/projects", json=p_data)
        resp.raise_for_status()
        project = resp.json()
        print(f"Project created: {project['id']}")
    except Exception as e:
        print(f"Failed to create project: {e}")
        return

    # 2. Create a dummy image
    img_path = "test_image.jpg"
    # Create a simple red square
    with open(img_path, "wb") as f:
        # Minimal JPEG header (not a valid image but might pass if backend doesn't check magic bytes strictly, 
        # but let's try to be safer and just send some bytes. 
        # Actually, let's use a real minimal valid jpeg hex if possible, or just random bytes if backend is loose.
        # Backend uses PIL? No, it just saves bytes.
        f.write(b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\xff\xc0\x00\x11\x08\x00\x40\x00\x40\x03\x01\x22\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\xff\xd9')
    
    # 3. Upload Image
    print("Uploading image...")
    try:
        with open(img_path, "rb") as f:
            files = {"file": (img_path, f, "image/jpeg")}
            resp = requests.post(f"{BASE_URL}/projects/{project['id']}/images", files=files)
            resp.raise_for_status()
            print("Image uploaded")
    except Exception as e:
        print(f"Failed to upload image: {e}")
    
    # Cleanup
    if os.path.exists(img_path):
        os.remove(img_path)

if __name__ == "__main__":
    seed()

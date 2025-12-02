# WSL2 Installation & Redis Setup Guide

## Step 1: Install WSL2

### Option A: Simple Install (Recommended)
Run PowerShell **as Administrator** and execute:
```powershell
wsl --install
```

This will:
- Enable WSL and Virtual Machine Platform
- Download and install Ubuntu (default distribution)
- Set WSL2 as the default version

**After installation completes, restart your computer.**

### Option B: Manual Install
If the above doesn't work, run these commands in PowerShell **as Administrator**:

```powershell
# Enable WSL
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Enable Virtual Machine Platform
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Restart your PC, then set WSL2 as default
wsl --set-default-version 2

# Install Ubuntu
wsl --install -d Ubuntu
```

## Step 2: First-Time Ubuntu Setup

After restart, Ubuntu will launch automatically:
1. Wait for installation to complete
2. Create a UNIX username (e.g., `visionlab`)
3. Create a password
4. Remember these credentials!

## Step 3: Install Redis in WSL2

Open Ubuntu (or any WSL2 terminal) and run:

```bash
# Update package lists
sudo apt update

# Install Redis
sudo apt install redis-server -y

# Start Redis
sudo service redis-server start

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

## Step 4: Configure Redis to Start Automatically

```bash
# Edit Redis config
sudo nano /etc/redis/redis.conf

# Find the line: bind 127.0.0.1 ::1
# Change it to: bind 0.0.0.0
# This allows Windows to connect to WSL2 Redis

# Save and exit (Ctrl+X, Y, Enter)

# Restart Redis
sudo service redis-server restart
```

## Step 5: Get WSL2 IP Address

```bash
# Get WSL2 IP
hostname -I
# Example output: 172.18.224.1
```

Copy this IP address!
172.19.174.47 
## Step 6: Update VisionLab Configuration

Edit `backend/config.py` and update the Redis URL:

```python
redis_url: str = "redis://172.19.174.47:6379/0"  # Use your WSL2 IP
```

## Step 7: Start VisionLab

```batch
cd C:\Users\Rayan\Projects\VsionLab
.\run.bat
```

## Troubleshooting

### WSL2 IP Changes After Restart
The WSL2 IP address may change after Windows restarts. To handle this:

**Option 1: Update manually**
1. Get new IP: `wsl hostname -I`
2. Update `backend/config.py`

**Option 2: Use Windows hosts file**
```powershell
# In PowerShell as Administrator
wsl hostname -I | % {Add-Content C:\Windows\System32\drivers\etc\hosts "$_ wsl.local"}
```
Then use `redis://wsl.local:6379/0` in config.py

### Redis Not Starting
```bash
# Check Redis status
sudo service redis-server status

# View Redis logs
sudo tail -f /var/log/redis/redis-server.log

# Restart Redis
sudo service redis-server restart
```

### Cannot Connect from Windows
```bash
# Make sure Redis is listening on 0.0.0.0
sudo netstat -tuln | grep 6379

# Should show: 0.0.0.0:6379

# Test from Windows PowerShell
Test-NetConnection -ComputerName <WSL2_IP> -Port 6379
```

## Quick Start Script for WSL2

Create `start_redis.sh` in your WSL2 home:

```bash
#!/bin/bash
sudo service redis-server start
echo "Redis started at: $(hostname -I):6379"
```

Make it executable:
```bash
chmod +x ~/start_redis.sh
```

Run before starting VisionLab:
```bash
wsl ~/start_redis.sh
```

## Verification Checklist

- [ ] WSL2 installed and Ubuntu running
- [ ] Redis installed in Ubuntu
- [ ] Redis service started
- [ ] `redis-cli ping` returns `PONG`
- [ ] WSL2 IP address obtained
- [ ] `backend/config.py` updated with WSL2 IP
- [ ] VisionLab services started successfully
- [ ] Celery worker connects to Redis (no connection errors)

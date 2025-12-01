"""
VisionLab - Local Computer Vision Platform
Main Entry Point
"""

import sys
import os
import asyncio

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn
from backend.config import get_settings


def main():
    """Run the VisionLab application"""
    settings = get_settings()
    
    print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║         ██╗   ██╗███████╗██╗ ██████╗ ███╗   ██╗           ║
    ║         ██║   ██║██╔════╝██║██╔═══██╗████╗  ██║           ║
    ║         ██║   ██║███████╗██║██║   ██║██╔██╗ ██║           ║
    ║         ╚██╗ ██╔╝╚════██║██║██║   ██║██║╚██╗██║           ║
    ║          ╚████╔╝ ███████║██║╚██████╔╝██║ ╚████║           ║
    ║           ╚═══╝  ╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝           ║
    ║                       LAB                                 ║
    ║                                                           ║
    ║           Local Computer Vision Platform                  ║
    ║           Version 1.0.0                                   ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
    """)
    
    print(f"Starting VisionLab on http://{settings.host}:{settings.port}")
    print("Press Ctrl+C to stop the server\n")
    
    uvicorn.run(
        "backend.app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )


if __name__ == "__main__":
    main()

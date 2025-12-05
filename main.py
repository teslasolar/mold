#!/usr/bin/env python3
"""
🦠 MOLD KONOMI SYSTEM 🦠
Turn chaos into checklist. Data in, plan out.

Usage:
    python main.py api     # Start REST API on port 3001
    python main.py ws      # Start WebSocket server on port 6789
    python main.py demo    # Run interactive demo
    python main.py all     # Start both API and WebSocket
"""

import asyncio
import sys
from typing import Optional


def run_api(host: str = "0.0.0.0", port: int = 3001):
    """Run REST API server"""
    import uvicorn
    from mold_konomi.api import app
    print(f"🦠 Starting Mold Konomi REST API on http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)


async def run_ws(host: str = "0.0.0.0", port: int = 6789):
    """Run WebSocket server"""
    from mold_konomi.websocket_server import run_server
    print(f"🦠 Starting Mold Konomi WebSocket on ws://{host}:{port}")
    await run_server(host, port)


async def run_demo():
    """Run interactive demo"""
    from mold_konomi.system import quick_start_demo
    print("🦠 Running Mold Konomi Demo...")
    await quick_start_demo()


async def run_all():
    """Run both API and WebSocket servers"""
    import uvicorn
    from mold_konomi.api import app
    from mold_konomi.websocket_server import get_server
    from mold_konomi.api import system

    # Share the system between API and WebSocket
    ws_server = get_server(system)

    print("🦠 Starting Mold Konomi System...")
    print("   REST API: http://0.0.0.0:3001")
    print("   WebSocket: ws://0.0.0.0:6789")

    # Create tasks for both servers
    config = uvicorn.Config(app, host="0.0.0.0", port=3001, log_level="info")
    server = uvicorn.Server(config)

    await asyncio.gather(
        server.serve(),
        ws_server.start("0.0.0.0", 6789)
    )


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    command = sys.argv[1].lower()

    if command == "api":
        run_api()
    elif command == "ws":
        asyncio.run(run_ws())
    elif command == "demo":
        asyncio.run(run_demo())
    elif command == "all":
        asyncio.run(run_all())
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()

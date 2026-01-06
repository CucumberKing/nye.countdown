"""NYE Countdown Backend - FastAPI Application.

Provides:
- WebSocket endpoint for time synchronization
- Health check endpoint
- NTP-synced accurate time
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.ntp_sync import ntp_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - start NTP sync on startup."""
    logger.info("Starting NYE Countdown Backend...")
    logger.info("Environment: %s", settings.environment)

    # Start NTP background sync
    sync_task = asyncio.create_task(ntp_service.start_background_sync())

    yield

    # Cleanup
    sync_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        pass
    logger.info("Backend shutdown complete")


app = FastAPI(
    title="NYE Countdown Backend",
    description="Time synchronization service for NYE Countdown",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
allowed_origins = (
    ["https://nyecountdown.live", "https://www.nyecountdown.live"]
    if settings.environment == "production"
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker/load balancers."""
    return {
        "status": "healthy",
        "ntp_synced": ntp_service.is_synced,
        "ntp_offset_ms": int(ntp_service.offset * 1000),
        "environment": settings.environment,
    }


@app.get("/api/time")
async def get_time():
    """Get current synced time (for non-WebSocket clients)."""
    return {
        "server_time_ms": ntp_service.get_synced_time_ms(),
        "ntp_synced": ntp_service.is_synced,
        "offset_ms": int(ntp_service.offset * 1000),
    }


@app.get("/api/config")
async def get_config():
    """Get static app configuration."""
    return {
        "target_ts": settings.target_ts,
        "impressum_url": settings.impressum_url,
        "privacy_url": settings.privacy_url,
    }


@app.websocket("/ws/time")
async def websocket_time(websocket: WebSocket):
    """WebSocket endpoint for time synchronization using ping/pong protocol.

    Protocol:
    1. Client sends: {"type": "ping", "client_time_ms": 1735689600000}
    2. Server responds: {"type": "pong", "client_time_ms": ..., "server_time_ms": ..., ...}
    3. Client calculates: offset = server_time - (client_time + rtt/2)

    This ensures accurate offset calculation with proper round-trip timing.
    """
    await websocket.accept()
    client_id = id(websocket)
    logger.info("WebSocket client %s connected", client_id)

    try:
        while True:
            # Wait for ping from client
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                # Respond with pong including server time
                response = {
                    "type": "pong",
                    "client_time_ms": message.get("client_time_ms"),
                    "server_time_ms": ntp_service.get_synced_time_ms(),
                    "ntp_synced": ntp_service.is_synced,
                }
                await websocket.send_json(response)

    except WebSocketDisconnect:
        logger.info("WebSocket client %s disconnected", client_id)
    except Exception as e:
        logger.exception("WebSocket error for client %s: %s", client_id, e)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development",
    )


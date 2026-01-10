"""NYE Countdown Backend - FastAPI Application.

Provides:
- WebSocket endpoint with JSON-RPC protocol for time sync, reactions, and greetings
- Health check endpoint
- NTP-synced accurate time
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.connection_manager import connection_manager
from app.ntp_sync import ntp_service
from app.models.reaction import ALLOWED_EMOJIS
from app.models.greeting import GREETING_TEMPLATES

# Import services to register RPC handlers
from app.services import rpc_service  # noqa: F401
from app.services import reaction_service  # noqa: F401
from app.services import greeting_service  # noqa: F401
from app.services import time_sync_service  # noqa: F401

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
    description="Time synchronization and party reactions for NYE Countdown",
    version="2027",
    lifespan=lifespan,
)

# CORS configuration (derived from settings.frontend_url)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# REST Endpoints
# =============================================================================


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker/load balancers."""
    return {
        "status": "healthy",
        "ntp_synced": ntp_service.is_synced,
        "ntp_offset_ms": int(ntp_service.offset * 1000),
        "environment": settings.environment,
        "connected_clients": connection_manager.client_count,
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
        "imprint_url": settings.imprint_url,
        "privacy_url": settings.privacy_url,
        "github_url": settings.github_url,
        "allowed_emojis": list(ALLOWED_EMOJIS),
        "greeting_templates": GREETING_TEMPLATES,
        "frontend_url": settings.frontend_url,
    }


# =============================================================================
# WebSocket Endpoints
# =============================================================================


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Unified WebSocket endpoint with JSON-RPC protocol.

    Methods:
    - time.ping: Time synchronization (client sends ping, server responds)
    - reaction.send: Send emoji reaction (broadcasts to all)
    - greeting.send: Send location greeting (resolves geo, broadcasts to all)

    Notifications (server -> client):
    - reaction.broadcast: Emoji reaction from another client
    - greeting.broadcast: Greeting from another client
    """
    client_info = await connection_manager.connect(websocket)
    client_id = client_info.client_id

    try:
        while True:
            data = await websocket.receive_text()
            response = await rpc_service.handle_message(data, client_id)
            if response:
                await websocket.send_json(response.model_dump())

    except WebSocketDisconnect:
        logger.info("Client %s disconnected", client_id)
    except Exception as e:
        logger.exception("WebSocket error for client %s: %s", client_id, e)
    finally:
        await connection_manager.disconnect(client_id)


# =============================================================================
# Entry Point
# =============================================================================


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development",
    )

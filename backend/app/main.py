"""NYE Countdown Backend - FastAPI Application.

Provides:
- WebSocket endpoint with JSON-RPC protocol for time sync, reactions, and greetings
- Health check endpoint
- NTP-synced accurate time
"""

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.connection_manager import connection_manager
from app.geolocation import geolocation_service
from app.ntp_sync import ntp_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Allowed emojis for reactions (party emojis only)
ALLOWED_EMOJIS = frozenset(
    ["🎉", "🎊", "🥳", "🍾", "🥂", "✨", "🎆", "🎇", "💃", "🕺", "🪩", "❤️"]
)

# Greeting templates
GREETING_TEMPLATES = [
    "Happy New Year from {location}!",
    "Cheers from {location}!",
    "{location} says Happy New Year!",
]


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


def make_rpc_response(
    id: int | str | None, result: Any = None, error: dict | None = None
) -> dict:
    """Create a JSON-RPC 2.0 response."""
    response: dict[str, Any] = {"jsonrpc": "2.0"}
    if id is not None:
        response["id"] = id
    if error:
        response["error"] = error
    else:
        response["result"] = result
    return response


def make_rpc_notification(method: str, params: dict) -> dict:
    """Create a JSON-RPC 2.0 notification (no id, no response expected)."""
    return {"jsonrpc": "2.0", "method": method, "params": params}


async def handle_time_ping(
    params: dict, request_id: int | str | None
) -> dict:
    """Handle time.ping request - return server time for sync."""
    client_time_ms = params.get("client_time_ms")
    return make_rpc_response(
        request_id,
        {
            "client_time_ms": client_time_ms,
            "server_time_ms": ntp_service.get_synced_time_ms(),
            "ntp_synced": ntp_service.is_synced,
        },
    )


async def handle_reaction_send(
    params: dict, request_id: int | str | None, client_id: int
) -> dict:
    """Handle reaction.send - broadcast emoji to all clients."""
    emoji = params.get("emoji", "")

    if emoji not in ALLOWED_EMOJIS:
        return make_rpc_response(
            request_id,
            error={
                "code": -32602,
                "message": "Invalid emoji",
            },
        )

    # Get client location if available
    client = connection_manager.get_client(client_id)
    location = client.location if client else None

    # Broadcast to all clients
    broadcast_msg = make_rpc_notification(
        "reaction.broadcast",
        {
            "emoji": emoji,
            "from_location": location,
            "ts": int(time.time() * 1000),
        },
    )
    await connection_manager.broadcast(broadcast_msg)

    return make_rpc_response(request_id, {"success": True})


async def handle_greeting_send(
    params: dict, request_id: int | str | None, client_id: int
) -> dict:
    """Handle greeting.send - resolve location and broadcast greeting."""
    lat = params.get("lat")
    lon = params.get("lon")
    template_index = params.get("template", 0)

    if lat is None or lon is None:
        return make_rpc_response(
            request_id,
            error={
                "code": -32602,
                "message": "Missing lat/lon coordinates",
            },
        )

    # Resolve location
    location_result = await geolocation_service.reverse_geocode(lat, lon)
    if location_result:
        city, country = location_result
        location = geolocation_service.format_location(city, country)
    else:
        location = "somewhere on Earth"

    # Update client location
    await connection_manager.update_client_location(client_id, location)

    # Select template
    template_idx = min(
        max(0, int(template_index)), len(GREETING_TEMPLATES) - 1
    )
    greeting_text = GREETING_TEMPLATES[template_idx].format(location=location)

    # Broadcast to all clients
    broadcast_msg = make_rpc_notification(
        "greeting.broadcast",
        {
            "text": greeting_text,
            "location": location,
            "ts": int(time.time() * 1000),
        },
    )
    await connection_manager.broadcast(broadcast_msg)

    return make_rpc_response(
        request_id, {"success": True, "location": location}
    )


async def handle_rpc_message(
    message: dict, client_id: int
) -> dict | None:
    """Route JSON-RPC message to appropriate handler."""
    method = message.get("method", "")
    params = message.get("params", {})
    request_id = message.get("id")

    handlers = {
        "time.ping": lambda: handle_time_ping(params, request_id),
        "reaction.send": lambda: handle_reaction_send(
            params, request_id, client_id
        ),
        "greeting.send": lambda: handle_greeting_send(
            params, request_id, client_id
        ),
    }

    handler = handlers.get(method)
    if handler:
        return await handler()
    else:
        # Unknown method
        if request_id is not None:
            return make_rpc_response(
                request_id,
                error={
                    "code": -32601,
                    "message": f"Method not found: {method}",
                },
            )
        return None


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
        "impressum_url": settings.impressum_url,
        "privacy_url": settings.privacy_url,
        "allowed_emojis": list(ALLOWED_EMOJIS),
        "greeting_templates": GREETING_TEMPLATES,
    }


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

            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                # Send parse error
                error_response = make_rpc_response(
                    None,
                    error={"code": -32700, "message": "Parse error"},
                )
                await websocket.send_json(error_response)
                continue

            # Handle the RPC message
            response = await handle_rpc_message(message, client_id)
            if response:
                await websocket.send_json(response)

    except WebSocketDisconnect:
        logger.info("Client %s disconnected", client_id)
    except Exception as e:
        logger.exception("WebSocket error for client %s: %s", client_id, e)
    finally:
        await connection_manager.disconnect(client_id)


# Keep the old endpoint for backwards compatibility during migration
@app.websocket("/ws/time")
async def websocket_time_legacy(websocket: WebSocket):
    """Legacy WebSocket endpoint for time sync only.

    DEPRECATED: Use /ws with JSON-RPC protocol instead.
    """
    await websocket.accept()
    client_id = id(websocket)
    logger.info("Legacy WebSocket client %s connected", client_id)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                response = {
                    "type": "pong",
                    "client_time_ms": message.get("client_time_ms"),
                    "server_time_ms": ntp_service.get_synced_time_ms(),
                    "ntp_synced": ntp_service.is_synced,
                }
                await websocket.send_json(response)

    except WebSocketDisconnect:
        logger.info("Legacy WebSocket client %s disconnected", client_id)
    except Exception as e:
        logger.exception(
            "Legacy WebSocket error for client %s: %s", client_id, e
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development",
    )

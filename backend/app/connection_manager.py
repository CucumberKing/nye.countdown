"""WebSocket Connection Manager.

Tracks all connected WebSocket clients and enables broadcasting messages
to all clients or specific subsets.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class ClientInfo:
    """Metadata about a connected WebSocket client."""

    websocket: WebSocket
    client_id: int
    connected_ts: float = field(default_factory=time.time)
    location: str | None = None


class ConnectionManager:
    """Manages WebSocket connections and broadcasts."""

    def __init__(self) -> None:
        self._clients: dict[int, ClientInfo] = {}
        self._lock = asyncio.Lock()

    @property
    def client_count(self) -> int:
        """Number of currently connected clients."""
        return len(self._clients)

    async def connect(self, websocket: WebSocket) -> ClientInfo:
        """Accept a new WebSocket connection and track it."""
        await websocket.accept()
        client_id = id(websocket)
        client_info = ClientInfo(websocket=websocket, client_id=client_id)

        async with self._lock:
            self._clients[client_id] = client_info

        logger.info(
            "Client %s connected (total: %s)", client_id, self.client_count
        )
        return client_info

    async def disconnect(self, client_id: int) -> None:
        """Remove a client from tracking."""
        async with self._lock:
            if client_id in self._clients:
                del self._clients[client_id]

        logger.info(
            "Client %s disconnected (total: %s)", client_id, self.client_count
        )

    async def update_client_location(
        self, client_id: int, location: str
    ) -> None:
        """Update the location for a client."""
        async with self._lock:
            if client_id in self._clients:
                self._clients[client_id].location = location

    def get_client(self, client_id: int) -> ClientInfo | None:
        """Get client info by ID."""
        return self._clients.get(client_id)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Send a message to all connected clients."""
        if not self._clients:
            return

        # Create tasks for all sends
        async with self._lock:
            clients = list(self._clients.values())

        disconnected: list[int] = []

        async def send_to_client(client: ClientInfo) -> None:
            try:
                await client.websocket.send_json(message)
            except Exception:
                disconnected.append(client.client_id)

        await asyncio.gather(
            *[send_to_client(client) for client in clients],
            return_exceptions=True,
        )

        # Clean up disconnected clients
        for client_id in disconnected:
            await self.disconnect(client_id)

    async def broadcast_except(
        self, message: dict[str, Any], exclude_client_id: int
    ) -> None:
        """Send a message to all connected clients except one."""
        if not self._clients:
            return

        async with self._lock:
            clients = [
                c
                for c in self._clients.values()
                if c.client_id != exclude_client_id
            ]

        disconnected: list[int] = []

        async def send_to_client(client: ClientInfo) -> None:
            try:
                await client.websocket.send_json(message)
            except Exception:
                disconnected.append(client.client_id)

        await asyncio.gather(
            *[send_to_client(client) for client in clients],
            return_exceptions=True,
        )

        # Clean up disconnected clients
        for client_id in disconnected:
            await self.disconnect(client_id)

    async def send_to_client(
        self, client_id: int, message: dict[str, Any]
    ) -> bool:
        """Send a message to a specific client."""
        client = self._clients.get(client_id)
        if not client:
            return False

        try:
            await client.websocket.send_json(message)
            return True
        except Exception:
            await self.disconnect(client_id)
            return False


# Global singleton instance
connection_manager = ConnectionManager()


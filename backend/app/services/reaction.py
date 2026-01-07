"""Reaction Service.

Handles emoji reaction sending and broadcasting.
"""

import logging
import time

from pydantic import ValidationError

from app.connection_manager import connection_manager
from app.models.rpc import RpcResponse
from app.models.reaction import (
    ReactionParams,
    ReactionResult,
    ReactionBroadcast,
    ALLOWED_EMOJIS,
)
from app.services.rpc import rpc_service

logger = logging.getLogger(__name__)


class ReactionService:
    """Service for handling emoji reactions."""

    @property
    def allowed_emojis(self) -> frozenset[str]:
        """Get the set of allowed emojis."""
        return ALLOWED_EMOJIS

    async def send_reaction(
        self,
        params: dict,
        client_id: int,
        request_id: int | str | None,
    ) -> RpcResponse:
        """Handle reaction.send RPC method."""
        # Validate params
        try:
            reaction_params = ReactionParams.model_validate(params)
        except ValidationError as e:
            return RpcResponse.invalid_params(request_id, str(e))

        # Get client location if available
        client = connection_manager.get_client(client_id)
        location = client.location if client else None

        # Create broadcast
        broadcast = ReactionBroadcast(
            emoji=reaction_params.emoji,
            from_location=location,
            ts=int(time.time() * 1000),
        )

        # Broadcast to all clients
        notification = rpc_service.make_notification(
            "reaction.broadcast",
            broadcast.model_dump(),
        )
        await connection_manager.broadcast(notification.model_dump())

        logger.info(
            "Reaction broadcast: %s from %s",
            reaction_params.emoji,
            location or "unknown",
        )

        return RpcResponse.success(request_id, ReactionResult().model_dump())


# Register the handler
reaction_service = ReactionService()


@rpc_service.register("reaction.send")
async def handle_reaction_send(
    params: dict, client_id: int, request_id: int | str | None
) -> RpcResponse:
    """RPC handler for reaction.send."""
    return await reaction_service.send_reaction(params, client_id, request_id)

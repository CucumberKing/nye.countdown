"""Greeting Service.

Handles location-based greeting sending with geocoding.
"""

import logging
import time

from pydantic import ValidationError

from app.connection_manager import connection_manager
from app.geolocation import geolocation_service
from app.models.rpc import RpcResponse
from app.models.greeting import (
    GreetingParams,
    GreetingResult,
    GreetingBroadcast,
    GREETING_TEMPLATES,
)
from app.services.rpc import rpc_service

logger = logging.getLogger(__name__)


class GreetingService:
    """Service for handling location-based greetings."""

    @property
    def templates(self) -> list[str]:
        """Get available greeting templates."""
        return GREETING_TEMPLATES

    async def send_greeting(
        self,
        params: dict,
        client_id: int,
        request_id: int | str | None,
    ) -> RpcResponse:
        """Handle greeting.send RPC method."""
        # Validate params
        try:
            greeting_params = GreetingParams.model_validate(params)
        except ValidationError as e:
            return RpcResponse.invalid_params(request_id, str(e))

        # Resolve location
        location_result = await geolocation_service.reverse_geocode(
            greeting_params.lat, greeting_params.lon
        )

        if location_result:
            city, country = location_result
            location = geolocation_service.format_location(city, country)
        else:
            location = "somewhere on Earth"

        # Update client location
        await connection_manager.update_client_location(client_id, location)

        # Format greeting text
        greeting_text = GREETING_TEMPLATES[greeting_params.template].format(
            location=location
        )

        # Create broadcast
        broadcast = GreetingBroadcast(
            text=greeting_text,
            location=location,
            ts=int(time.time() * 1000),
        )

        # Broadcast to all clients
        notification = rpc_service.make_notification(
            "greeting.broadcast",
            broadcast.model_dump(),
        )
        await connection_manager.broadcast(notification.model_dump())

        logger.info("Greeting broadcast: %s", greeting_text)

        result = GreetingResult(location=location)
        return RpcResponse.success(request_id, result.model_dump())


# Register the handler
greeting_service = GreetingService()


@rpc_service.register("greeting.send")
async def handle_greeting_send(
    params: dict, client_id: int, request_id: int | str | None
) -> RpcResponse:
    """RPC handler for greeting.send."""
    return await greeting_service.send_greeting(params, client_id, request_id)

"""JSON-RPC Service.

Handles routing and dispatching of JSON-RPC method calls.
"""

import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from pydantic import ValidationError

from app.models.rpc import RpcRequest, RpcResponse, RpcNotification

logger = logging.getLogger(__name__)

# Type for RPC method handlers - now includes request_id
RpcHandler = Callable[
    [dict[str, Any], int, int | str | None],
    Awaitable[RpcResponse | None]
]


class RpcService:
    """JSON-RPC method router and dispatcher."""

    def __init__(self) -> None:
        self._handlers: dict[str, RpcHandler] = {}

    def register(self, method: str) -> Callable[[RpcHandler], RpcHandler]:
        """Decorator to register an RPC method handler.

        Usage:
            @rpc_service.register("time.ping")
            async def handle_time_ping(
                params: dict, client_id: int, request_id: int | str | None
            ) -> RpcResponse:
                ...
        """

        def decorator(handler: RpcHandler) -> RpcHandler:
            self._handlers[method] = handler
            return handler

        return decorator

    def has_method(self, method: str) -> bool:
        """Check if a method is registered."""
        return method in self._handlers

    async def handle_message(
        self, raw_data: str, client_id: int
    ) -> RpcResponse | None:
        """Parse and dispatch a JSON-RPC message.

        Returns:
            RpcResponse if a response is needed, None for notifications.
        """
        # Parse JSON
        try:
            data = json.loads(raw_data)
        except json.JSONDecodeError:
            return RpcResponse.parse_error()

        # Validate request structure
        try:
            request = RpcRequest.model_validate(data)
        except ValidationError as e:
            logger.warning("Invalid RPC request: %s", e)
            return RpcResponse.error_response(
                data.get("id"),
                -32600,
                "Invalid request",
            )

        # Route to handler
        handler = self._handlers.get(request.method)
        if not handler:
            if request.is_notification:
                return None
            return RpcResponse.method_not_found(request.id, request.method)

        # Execute handler - pass request.id so response can include it
        try:
            response = await handler(request.params, client_id, request.id)
            # Ensure the response has the correct id
            if response and response.id is None and request.id is not None:
                response.id = request.id
            return response
        except ValidationError as e:
            return RpcResponse.invalid_params(request.id, str(e))
        except Exception as e:
            logger.exception("RPC handler error for %s: %s", request.method, e)
            return RpcResponse.error_response(
                request.id,
                -32603,
                "Internal error",
            )

    @staticmethod
    def make_notification(method: str, params: dict[str, Any]) -> RpcNotification:
        """Create a notification to broadcast to clients."""
        return RpcNotification(method=method, params=params)


# Global singleton
rpc_service = RpcService()

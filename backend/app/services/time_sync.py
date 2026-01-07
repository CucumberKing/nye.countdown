"""Time Sync Service.

Handles NTP-synced time synchronization for clients.
"""

from app.models.rpc import RpcResponse, TimePingParams, TimePongResult
from app.ntp_sync import ntp_service
from app.services.rpc import rpc_service


class TimeSyncService:
    """Service for handling time synchronization."""

    def get_synced_time_ms(self) -> int:
        """Get current NTP-synced time in milliseconds."""
        return ntp_service.get_synced_time_ms()

    @property
    def is_synced(self) -> bool:
        """Check if NTP is synced."""
        return ntp_service.is_synced

    async def handle_ping(
        self,
        params: dict,
        client_id: int,
        request_id: int | str | None,
    ) -> RpcResponse:
        """Handle time.ping RPC method."""
        ping_params = TimePingParams.model_validate(params)

        result = TimePongResult(
            client_time_ms=ping_params.client_time_ms,
            server_time_ms=self.get_synced_time_ms(),
            ntp_synced=self.is_synced,
        )

        return RpcResponse.success(request_id, result.model_dump())


# Register the handler
time_sync_service = TimeSyncService()


@rpc_service.register("time.ping")
async def handle_time_ping(
    params: dict, client_id: int, request_id: int | str | None
) -> RpcResponse:
    """RPC handler for time.ping."""
    return await time_sync_service.handle_ping(params, client_id, request_id)

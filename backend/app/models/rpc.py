"""JSON-RPC 2.0 Protocol Models.

Provides type-safe models for JSON-RPC request/response handling.
"""

from enum import IntEnum
from typing import Any, Literal

from pydantic import BaseModel, Field


class RpcErrorCode(IntEnum):
    """Standard JSON-RPC 2.0 error codes."""

    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603


class RpcError(BaseModel):
    """JSON-RPC 2.0 error object."""

    code: int
    message: str
    data: Any | None = None


class RpcRequest(BaseModel):
    """JSON-RPC 2.0 request object."""

    jsonrpc: Literal["2.0"] = "2.0"
    method: str
    params: dict[str, Any] = Field(default_factory=dict)
    id: int | str | None = None

    @property
    def is_notification(self) -> bool:
        """Check if this is a notification (no id = no response expected)."""
        return self.id is None


class RpcResponse(BaseModel):
    """JSON-RPC 2.0 response object."""

    jsonrpc: Literal["2.0"] = "2.0"
    id: int | str | None = None
    result: Any | None = None
    error: RpcError | None = None

    @classmethod
    def success(cls, id: int | str | None, result: Any) -> "RpcResponse":
        """Create a successful response."""
        return cls(id=id, result=result)

    @classmethod
    def error_response(
        cls,
        id: int | str | None,
        code: int | RpcErrorCode,
        message: str,
        data: Any | None = None,
    ) -> "RpcResponse":
        """Create an error response."""
        return cls(id=id, error=RpcError(code=code, message=message, data=data))

    @classmethod
    def parse_error(cls) -> "RpcResponse":
        """Create a parse error response."""
        return cls.error_response(
            None, RpcErrorCode.PARSE_ERROR, "Parse error"
        )

    @classmethod
    def method_not_found(cls, id: int | str | None, method: str) -> "RpcResponse":
        """Create a method not found error response."""
        return cls.error_response(
            id, RpcErrorCode.METHOD_NOT_FOUND, f"Method not found: {method}"
        )

    @classmethod
    def invalid_params(cls, id: int | str | None, message: str) -> "RpcResponse":
        """Create an invalid params error response."""
        return cls.error_response(id, RpcErrorCode.INVALID_PARAMS, message)


class RpcNotification(BaseModel):
    """JSON-RPC 2.0 notification (server-initiated, no id)."""

    jsonrpc: Literal["2.0"] = "2.0"
    method: str
    params: dict[str, Any] = Field(default_factory=dict)


# Time sync models
class TimePingParams(BaseModel):
    """Parameters for time.ping method."""

    client_time_ms: int


class TimePongResult(BaseModel):
    """Result for time.ping method."""

    client_time_ms: int
    server_time_ms: int
    ntp_synced: bool


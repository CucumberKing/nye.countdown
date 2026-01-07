"""Tests for the JSON-RPC service layer."""

import pytest

from app.models.rpc import (
    RpcRequest,
    RpcResponse,
    RpcNotification,
    RpcError,
    RpcErrorCode,
    TimePingParams,
    TimePongResult,
)
from app.models.reaction import ReactionParams, ReactionBroadcast, ALLOWED_EMOJIS
from app.models.greeting import GreetingParams, GreetingBroadcast, GREETING_TEMPLATES
from app.services.rpc import RpcService


class TestRpcRequest:
    """Tests for RpcRequest model."""

    def test_valid_request_with_id(self):
        """Request with id should parse correctly."""
        request = RpcRequest(
            method="test.method",
            params={"key": "value"},
            id=1,
        )
        assert request.jsonrpc == "2.0"
        assert request.method == "test.method"
        assert request.params == {"key": "value"}
        assert request.id == 1
        assert request.is_notification is False

    def test_notification_without_id(self):
        """Request without id is a notification."""
        request = RpcRequest(method="test.method")
        assert request.id is None
        assert request.is_notification is True

    def test_default_params_empty_dict(self):
        """Params should default to empty dict."""
        request = RpcRequest(method="test.method")
        assert request.params == {}


class TestRpcResponse:
    """Tests for RpcResponse model."""

    def test_success_response(self):
        """Success response should have result and no error."""
        response = RpcResponse.success(1, {"data": "value"})
        assert response.jsonrpc == "2.0"
        assert response.id == 1
        assert response.result == {"data": "value"}
        assert response.error is None

    def test_error_response(self):
        """Error response should have error and no result."""
        response = RpcResponse.error_response(1, -32600, "Test error")
        assert response.id == 1
        assert response.result is None
        assert response.error is not None
        assert response.error.code == -32600
        assert response.error.message == "Test error"

    def test_parse_error_response(self):
        """Parse error should have correct code."""
        response = RpcResponse.parse_error()
        assert response.id is None
        assert response.error.code == RpcErrorCode.PARSE_ERROR

    def test_method_not_found_response(self):
        """Method not found should include method name."""
        response = RpcResponse.method_not_found(1, "unknown.method")
        assert response.error.code == RpcErrorCode.METHOD_NOT_FOUND
        assert "unknown.method" in response.error.message

    def test_invalid_params_response(self):
        """Invalid params should have correct code."""
        response = RpcResponse.invalid_params(1, "missing field")
        assert response.error.code == RpcErrorCode.INVALID_PARAMS
        assert "missing field" in response.error.message


class TestRpcNotification:
    """Tests for RpcNotification model."""

    def test_notification_structure(self):
        """Notification should have method and params, no id."""
        notification = RpcNotification(
            method="reaction.broadcast",
            params={"emoji": "🎉"},
        )
        assert notification.jsonrpc == "2.0"
        assert notification.method == "reaction.broadcast"
        assert notification.params == {"emoji": "🎉"}


class TestTimeSyncModels:
    """Tests for time sync models."""

    def test_time_ping_params(self):
        """TimePingParams should validate client_time_ms."""
        params = TimePingParams(client_time_ms=1234567890000)
        assert params.client_time_ms == 1234567890000

    def test_time_pong_result(self):
        """TimePongResult should include all fields."""
        result = TimePongResult(
            client_time_ms=1234567890000,
            server_time_ms=1234567890100,
            ntp_synced=True,
        )
        assert result.client_time_ms == 1234567890000
        assert result.server_time_ms == 1234567890100
        assert result.ntp_synced is True


class TestReactionModels:
    """Tests for reaction models."""

    def test_reaction_params_valid_emoji(self):
        """ReactionParams should accept valid emojis."""
        for emoji in ALLOWED_EMOJIS:
            params = ReactionParams(emoji=emoji)
            assert params.emoji == emoji

    def test_reaction_params_invalid_emoji(self):
        """ReactionParams should reject invalid emojis."""
        with pytest.raises(ValueError):
            ReactionParams(emoji="invalid")

    def test_reaction_broadcast_structure(self):
        """ReactionBroadcast should have all required fields."""
        broadcast = ReactionBroadcast(
            emoji="🎉",
            from_location="Berlin",
            ts=1234567890000,
        )
        assert broadcast.emoji == "🎉"
        assert broadcast.from_location == "Berlin"
        assert broadcast.ts == 1234567890000


class TestGreetingModels:
    """Tests for greeting models."""

    def test_greeting_params_valid_coordinates(self):
        """GreetingParams should accept valid coordinates."""
        params = GreetingParams(lat=52.52, lon=13.405, template=0)
        assert params.lat == 52.52
        assert params.lon == 13.405
        assert params.template == 0

    def test_greeting_params_lat_range(self):
        """GreetingParams should validate latitude range."""
        # Valid edge cases
        GreetingParams(lat=-90.0, lon=0.0)
        GreetingParams(lat=90.0, lon=0.0)

        # Invalid: out of range
        with pytest.raises(ValueError):
            GreetingParams(lat=-91.0, lon=0.0)
        with pytest.raises(ValueError):
            GreetingParams(lat=91.0, lon=0.0)

    def test_greeting_params_lon_range(self):
        """GreetingParams should validate longitude range."""
        # Valid edge cases
        GreetingParams(lat=0.0, lon=-180.0)
        GreetingParams(lat=0.0, lon=180.0)

        # Invalid: out of range
        with pytest.raises(ValueError):
            GreetingParams(lat=0.0, lon=-181.0)
        with pytest.raises(ValueError):
            GreetingParams(lat=0.0, lon=181.0)

    def test_greeting_params_template_range(self):
        """GreetingParams should validate template index."""
        # Valid template indices
        for i in range(len(GREETING_TEMPLATES)):
            GreetingParams(lat=0.0, lon=0.0, template=i)

        # Invalid: negative
        with pytest.raises(ValueError):
            GreetingParams(lat=0.0, lon=0.0, template=-1)

        # Invalid: out of range
        with pytest.raises(ValueError):
            GreetingParams(lat=0.0, lon=0.0, template=len(GREETING_TEMPLATES))

    def test_greeting_broadcast_structure(self):
        """GreetingBroadcast should have all required fields."""
        broadcast = GreetingBroadcast(
            text="Happy New Year from Berlin!",
            location="Berlin",
            ts=1234567890000,
        )
        assert broadcast.text == "Happy New Year from Berlin!"
        assert broadcast.location == "Berlin"
        assert broadcast.ts == 1234567890000


class TestRpcService:
    """Tests for RpcService routing and dispatching."""

    @pytest.fixture
    def rpc_service(self):
        """Create a fresh RpcService for testing."""
        return RpcService()

    @pytest.mark.asyncio
    async def test_register_and_call_handler(self, rpc_service):
        """Registered handler should be called with correct args."""
        call_log = []

        @rpc_service.register("test.method")
        async def handler(params, client_id, request_id):
            call_log.append((params, client_id, request_id))
            return RpcResponse.success(request_id, {"handled": True})

        assert rpc_service.has_method("test.method")

        response = await rpc_service.handle_message(
            '{"jsonrpc":"2.0","method":"test.method","params":{"key":"value"},"id":1}',
            client_id=123,
        )

        assert len(call_log) == 1
        assert call_log[0] == ({"key": "value"}, 123, 1)
        assert response.result == {"handled": True}

    @pytest.mark.asyncio
    async def test_method_not_found(self, rpc_service):
        """Unknown method should return method not found error."""
        response = await rpc_service.handle_message(
            '{"jsonrpc":"2.0","method":"unknown","id":1}',
            client_id=123,
        )

        assert response.error is not None
        assert response.error.code == RpcErrorCode.METHOD_NOT_FOUND

    @pytest.mark.asyncio
    async def test_parse_error(self, rpc_service):
        """Invalid JSON should return parse error."""
        response = await rpc_service.handle_message(
            "not json",
            client_id=123,
        )

        assert response.error is not None
        assert response.error.code == RpcErrorCode.PARSE_ERROR

    @pytest.mark.asyncio
    async def test_notification_no_response_for_unknown(self, rpc_service):
        """Notification for unknown method should return None."""
        response = await rpc_service.handle_message(
            '{"jsonrpc":"2.0","method":"unknown"}',  # No id = notification
            client_id=123,
        )

        assert response is None

    @pytest.mark.asyncio
    async def test_handler_exception_returns_internal_error(self, rpc_service):
        """Handler exception should return internal error."""

        @rpc_service.register("error.method")
        async def handler(params, client_id, request_id):
            raise RuntimeError("Something went wrong")

        response = await rpc_service.handle_message(
            '{"jsonrpc":"2.0","method":"error.method","id":1}',
            client_id=123,
        )

        assert response.error is not None
        assert response.error.code == RpcErrorCode.INTERNAL_ERROR

    def test_make_notification(self, rpc_service):
        """make_notification should create proper notification."""
        notification = rpc_service.make_notification(
            "test.broadcast",
            {"data": "value"},
        )

        assert notification.jsonrpc == "2.0"
        assert notification.method == "test.broadcast"
        assert notification.params == {"data": "value"}


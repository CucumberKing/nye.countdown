"""Tests for WebSocket JSON-RPC functionality."""

import json
import time

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.rpc import RpcErrorCode


def make_rpc_request(
    method: str,
    params: dict | None = None,
    request_id: int | str | None = 1,
) -> str:
    """Create a JSON-RPC 2.0 request string."""
    request = {
        "jsonrpc": "2.0",
        "method": method,
    }
    if params is not None:
        request["params"] = params
    if request_id is not None:
        request["id"] = request_id
    return json.dumps(request)


class TestWebSocketTimePing:
    """Tests for the time.ping JSON-RPC method."""

    def test_time_ping_returns_pong_with_server_time(self):
        """time.ping should return server timestamp in JSON-RPC response."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            client_time_ms = int(time.time() * 1000)
            request = make_rpc_request(
                "time.ping",
                {"client_time_ms": client_time_ms},
                request_id=1,
            )
            websocket.send_text(request)

            data = websocket.receive_json()

            # Validate JSON-RPC response structure
            assert data["jsonrpc"] == "2.0"
            assert data["id"] == 1
            assert data.get("error") is None
            assert "result" in data

            result = data["result"]
            assert result["client_time_ms"] == client_time_ms
            assert "server_time_ms" in result
            assert "ntp_synced" in result

            # Server timestamp should be reasonable
            now_ms = int(time.time() * 1000)
            assert abs(result["server_time_ms"] - now_ms) < 60000

    def test_time_ping_echoes_client_timestamp(self):
        """time.ping should echo back exact client timestamp for RTT calculation."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            for i in range(3):
                client_time_ms = 1234567890000 + i
                request = make_rpc_request(
                    "time.ping",
                    {"client_time_ms": client_time_ms},
                    request_id=i + 1,
                )
                websocket.send_text(request)

                data = websocket.receive_json()

                assert data["id"] == i + 1
                assert data["result"]["client_time_ms"] == client_time_ms

    def test_time_ping_preserves_request_id(self):
        """Response should include the same id as the request."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            # Test with integer id
            request = make_rpc_request(
                "time.ping", {"client_time_ms": 1000}, request_id=42
            )
            websocket.send_text(request)
            data = websocket.receive_json()
            assert data["id"] == 42

            # Test with string id
            request = make_rpc_request(
                "time.ping", {"client_time_ms": 1000}, request_id="my-request"
            )
            websocket.send_text(request)
            data = websocket.receive_json()
            assert data["id"] == "my-request"

    def test_time_ping_missing_params_returns_error(self):
        """time.ping without client_time_ms should return invalid params error."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            request = make_rpc_request("time.ping", {}, request_id=1)
            websocket.send_text(request)

            data = websocket.receive_json()

            assert data["id"] == 1
            assert data.get("result") is None
            assert data["error"] is not None
            assert data["error"]["code"] == RpcErrorCode.INVALID_PARAMS


class TestWebSocketReactions:
    """Tests for the reaction.send JSON-RPC method."""

    def test_reaction_send_broadcasts_emoji(self):
        """reaction.send should broadcast emoji to all connected clients."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as ws1:
            with client.websocket_connect("/ws") as ws2:
                # Send reaction from ws1
                request = make_rpc_request(
                    "reaction.send",
                    {"emoji": "🎉"},
                    request_id=1,
                )
                ws1.send_text(request)

                # ws1 receives messages - could be notification first or response first
                msg1 = ws1.receive_json()
                msg2 = ws1.receive_json()

                # One should be response, one should be notification
                if "id" in msg1:
                    response, notification = msg1, msg2
                else:
                    notification, response = msg1, msg2

                assert response["id"] == 1
                assert response["result"]["success"] is True

                assert notification["method"] == "reaction.broadcast"
                assert notification["params"]["emoji"] == "🎉"
                assert "ts" in notification["params"]

                # ws2 should receive the broadcast notification
                notification2 = ws2.receive_json()
                assert notification2["method"] == "reaction.broadcast"
                assert notification2["params"]["emoji"] == "🎉"

    def test_reaction_send_invalid_emoji_returns_error(self):
        """reaction.send with invalid emoji should return error."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            request = make_rpc_request(
                "reaction.send",
                {"emoji": "invalid_emoji"},
                request_id=1,
            )
            websocket.send_text(request)

            data = websocket.receive_json()

            assert data["id"] == 1
            assert data.get("result") is None
            assert data["error"] is not None
            assert data["error"]["code"] == RpcErrorCode.INVALID_PARAMS

    def test_reaction_send_all_allowed_emojis(self):
        """All allowed emojis should be accepted."""
        client = TestClient(app)

        # Get allowed emojis from config
        config_response = client.get("/api/config")
        allowed_emojis = config_response.json()["allowed_emojis"]

        with client.websocket_connect("/ws") as websocket:
            for emoji in allowed_emojis:
                request = make_rpc_request(
                    "reaction.send",
                    {"emoji": emoji},
                    request_id=1,
                )
                websocket.send_text(request)

                # Receive 2 messages (response + broadcast)
                msg1 = websocket.receive_json()
                msg2 = websocket.receive_json()

                # Find the response (has id)
                response = msg1 if "id" in msg1 else msg2
                assert response["result"]["success"] is True, f"Failed for emoji: {emoji}"


class TestWebSocketGreetings:
    """Tests for the greeting.send JSON-RPC method."""

    def test_greeting_send_broadcasts_message(self):
        """greeting.send should broadcast greeting to all connected clients."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as ws1:
            with client.websocket_connect("/ws") as ws2:
                # Send greeting from ws1
                request = make_rpc_request(
                    "greeting.send",
                    {"lat": 52.52, "lon": 13.405, "template": 0},
                    request_id=1,
                )
                ws1.send_text(request)

                # ws1 receives messages - could be notification first or response first
                msg1 = ws1.receive_json()
                msg2 = ws1.receive_json()

                # One should be response, one should be notification
                if "id" in msg1:
                    response, notification = msg1, msg2
                else:
                    notification, response = msg1, msg2

                assert response["id"] == 1
                assert response["result"]["success"] is True
                assert "location" in response["result"]

                assert notification["method"] == "greeting.broadcast"
                assert "text" in notification["params"]
                assert "location" in notification["params"]
                assert "ts" in notification["params"]

                # ws2 should receive the broadcast notification
                notification2 = ws2.receive_json()
                assert notification2["method"] == "greeting.broadcast"

    def test_greeting_send_invalid_coordinates_returns_error(self):
        """greeting.send with invalid coordinates should return error."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            # Latitude out of range
            request = make_rpc_request(
                "greeting.send",
                {"lat": 100.0, "lon": 0.0},  # Invalid: lat must be [-90, 90]
                request_id=1,
            )
            websocket.send_text(request)

            data = websocket.receive_json()

            assert data["id"] == 1
            assert data["error"] is not None
            assert data["error"]["code"] == RpcErrorCode.INVALID_PARAMS

    def test_greeting_send_uses_template_index(self):
        """greeting.send should use the specified template."""
        client = TestClient(app)

        # Get templates from config
        config_response = client.get("/api/config")
        templates = config_response.json()["greeting_templates"]

        with client.websocket_connect("/ws") as websocket:
            for idx in range(len(templates)):
                request = make_rpc_request(
                    "greeting.send",
                    {"lat": 0.0, "lon": 0.0, "template": idx},
                    request_id=idx + 1,
                )
                websocket.send_text(request)

                # Receive 2 messages (response + broadcast)
                msg1 = websocket.receive_json()
                msg2 = websocket.receive_json()

                # Find the response and notification
                if "id" in msg1:
                    response, notification = msg1, msg2
                else:
                    notification, response = msg1, msg2

                assert response["result"]["success"] is True
                # The greeting text should be based on the template
                assert "{location}" not in notification["params"]["text"]


class TestWebSocketRpcErrors:
    """Tests for JSON-RPC error handling."""

    def test_invalid_json_returns_parse_error(self):
        """Invalid JSON should return parse error."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            websocket.send_text("not valid json{")

            data = websocket.receive_json()

            assert data["error"] is not None
            assert data["error"]["code"] == RpcErrorCode.PARSE_ERROR
            assert data.get("result") is None

    def test_unknown_method_returns_method_not_found(self):
        """Unknown method should return method not found error."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            request = make_rpc_request(
                "unknown.method",
                {},
                request_id=1,
            )
            websocket.send_text(request)

            data = websocket.receive_json()

            assert data["id"] == 1
            assert data["error"] is not None
            assert data["error"]["code"] == RpcErrorCode.METHOD_NOT_FOUND
            assert "unknown.method" in data["error"]["message"]

    def test_invalid_request_structure(self):
        """Invalid request structure should return error."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            # Missing jsonrpc field - Pydantic treats this as invalid params
            websocket.send_text(json.dumps({"method": "time.ping", "id": 1}))

            data = websocket.receive_json()

            assert data["error"] is not None
            # Missing required field triggers validation error (-32600 invalid request)
            assert data["error"]["code"] in (-32600, -32602)

    def test_notification_without_id_no_response(self):
        """Notification (request without id) for unknown method returns no response."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as websocket:
            # Send notification (no id) - should not get a response for unknown method
            request = make_rpc_request(
                "unknown.notification",
                {},
                request_id=None,  # No id = notification
            )
            websocket.send_text(request)

            # Send a valid request to verify connection still works
            request2 = make_rpc_request(
                "time.ping",
                {"client_time_ms": 1000},
                request_id=1,
            )
            websocket.send_text(request2)

            # Should receive response to the ping, not to the notification
            data = websocket.receive_json()
            assert data["id"] == 1
            assert "result" in data


class TestWebSocketMultipleConnections:
    """Tests for multiple WebSocket connections."""

    def test_multiple_connections_work_independently(self):
        """Multiple WebSocket connections should work independently."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as ws1:
            with client.websocket_connect("/ws") as ws2:
                # Send to first socket
                ws1.send_text(make_rpc_request(
                    "time.ping", {"client_time_ms": 1000}, request_id=1
                ))
                data1 = ws1.receive_json()
                assert data1["result"]["client_time_ms"] == 1000

                # Send to second socket
                ws2.send_text(make_rpc_request(
                    "time.ping", {"client_time_ms": 2000}, request_id=2
                ))
                data2 = ws2.receive_json()
                assert data2["result"]["client_time_ms"] == 2000

    def test_broadcast_reaches_all_clients(self):
        """Broadcasts should reach all connected clients."""
        client = TestClient(app)

        with client.websocket_connect("/ws") as ws1:
            with client.websocket_connect("/ws") as ws2:
                with client.websocket_connect("/ws") as ws3:
                    # Send reaction from ws1
                    ws1.send_text(make_rpc_request(
                        "reaction.send", {"emoji": "🎉"}, request_id=1
                    ))

                    # ws1 gets response + notification (order may vary)
                    msg1 = ws1.receive_json()
                    msg2 = ws1.receive_json()

                    if "id" in msg1:
                        response, notif1 = msg1, msg2
                    else:
                        notif1, response = msg1, msg2

                    assert response["id"] == 1
                    assert notif1["method"] == "reaction.broadcast"

                    # ws2 and ws3 get the notification
                    notif2 = ws2.receive_json()
                    assert notif2["method"] == "reaction.broadcast"
                    assert notif2["params"]["emoji"] == "🎉"

                    notif3 = ws3.receive_json()
                    assert notif3["method"] == "reaction.broadcast"
                    assert notif3["params"]["emoji"] == "🎉"


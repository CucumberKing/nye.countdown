"""Tests for the time sync functionality."""

import json
import time

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ntp_sync import NTPSyncService


class TestHealthEndpoint:
    """Tests for the health check endpoint."""

    def test_health_returns_status(self):
        """Health endpoint should return healthy status."""
        client = TestClient(app)
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "ntp_synced" in data
        assert "ntp_offset_ms" in data


class TestTimeEndpoint:
    """Tests for the time API endpoint."""

    def test_get_time_returns_timestamp(self):
        """Time endpoint should return server timestamp."""
        client = TestClient(app)
        response = client.get("/api/time")

        assert response.status_code == 200
        data = response.json()
        assert "server_time_ms" in data
        assert "ntp_synced" in data

        # Timestamp should be reasonable (within last minute of current time)
        now_ms = int(time.time() * 1000)
        assert abs(data["server_time_ms"] - now_ms) < 60000  # Within 60 seconds


class TestNTPSyncService:
    """Tests for the NTP sync service."""

    def test_initial_state(self):
        """New service should start with zero offset and not synced."""
        service = NTPSyncService()
        assert service.offset == 0.0
        assert service.is_synced is False

    def test_get_synced_time_returns_timestamp(self):
        """Should return a reasonable Unix timestamp."""
        service = NTPSyncService()
        ts = service.get_synced_time_ts()

        # Should be close to current time
        now = time.time()
        assert abs(ts - now) < 1.0  # Within 1 second

    def test_get_synced_time_ms_returns_milliseconds(self):
        """Should return timestamp in milliseconds."""
        service = NTPSyncService()
        ts_ms = service.get_synced_time_ms()
        ts_s = service.get_synced_time_ts()

        # ms should be ~1000x the seconds value
        assert abs(ts_ms - ts_s * 1000) < 10  # Within 10ms


@pytest.mark.asyncio
class TestNTPSync:
    """Integration tests for NTP sync (requires network)."""

    async def test_sync_succeeds_with_real_servers(self):
        """Should successfully sync with at least one NTP server."""
        service = NTPSyncService()

        # This test requires network access
        success = await service.sync()

        # At least one server should respond
        assert success is True
        assert service.is_synced is True
        # Offset should be reasonable (within 10 seconds of local time)
        assert abs(service.offset) < 10.0


class TestWebSocket:
    """Tests for the WebSocket time endpoint."""

    def test_websocket_ping_pong_returns_time(self):
        """WebSocket should respond to ping with pong containing server time."""
        client = TestClient(app)

        with client.websocket_connect("/ws/time") as websocket:
            # Send a ping message
            client_time_ms = int(time.time() * 1000)
            ping_message = {"type": "ping", "client_time_ms": client_time_ms}
            websocket.send_text(json.dumps(ping_message))

            # Should receive a pong response
            data = websocket.receive_json()

            assert data["type"] == "pong"
            assert data["client_time_ms"] == client_time_ms
            assert "server_time_ms" in data
            assert "ntp_synced" in data

            # Server timestamp should be reasonable
            now_ms = int(time.time() * 1000)
            assert abs(data["server_time_ms"] - now_ms) < 60000

    def test_websocket_echoes_client_timestamp(self):
        """WebSocket should echo back the exact client timestamp for RTT calculation."""
        client = TestClient(app)

        with client.websocket_connect("/ws/time") as websocket:
            # Send multiple pings with different timestamps
            for i in range(3):
                client_time_ms = 1234567890000 + i  # Arbitrary test timestamps
                ping_message = {"type": "ping", "client_time_ms": client_time_ms}
                websocket.send_text(json.dumps(ping_message))

                data = websocket.receive_json()

                # Client timestamp must be echoed exactly for proper RTT calculation
                assert data["client_time_ms"] == client_time_ms

    def test_websocket_multiple_connections(self):
        """Multiple WebSocket connections should work independently."""
        client = TestClient(app)

        with client.websocket_connect("/ws/time") as ws1:
            with client.websocket_connect("/ws/time") as ws2:
                # Send to first socket
                ws1.send_text(json.dumps({"type": "ping", "client_time_ms": 1000}))
                data1 = ws1.receive_json()
                assert data1["client_time_ms"] == 1000

                # Send to second socket
                ws2.send_text(json.dumps({"type": "ping", "client_time_ms": 2000}))
                data2 = ws2.receive_json()
                assert data2["client_time_ms"] == 2000

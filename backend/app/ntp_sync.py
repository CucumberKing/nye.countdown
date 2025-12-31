"""NTP Time Synchronization Service.

Syncs with multiple NTP servers (connected to atomic clocks) and provides
accurate time with calculated offset from local system time.
"""

import asyncio
import logging
import statistics
import time
from dataclasses import dataclass

import ntplib

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SyncResult:
    """Result of an NTP sync operation."""

    server: str
    offset: float  # seconds
    delay: float  # round-trip delay in seconds
    success: bool
    error: str | None = None


class NTPSyncService:
    """Service that maintains synchronized time from NTP servers."""

    def __init__(self):
        self._ntp_client = ntplib.NTPClient()
        self._offset: float = 0.0  # offset in seconds
        self._last_sync_ts: float = 0.0
        self._sync_lock = asyncio.Lock()
        self._is_synced: bool = False

    @property
    def offset(self) -> float:
        """Current time offset in seconds."""
        return self._offset

    @property
    def is_synced(self) -> bool:
        """Whether we have successfully synced at least once."""
        return self._is_synced

    def get_synced_time_ts(self) -> float:
        """Get current synced time as Unix timestamp in seconds."""
        return time.time() + self._offset

    def get_synced_time_ms(self) -> int:
        """Get current synced time as Unix timestamp in milliseconds."""
        return int(self.get_synced_time_ts() * 1000)

    async def _query_ntp_server(self, server: str) -> SyncResult:
        """Query a single NTP server asynchronously."""
        loop = asyncio.get_event_loop()

        def _sync_query():
            try:
                response = self._ntp_client.request(server, version=3, timeout=5)
                return SyncResult(
                    server=server,
                    offset=response.offset,
                    delay=response.delay,
                    success=True,
                )
            except Exception as e:
                return SyncResult(
                    server=server,
                    offset=0.0,
                    delay=0.0,
                    success=False,
                    error=str(e),
                )

        return await loop.run_in_executor(None, _sync_query)

    async def sync(self) -> bool:
        """Sync with all configured NTP servers and calculate median offset."""
        async with self._sync_lock:
            logger.info("Starting NTP sync with servers: %s", settings.ntp_servers)

            # Query all servers concurrently
            tasks = [self._query_ntp_server(server) for server in settings.ntp_servers]
            results = await asyncio.gather(*tasks)

            # Collect successful results
            successful_results = [r for r in results if r.success]

            for result in results:
                if result.success:
                    logger.debug(
                        "NTP %s: offset=%.4fs, delay=%.4fs",
                        result.server,
                        result.offset,
                        result.delay,
                    )
                else:
                    logger.warning("NTP %s failed: %s", result.server, result.error)

            if not successful_results:
                logger.error("All NTP servers failed!")
                return False

            # Use median offset for robustness against outliers
            offsets = [r.offset for r in successful_results]
            self._offset = statistics.median(offsets)
            self._last_sync_ts = time.time()
            self._is_synced = True

            logger.info(
                "NTP sync complete: offset=%.4fs (from %d/%d servers)",
                self._offset,
                len(successful_results),
                len(settings.ntp_servers),
            )
            return True

    async def start_background_sync(self):
        """Start background task that periodically re-syncs."""
        # Initial sync
        await self.sync()

        # Periodic re-sync
        while True:
            await asyncio.sleep(settings.ntp_sync_interval)
            try:
                await self.sync()
            except Exception as e:
                logger.exception("Background NTP sync failed: %s", e)


# Global singleton
ntp_service = NTPSyncService()


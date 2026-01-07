"""Geolocation Service.

Provides reverse geocoding using OpenStreetMap Nominatim API.
Includes caching to respect rate limits.
"""

import asyncio
import logging
import time
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

# Nominatim API endpoint
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"

# Cache settings
CACHE_TTL_SECONDS = 3600  # 1 hour
MAX_CACHE_SIZE = 1000

# Rate limiting: Nominatim requires max 1 request per second
MIN_REQUEST_INTERVAL = 1.1


@dataclass
class CachedLocation:
    """Cached location result."""

    city: str
    country: str
    timezone: str | None
    cached_ts: float


class GeolocationService:
    """Service for reverse geocoding coordinates to location names."""

    def __init__(self) -> None:
        self._cache: dict[str, CachedLocation] = {}
        self._last_request_ts: float = 0
        self._lock = asyncio.Lock()

    def _cache_key(self, lat: float, lon: float) -> str:
        """Generate cache key from coordinates (rounded to reduce variations)."""
        # Round to 2 decimal places (~1km precision)
        return f"{lat:.2f},{lon:.2f}"

    def _is_cache_valid(self, cached: CachedLocation) -> bool:
        """Check if cached entry is still valid."""
        return (time.time() - cached.cached_ts) < CACHE_TTL_SECONDS

    async def reverse_geocode(
        self, lat: float, lon: float
    ) -> tuple[str, str] | None:
        """
        Convert coordinates to city/country.

        Returns tuple of (city, country) or None if lookup fails.
        """
        cache_key = self._cache_key(lat, lon)

        # Check cache first
        if cache_key in self._cache:
            cached = self._cache[cache_key]
            if self._is_cache_valid(cached):
                logger.debug("Cache hit for %s", cache_key)
                return (cached.city, cached.country)
            else:
                del self._cache[cache_key]

        # Rate limiting
        async with self._lock:
            elapsed = time.time() - self._last_request_ts
            if elapsed < MIN_REQUEST_INTERVAL:
                await asyncio.sleep(MIN_REQUEST_INTERVAL - elapsed)

            self._last_request_ts = time.time()

        # Make API request
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    NOMINATIM_URL,
                    params={
                        "lat": lat,
                        "lon": lon,
                        "format": "json",
                        "zoom": 10,  # City level
                        "addressdetails": 1,
                    },
                    headers={
                        "User-Agent": "NYECountdown/1.0 (party app)",
                    },
                    timeout=5.0,
                )
                response.raise_for_status()
                data = response.json()

        except Exception as e:
            logger.warning("Geocoding failed for %s: %s", cache_key, e)
            return None

        # Extract city and country
        address = data.get("address", {})
        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("municipality")
            or address.get("state")
            or "Unknown"
        )
        country = address.get("country", "")

        # Cache the result
        if len(self._cache) >= MAX_CACHE_SIZE:
            # Remove oldest entries
            sorted_keys = sorted(
                self._cache.keys(),
                key=lambda k: self._cache[k].cached_ts,
            )
            for key in sorted_keys[: MAX_CACHE_SIZE // 2]:
                del self._cache[key]

        self._cache[cache_key] = CachedLocation(
            city=city,
            country=country,
            timezone=None,  # Could be added later
            cached_ts=time.time(),
        )

        logger.info("Geocoded %s -> %s, %s", cache_key, city, country)
        return (city, country)

    def format_location(self, city: str, country: str) -> str:
        """Format location for display."""
        if country:
            return f"{city}, {country}"
        return city


# Global singleton
geolocation_service = GeolocationService()


from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_prefix="NYE_")

    # NTP servers to query (comma-separated in env)
    ntp_servers: list[str] = [
        "pool.ntp.org",
        "time.google.com",
        "time.cloudflare.com",
    ]

    # How often to re-sync with NTP servers (seconds)
    ntp_sync_interval: int = 60

    # WebSocket time broadcast interval (milliseconds)
    ws_broadcast_interval_ms: int = 500

    # Environment
    environment: str = "development"

    # Target NYE timestamp (Unix seconds, defaults to Jan 1, 2027 00:00 UTC)
    target_ts: float = 1798761600.0

    # Optional legal links (external URLs, not in git)
    imprint_url: str | None = None
    privacy_url: str | None = None

    # Frontend URL for QR codes and CORS
    # Default: localhost for development, set via NYE_FRONTEND_URL in production
    frontend_url: str = "http://localhost:4200"

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        """Compute allowed CORS origins based on frontend_url."""
        if self.environment == "production":
            # In production, allow the configured frontend URL
            # Also allow www. variant if applicable
            origins = [self.frontend_url]
            if self.frontend_url.startswith("https://") and "www." not in self.frontend_url:
                # Add www variant
                www_url = self.frontend_url.replace("https://", "https://www.")
                origins.append(www_url)
            return origins
        else:
            # Development: allow all origins
            return ["*"]


settings = Settings()


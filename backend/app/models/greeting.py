"""Greeting Models.

Pydantic models for location-based greeting handling.
"""

from pydantic import BaseModel, Field

# Greeting templates
GREETING_TEMPLATES = [
    "Happy New Year from {location}!",
    "Cheers from {location}!",
    "{location} says Happy New Year!",
]


class GreetingParams(BaseModel):
    """Parameters for greeting.send method."""

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    template: int = Field(default=0, ge=0, lt=len(GREETING_TEMPLATES))


class GreetingResult(BaseModel):
    """Result for greeting.send method."""

    success: bool = True
    location: str


class GreetingBroadcast(BaseModel):
    """Broadcast payload for greetings."""

    text: str
    location: str
    ts: int


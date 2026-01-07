"""Reaction Models.

Pydantic models for emoji reaction handling.
"""

from pydantic import BaseModel, field_validator

# Allowed emojis for reactions (party emojis only)
ALLOWED_EMOJIS = frozenset(
    ["🎉", "🎊", "🥳", "🍾", "🥂", "✨", "🎆", "🎇", "💃", "🕺", "🪩", "❤️"]
)


class ReactionParams(BaseModel):
    """Parameters for reaction.send method."""

    emoji: str

    @field_validator("emoji")
    @classmethod
    def validate_emoji(cls, v: str) -> str:
        if v not in ALLOWED_EMOJIS:
            raise ValueError(f"Invalid emoji: {v}")
        return v


class ReactionResult(BaseModel):
    """Result for reaction.send method."""

    success: bool = True


class ReactionBroadcast(BaseModel):
    """Broadcast payload for reactions."""

    emoji: str
    from_location: str | None = None
    ts: int


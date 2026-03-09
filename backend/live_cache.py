# backend/live_cache.py
"""
Lightweight TTL in-memory cache for live API responses.
Prevents hammering nba_api on every poll request.
Default TTL: 20 seconds (matches frontend poll interval).
"""

import time
from typing import Any

_cache: dict[str, tuple[float, Any]] = {}   # key → (expire_at, value)


def get(key: str) -> Any | None:
    """Return cached value if still valid, else None."""
    entry = _cache.get(key)
    if entry is None:
        return None
    expire_at, value = entry
    if time.time() > expire_at:
        del _cache[key]
        return None
    return value


def set(key: str, value: Any, ttl: int = 20) -> None:
    """Store value with a TTL in seconds."""
    _cache[key] = (time.time() + ttl, value)


def clear() -> None:
    """Flush all cache entries (useful for testing)."""
    _cache.clear()

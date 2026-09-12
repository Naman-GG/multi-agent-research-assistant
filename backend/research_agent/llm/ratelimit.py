"""Token-bucket limiter with exponential backoff and jitter on 429.

Free tiers have hard daily and per-minute caps. Every provider call goes through here.

TODO(Track A): implement acquire() as an async token bucket at Limits.requests_per_minute.
"""
from __future__ import annotations


class RateLimiter:
    def __init__(self, requests_per_minute: int) -> None:
        self.rpm = requests_per_minute

    async def acquire(self) -> None:
        """Block until a request slot is available."""
        raise NotImplementedError("TODO(Track A)")


async def with_backoff(fn, *, max_attempts: int = 5):
    """Retry `fn` on rate-limit errors with exponential backoff + jitter."""
    raise NotImplementedError("TODO(Track A)")

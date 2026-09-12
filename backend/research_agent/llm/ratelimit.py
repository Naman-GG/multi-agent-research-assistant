"""Token-bucket limiter plus exponential backoff with jitter.

Free tiers have hard per-minute caps and every provider call goes through here.
The bucket is shared across the concurrent Summarizer and Critic fan-outs, which is
the whole point -- bounded concurrency alone does not bound request *rate*.

Jitter matters more than it looks: without it, N coroutines that all hit a 429 wake
up together and hit the wall again in lockstep.
"""
from __future__ import annotations

import asyncio
import random
import time
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


class RateLimiter:
    """Async token bucket. `capacity` tokens refilled at `rpm` per minute."""

    def __init__(self, requests_per_minute: int, *, capacity: int | None = None) -> None:
        self.rpm = max(1, requests_per_minute)
        self.capacity = capacity if capacity is not None else self.rpm
        self._tokens = float(self.capacity)
        self._updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """Block until a request slot is free."""
        while True:
            async with self._lock:
                now = time.monotonic()
                elapsed = now - self._updated
                self._tokens = min(self.capacity, self._tokens + elapsed * self.rpm / 60.0)
                self._updated = now
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return
                deficit = 1.0 - self._tokens
                wait = deficit * 60.0 / self.rpm
            await asyncio.sleep(wait)


class RateLimitError(Exception):
    """Raised by a provider adapter when the API reports 429 / quota exhaustion."""


async def with_backoff(
    fn: Callable[[], Awaitable[T]],
    *,
    max_attempts: int = 5,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
) -> T:
    """Retry `fn` on RateLimitError with exponential backoff + full jitter."""
    last: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return await fn()
        except RateLimitError as exc:
            last = exc
            if attempt == max_attempts - 1:
                break
            delay = min(max_delay, base_delay * (2**attempt))
            await asyncio.sleep(random.uniform(0, delay))
    raise last if last else RuntimeError("with_backoff: no attempt made")

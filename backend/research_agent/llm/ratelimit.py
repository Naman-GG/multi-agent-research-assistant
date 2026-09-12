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
import re
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


_RETRY_AFTER = re.compile(r"retry in ([0-9.]+)s", re.I)


def retry_after(exc: Exception) -> float | None:
    """Seconds the provider asked us to wait, when it says so.

    Gemini's 429 carries 'Please retry in 29.6s'. Honouring that beats guessing:
    exponential backoff from 1s gives up long before a 30s window has passed.
    """
    match = _RETRY_AFTER.search(str(exc))
    return float(match.group(1)) if match else None


class TransientError(Exception):
    """A provider failure that is worth retrying: rate limits AND temporary outages.

    Free-tier endpoints return 503 UNAVAILABLE under load fairly often. Treating that
    as fatal would abort a run several minutes in -- and would do it during a demo.
    """


class RateLimitError(TransientError):
    """The API reported 429 / quota exhaustion."""


class ServiceUnavailableError(TransientError):
    """The API reported 503 / overloaded. Retry with the same backoff."""


async def with_backoff(
    fn: Callable[[], Awaitable[T]],
    *,
    max_attempts: int = 6,
    base_delay: float = 2.0,
    max_delay: float = 90.0,
) -> T:
    """Retry `fn` on TransientError with exponential backoff + full jitter."""
    last: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return await fn()
        except TransientError as exc:
            last = exc
            if attempt == max_attempts - 1:
                break
            if (suggested := retry_after(exc)) is not None:
                # the provider told us exactly how long; add a little slack
                await asyncio.sleep(min(max_delay, suggested + random.uniform(0.5, 2.0)))
            else:
                delay = min(max_delay, base_delay * (2**attempt))
                await asyncio.sleep(random.uniform(delay / 2, delay))
    raise last if last else RuntimeError("with_backoff: no attempt made")

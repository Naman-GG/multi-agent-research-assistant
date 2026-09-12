"""Event bus: writes the trace to the DB and fans it out to live SSE subscribers.

`seq` is monotonic per run so a reconnecting frontend can replay from a cursor
rather than losing the trace.

TODO(Track A): implement publish/subscribe over asyncio.Queue, persist via db.py.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from .models import AgentName, EventType, RunEvent


class EventBus:
    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        self._seq = 0

    async def emit(
        self,
        agent: AgentName,
        type: EventType,
        message: str = "",
        **payload,
    ) -> RunEvent:
        """Persist an event and push it to every live subscriber."""
        raise NotImplementedError("TODO(Track A)")

    async def subscribe(self, from_seq: int = 0) -> AsyncIterator[RunEvent]:
        """Yield events as they happen, replaying anything after `from_seq` first."""
        raise NotImplementedError("TODO(Track A)")

"""Event bus: the live trace. Persists every event and fans it out to SSE subscribers.

`seq` is monotonic per run, so a frontend that loses its connection reconnects with
`?from_seq=N` and gets the backlog replayed before the live tail resumes -- rather
than silently losing the middle of the trace, which looks like a hung pipeline.

Subscribers are independent queues. A slow consumer (a browser tab on a bad network)
therefore cannot block the pipeline; if its queue overflows it is dropped, because
losing a viewer is better than stalling a run.
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable

from .models import AgentName, EventType, RunEvent

_QUEUE_MAX = 1000


class EventBus:
    def __init__(self, run_id: str, *, on_event: Callable[[RunEvent], None] | None = None) -> None:
        self.run_id = run_id
        self._seq = 0
        self._history: list[RunEvent] = []
        self._subscribers: set[asyncio.Queue[RunEvent | None]] = set()
        self._on_event = on_event
        self._closed = False

    @property
    def history(self) -> list[RunEvent]:
        return list(self._history)

    async def emit(self, agent: AgentName, type: EventType, message: str = "", **payload) -> RunEvent:
        self._seq += 1
        event = RunEvent(
            seq=self._seq, run_id=self.run_id, agent=agent,
            type=type, message=message, payload=payload,
        )
        self._history.append(event)
        if self._on_event:
            self._on_event(event)

        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                self._subscribers.discard(queue)  # drop the slow consumer, keep running
        return event

    async def close(self) -> None:
        """Signal end-of-stream so every subscriber's iterator terminates."""
        self._closed = True
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(None)
            except asyncio.QueueFull:
                self._subscribers.discard(queue)

    async def subscribe(self, from_seq: int = 0) -> AsyncIterator[RunEvent]:
        """Replay everything after `from_seq`, then follow live until the run ends."""
        queue: asyncio.Queue[RunEvent | None] = asyncio.Queue(maxsize=_QUEUE_MAX)
        backlog = [e for e in self._history if e.seq > from_seq]
        self._subscribers.add(queue)
        try:
            for event in backlog:
                yield event
            if self._closed:
                return
            last = backlog[-1].seq if backlog else from_seq
            while True:
                event = await queue.get()
                if event is None:
                    return
                if event.seq > last:      # skip anything already replayed from backlog
                    last = event.seq
                    yield event
        finally:
            self._subscribers.discard(queue)

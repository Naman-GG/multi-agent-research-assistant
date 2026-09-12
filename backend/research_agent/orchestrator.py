"""Sequences the five agents. About 150 lines when finished -- written by us, not a
framework, because in a viva we have to explain how it works.

Stage order:
    Planner -> Retriever -> Summarizer (fan-out) -> Critic (fan-out) -> Synthesis

Concurrency: the Summarizer and Critic fan out across papers/claims with an
asyncio.Semaphore bounded by Limits, so we never exceed the provider rate limit.
The Summarizer sees ONE paper per call -- that isolation is the design, not an
optimization, and is what stops findings blurring across papers.

TODO(Track A): implement run(); emit events at every stage boundary.
"""
from __future__ import annotations

from .models import Run, RunConfig


async def run_pipeline(question: str, config: RunConfig | None = None) -> Run:
    """Execute a complete research run and return it fully populated."""
    raise NotImplementedError("TODO(Track A)")


async def replay(run_id: str, speed: float = 1.0) -> Run:
    """Re-serve a completed run from the database with simulated timing, zero API calls.

    Record a run the night before each review. If the network or the free-tier quota
    dies during the demo, this still works.
    """
    raise NotImplementedError("TODO(Track A)")

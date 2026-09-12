"""Critic -- the two-stage gate. Thin orchestration; the logic lives in verification/.

    Stage 1  verification.span_check.check_span    deterministic, free
    Stage 2  verification.entailment.verify_claim  LLM, only for Stage 1 survivors

Running Stage 1 first is not just tidiness: it is what keeps the project inside a free
tier, and it is what lets the evaluation report how many rejections cost nothing.

TODO(Track C): implement verify_all() with bounded concurrency + the repair loop.
"""
from __future__ import annotations

from ..llm.base import LLMClient
from ..models import PaperRef, PaperSummary, Verdict


async def verify_all(
    summaries: list[PaperSummary],
    papers: list[PaperRef],
    llm: LLMClient,
    *,
    model: str,
    threshold: float = 92.0,
    concurrency: int = 4,
) -> list[Verdict]:
    """Verify every claim in every summary. Returns all verdicts, both stages."""
    raise NotImplementedError("TODO(Track C)")

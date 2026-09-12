"""Retriever -- the one agent with no LLM in it.

Fans each sub-query across the configured SearchSource implementations, merges and
dedupes the results, ranks them, and truncates to Limits.max_papers.

Ranking signal suggestions: citation_count, recency, and how many sub-queries a paper
matched (a paper answering three sub-queries is more central than one answering one).

TODO(Track A): implement; Track B supplies the SearchSource implementations.
"""
from __future__ import annotations

from ..models import PaperRef, Plan, RunConfig
from ..sources.base import SearchSource


async def retrieve(plan: Plan, sources: list[SearchSource], config: RunConfig) -> list[PaperRef]:
    raise NotImplementedError("TODO(Track A)")

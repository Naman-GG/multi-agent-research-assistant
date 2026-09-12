"""Retriever -- the one agent with no LLM in it.

Fans every sub-query across the configured sources, merges and dedupes, ranks, and
truncates to max_papers.

Ranking blends three signals. Sub-query coverage is weighted highest on purpose: a
paper that answers three of your five sub-questions is more central to the review than
one that answers a single sub-question very well, and citation count alone would bury
recent work under old landmarks.
"""
from __future__ import annotations

import asyncio

from ..models import PaperRef, Plan, RunConfig
from ..sources.base import SearchSource
from ..sources.dedupe import merge


def _score(paper: PaperRef, coverage: int, year_now: int = 2026) -> float:
    """Higher is better. Coverage dominates; citations and recency break ties."""
    citations = paper.citation_count or 0
    # log-ish damping so one 14,000-citation landmark cannot outrank everything
    citation_score = min(citations, 10_000) ** 0.5 / 100.0
    recency = 0.0 if paper.year is None else max(0.0, 1.0 - (year_now - paper.year) / 25.0)
    return coverage * 2.0 + citation_score + recency


async def retrieve(
    plan: Plan, sources: list[SearchSource], config: RunConfig
) -> list[PaperRef]:
    per_source = max(5, config.max_papers)

    async def search(source: SearchSource, sq):
        try:
            return await source.search(sq, limit=per_source)
        except Exception:
            # One dead source must not kill the run -- OpenAlex alone is enough for a
            # usable review, and a partial result beats a failed one.
            return []

    tasks = [search(src, sq) for src in sources for sq in plan.sub_queries]
    results = await asyncio.gather(*tasks)

    # how many distinct sub-queries each paper turned up for, before dedupe collapses ids
    coverage: dict[str, set[str]] = {}
    flat: list[PaperRef] = []
    for (src, sq), papers in zip(
        [(s, q) for s in sources for q in plan.sub_queries], results
    ):
        for paper in papers:
            key = (paper.doi or paper.title).strip().lower()
            coverage.setdefault(key, set()).add(sq.id)
            flat.append(paper)

    merged = merge(flat)

    if config.year_from is not None:
        merged = [p for p in merged if p.year is None or p.year >= config.year_from]
    if config.year_to is not None:
        merged = [p for p in merged if p.year is None or p.year <= config.year_to]
    if not config.allow_abstract_only:
        merged = [p for p in merged if p.full_text]

    merged.sort(
        key=lambda p: _score(p, len(coverage.get((p.doi or p.title).strip().lower(), {1}))),
        reverse=True,
    )
    return merged[: config.max_papers]

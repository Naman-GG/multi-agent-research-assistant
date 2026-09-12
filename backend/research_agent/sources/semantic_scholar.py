"""Semantic Scholar -- citation counts and TLDRs. Free key, stricter rate limits.

Use citation_count for ranking retrieved papers; it is the cheapest quality signal
you have.

TODO(Track B): implement search() against https://api.semanticscholar.org/graph/v1
"""
from __future__ import annotations

from ..models import PaperRef, SubQuery


class SemanticScholarSource:
    name = "semantic_scholar"

    async def search(self, query: SubQuery, *, limit: int = 20) -> list[PaperRef]:
        raise NotImplementedError("TODO(Track B)")

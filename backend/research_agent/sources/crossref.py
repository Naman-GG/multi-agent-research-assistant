"""Crossref -- DOI resolution and metadata backfill.

Mostly used to fill gaps (missing venue, year, authors) on papers found elsewhere,
rather than as a primary search.

TODO(Track B): implement search() and enrich() against https://api.crossref.org/works
"""
from __future__ import annotations

from ..models import PaperRef, SubQuery


class CrossrefSource:
    name = "crossref"

    async def search(self, query: SubQuery, *, limit: int = 20) -> list[PaperRef]:
        raise NotImplementedError("TODO(Track B)")

    async def enrich(self, paper: PaperRef) -> PaperRef:
        """Fill in missing metadata for a paper found in another source."""
        raise NotImplementedError("TODO(Track B)")

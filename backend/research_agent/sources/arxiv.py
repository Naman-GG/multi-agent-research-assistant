"""arXiv -- free full-text PDFs for CS and physics. No key. Atom XML API.

This is where most of your FULL_TEXT papers will come from, so it matters for the
evaluation: full-text claims are the ones with interesting quotes.

TODO(Track B): implement search() against http://export.arxiv.org/api/query
"""
from __future__ import annotations

from ..models import PaperRef, SubQuery


class ArxivSource:
    name = "arxiv"

    async def search(self, query: SubQuery, *, limit: int = 20) -> list[PaperRef]:
        raise NotImplementedError("TODO(Track B)")

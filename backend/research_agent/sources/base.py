"""The retrieval interface -- the contract between Track B and Track A.

Track A's Retriever calls this; Track B implements it four times. A stub returning
three papers from the fixture unblocks Track A on day 2, before any real API works.
"""
from __future__ import annotations

from typing import Protocol

from ..models import PaperRef, SubQuery


class SearchSource(Protocol):
    name: str

    async def search(self, query: SubQuery, *, limit: int = 20) -> list[PaperRef]:
        """Return papers matching a sub-query.

        Implementations must set `availability` honestly: FULL_TEXT only when
        `full_text` is actually populated. An abstract-only paper is weaker evidence
        and the UI marks it as such -- lying here corrupts the evaluation.
        """
        ...

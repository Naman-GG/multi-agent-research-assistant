"""OpenAlex -- the primary source. No API key, generous limits, excellent metadata.

Two gotchas worth knowing before you start:
  1. Abstracts come back as an INVERTED INDEX ({word: [positions]}), not a string.
     You have to reconstruct them -- see reconstruct_abstract below.
  2. Putting CONTACT_EMAIL in the User-Agent moves you to the faster "polite pool".

TODO(Track B): implement search() against https://api.openalex.org/works
"""
from __future__ import annotations

from ..models import PaperRef, SubQuery


def reconstruct_abstract(inverted_index: dict[str, list[int]] | None) -> str | None:
    """Turn OpenAlex's abstract_inverted_index back into readable text.

    TODO(Track B): place each word at each of its positions, then join.
    """
    raise NotImplementedError("TODO(Track B)")


class OpenAlexSource:
    name = "openalex"

    async def search(self, query: SubQuery, *, limit: int = 20) -> list[PaperRef]:
        raise NotImplementedError("TODO(Track B)")

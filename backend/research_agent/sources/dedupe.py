"""Merge the same paper found in several databases.

Order matters: DOI first (exact, after normalization), then fuzzy title match for the
DOI-less. When merging, prefer the record with full text, then the one with the most
complete metadata.

This is a likely viva question -- "how do you know two results are the same paper?"

TODO(Track B): implement normalize_doi, normalize_title, merge.
"""
from __future__ import annotations

from ..models import PaperRef


def normalize_doi(doi: str | None) -> str | None:
    """Lowercase, strip https://doi.org/ prefix and whitespace."""
    raise NotImplementedError("TODO(Track B)")


def normalize_title(title: str) -> str:
    """Lowercase, strip punctuation and stop-words, collapse whitespace."""
    raise NotImplementedError("TODO(Track B)")


def merge(papers: list[PaperRef], *, title_threshold: float = 93.0) -> list[PaperRef]:
    """Collapse duplicates across sources into one PaperRef each."""
    raise NotImplementedError("TODO(Track B)")

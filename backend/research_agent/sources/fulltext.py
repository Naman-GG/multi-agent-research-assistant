"""Open-access PDF -> clean text, split into sections.

Extraction is genuinely messy: ligatures, hyphenation across line breaks, two-column
layouts, headers and footers repeating on every page. Clean it here, because whatever
`PaperRef.source_text()` returns is exactly what Stage 1 searches -- noise here shows
up as false QUOTE_NOT_FOUND verdicts downstream.

Papers with no retrievable PDF fall back to ABSTRACT_ONLY and are flagged in the UI.

TODO(Track B): implement with pymupdf.
"""
from __future__ import annotations


async def fetch_pdf(url: str) -> bytes | None:
    raise NotImplementedError("TODO(Track B)")


def extract_text(pdf_bytes: bytes) -> str:
    """Extract and normalize: de-hyphenate, strip running heads, collapse whitespace."""
    raise NotImplementedError("TODO(Track B)")


def split_sections(text: str) -> dict[str, str]:
    """Split into Abstract / Methods / Results / Discussion by heading regex.

    Used to populate Claim.section, which the UI shows and the Critic uses for context.
    """
    raise NotImplementedError("TODO(Track B)")

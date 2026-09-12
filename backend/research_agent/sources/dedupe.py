from __future__ import annotations

import re
from rapidfuzz import fuzz

from ..models import PaperRef, TextAvailability


def normalize_doi(doi: str | None) -> str | None:
    """Lowercase, strip https://doi.org/ prefix, doi: prefix, and whitespace."""
    if not doi:
        return None
    d = doi.strip().lower()
    for prefix in (
        "https://doi.org/",
        "http://doi.org/",
        "https://dx.doi.org/",
        "http://dx.doi.org/",
        "doi:",
    ):
        if d.startswith(prefix):
            d = d[len(prefix) :].strip()
    d = d.strip("/")
    return d if d else None


def normalize_title(title: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    if not title:
        return ""
    # Lowercase and remove punctuation
    cleaned = re.sub(r"[^\w\s]", " ", title.lower())
    # Collapse multiple whitespaces
    return " ".join(cleaned.split())


def _merge_two_papers(primary: PaperRef, secondary: PaperRef) -> PaperRef:
    """Merge secondary paper metadata into primary paper, preferring richer data."""
    # Prefer full text availability if either has it
    availability = (
        TextAvailability.FULL_TEXT
        if primary.availability == TextAvailability.FULL_TEXT
        or secondary.availability == TextAvailability.FULL_TEXT
        else TextAvailability.ABSTRACT_ONLY
    )

    full_text = primary.full_text or secondary.full_text
    abstract = primary.abstract or secondary.abstract
    doi = primary.doi or secondary.doi
    authors = primary.authors if primary.authors else secondary.authors
    year = primary.year or secondary.year
    venue = primary.venue or secondary.venue
    url = primary.url or secondary.url
    oa_pdf_url = primary.oa_pdf_url or secondary.oa_pdf_url

    citation_count = primary.citation_count
    if secondary.citation_count is not None:
        if citation_count is None or secondary.citation_count > citation_count:
            citation_count = secondary.citation_count

    return PaperRef(
        id=primary.id,
        title=primary.title,
        source_api=primary.source_api,
        availability=availability,
        doi=doi,
        authors=authors,
        year=year,
        venue=venue,
        abstract=abstract,
        full_text=full_text,
        url=url,
        oa_pdf_url=oa_pdf_url,
        citation_count=citation_count,
    )


def merge(papers: list[PaperRef], *, title_threshold: float = 93.0) -> list[PaperRef]:
    """Collapse duplicates across sources into one PaperRef each."""
    if not papers:
        return []

    merged: list[PaperRef] = []
    doi_map: dict[str, int] = {}  # normalized_doi -> index in merged

    for paper in papers:
        norm_doi = normalize_doi(paper.doi)
        matched_idx: int | None = None

        if norm_doi and norm_doi in doi_map:
            matched_idx = doi_map[norm_doi]
        else:
            # Check fuzzy title match against already merged papers
            norm_title = normalize_title(paper.title)
            if norm_title:
                for idx, existing in enumerate(merged):
                    existing_norm_title = normalize_title(existing.title)
                    if existing_norm_title:
                        ratio = fuzz.token_sort_ratio(norm_title, existing_norm_title)
                        if ratio >= title_threshold:
                            matched_idx = idx
                            break

        if matched_idx is not None:
            # Merge with existing paper
            merged[matched_idx] = _merge_two_papers(merged[matched_idx], paper)
            if norm_doi and norm_doi not in doi_map:
                doi_map[norm_doi] = matched_idx
        else:
            new_idx = len(merged)
            merged.append(paper)
            if norm_doi:
                doi_map[norm_doi] = new_idx

    return merged


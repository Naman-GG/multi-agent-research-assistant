"""Merge the same paper found in several databases.

Order matters: DOI first (exact, after normalization), then fuzzy title match for the
DOI-less. When merging, prefer the record with full text, then the one with the most
complete metadata.

This is a likely viva question -- "how do you know two results are the same paper?"

TODO(Track B): implement normalize_doi, normalize_title, merge.
"""
from __future__ import annotations

import re
from rapidfuzz import fuzz

from ..models import PaperRef, TextAvailability

STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "up", "about", "into", "over", "after",
    "is", "are", "was", "were", "be", "been", "being", "that", "this",
    "it", "as", "via", "using", "study", "studies", "an",
}


def normalize_doi(doi: str | None) -> str | None:
    """Lowercase, strip https://doi.org/ prefix and whitespace."""
    if not doi:
        return None
    cleaned = doi.strip().lower()
    prefixes = [
        "https://doi.org/",
        "http://doi.org/",
        "https://dx.doi.org/",
        "http://dx.doi.org/",
        "doi.org/",
        "doi:",
    ]
    for prefix in prefixes:
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
            break
    cleaned = cleaned.strip(" /")
    return cleaned if cleaned else None


def normalize_title(title: str) -> str:
    """Lowercase, strip punctuation and stop-words, collapse whitespace."""
    if not title:
        return ""
    # Lowercase
    cleaned = title.lower()
    # Strip punctuation (keep alphanumeric and spaces)
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    # Filter stop words and collapse whitespace
    words = [w for w in cleaned.split() if w not in STOP_WORDS]
    if not words:
        # Fallback to all non-whitespace words if all were stopwords
        words = cleaned.split()
    return " ".join(words).strip()


def _merge_pair(primary: PaperRef, secondary: PaperRef) -> PaperRef:
    """Merge two PaperRef records into one, prioritizing full text and rich metadata."""
    # Availability & full text
    if primary.availability == TextAvailability.FULL_TEXT and primary.full_text:
        availability = TextAvailability.FULL_TEXT
        full_text = primary.full_text
    elif secondary.availability == TextAvailability.FULL_TEXT and secondary.full_text:
        availability = TextAvailability.FULL_TEXT
        full_text = secondary.full_text
    else:
        availability = TextAvailability.ABSTRACT_ONLY
        full_text = None

    doi = primary.doi or secondary.doi
    
    # Abstract: take the longer one
    prim_abs = primary.abstract or ""
    sec_abs = secondary.abstract or ""
    abstract = primary.abstract if len(prim_abs) >= len(sec_abs) else secondary.abstract

    year = primary.year if primary.year is not None else secondary.year
    venue = primary.venue or secondary.venue
    authors = primary.authors if len(primary.authors) >= len(secondary.authors) else secondary.authors
    url = primary.url or secondary.url
    oa_pdf_url = primary.oa_pdf_url or secondary.oa_pdf_url

    # Citation count
    cit1 = primary.citation_count
    cit2 = secondary.citation_count
    if cit1 is not None and cit2 is not None:
        citation_count = max(cit1, cit2)
    elif cit1 is not None:
        citation_count = cit1
    else:
        citation_count = cit2

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

    # Step 1: Group by normalized DOI
    doi_groups: dict[str, list[PaperRef]] = {}
    no_doi_papers: list[PaperRef] = []

    for paper in papers:
        norm_doi = normalize_doi(paper.doi)
        if norm_doi:
            doi_groups.setdefault(norm_doi, []).append(paper)
        else:
            no_doi_papers.append(paper)

    # Merge DOI groups
    merged_doi_records: list[PaperRef] = []
    for group in doi_groups.values():
        res = group[0]
        for item in group[1:]:
            res = _merge_pair(res, item)
        merged_doi_records.append(res)

    # Step 2: Merge remaining no-DOI papers and check against existing records by title
    candidates: list[PaperRef] = merged_doi_records + no_doi_papers
    final_clusters: list[PaperRef] = []

    for paper in candidates:
        norm_title = normalize_title(paper.title)
        matched_idx = -1

        for idx, existing in enumerate(final_clusters):
            existing_norm_title = normalize_title(existing.title)
            if not norm_title or not existing_norm_title:
                continue
            score = fuzz.token_sort_ratio(norm_title, existing_norm_title)
            if score >= title_threshold:
                matched_idx = idx
                break

        if matched_idx >= 0:
            final_clusters[matched_idx] = _merge_pair(final_clusters[matched_idx], paper)
        else:
            final_clusters.append(paper)

    return final_clusters


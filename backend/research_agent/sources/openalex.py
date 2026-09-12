import os
import re
from typing import Any

import httpx

from ..config import settings
from ..models import Author, PaperRef, SubQuery, TextAvailability


def _strip_operators(text: str) -> str:
    """Remove characters OpenAlex reads as query operators."""
    return " ".join(text.replace("?", " ").replace("*", " ").split())


def reconstruct_abstract(inverted_index: dict[str, list[int]] | None) -> str | None:
    """Turn OpenAlex's abstract_inverted_index back into readable text."""
    if not inverted_index:
        return None

    pos_map: dict[int, str] = {}
    for word, positions in inverted_index.items():
        for pos in positions:
            pos_map[pos] = word

    if not pos_map:
        return None

    sorted_positions = sorted(pos_map.keys())
    sorted_words = [pos_map[p] for p in sorted_positions]
    text = " ".join(sorted_words).strip()
    return text if text else None


class OpenAlexSource:
    name = "openalex"

    def __init__(self, *, client: httpx.AsyncClient | None = None) -> None:
        self._client = client

    def _get_headers(self) -> dict[str, str]:
        email = settings.contact_email or os.getenv("CONTACT_EMAIL", "")
        headers = {
            "Accept": "application/json",
        }
        if email:
            headers["User-Agent"] = f"MultiAgentResearchAssistant/1.0 (mailto:{email})"
        else:
            headers["User-Agent"] = "MultiAgentResearchAssistant/1.0"
        return headers

    async def search(self, query: SubQuery, *, limit: int = 20) -> list[PaperRef]:
        """Query https://api.openalex.org/works for papers matching query."""
        # Query on keywords, not the sub-question. OpenAlex treats '?' and '*' as
        # wildcard operators and returns 400 for a question-shaped search string --
        # and the Planner emits questions, so passing `text` raw fails every time.
        search_terms = " ".join(query.keywords).strip()
        if not search_terms:
            search_terms = query.text.strip()
        search_terms = _strip_operators(search_terms)

        params: dict[str, Any] = {
            "search": search_terms,
            "per_page": min(limit, 50),
            "sort": "relevance_score:desc",
        }

        headers = self._get_headers()
        url = "https://api.openalex.org/works"

        if self._client:
            response = await self._client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
        else:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                data = response.json()

        results = data.get("results", [])
        papers: list[PaperRef] = []

        for item in results:
            title = item.get("title") or item.get("display_name")
            if not title:
                continue

            work_id = item.get("id", "")
            # Extract clean ID from openalex URI if present, e.g. "https://openalex.org/W12345" -> "W12345"
            paper_id = work_id.split("/")[-1] if "/" in work_id else work_id
            if not paper_id:
                paper_id = f"oa_{len(papers)+1}"

            doi_raw = item.get("doi")
            doi = doi_raw.strip() if doi_raw else None

            authors: list[Author] = []
            for authorship in item.get("authorships", []):
                author_info = authorship.get("author", {})
                author_name = author_info.get("display_name") or authorship.get("raw_author_name")
                if author_name:
                    orcid = author_info.get("orcid")
                    authors.append(Author(name=author_name.strip(), orcid=orcid))

            primary_loc = item.get("primary_location") or {}
            source_info = primary_loc.get("source") or {}
            venue = source_info.get("display_name") or (item.get("host_venue") or {}).get("display_name")

            abstract = reconstruct_abstract(item.get("abstract_inverted_index"))

            oa_info = item.get("open_access") or {}
            oa_pdf_url = oa_info.get("oa_url") or primary_loc.get("pdf_url")

            paper = PaperRef(
                id=paper_id,
                title=title.strip(),
                source_api="openalex",
                availability=TextAvailability.ABSTRACT_ONLY,
                doi=doi,
                authors=authors,
                year=item.get("publication_year"),
                venue=venue.strip() if venue else None,
                abstract=abstract,
                full_text=None,
                url=doi or work_id or None,
                oa_pdf_url=oa_pdf_url,
                citation_count=item.get("cited_by_count"),
            )
            papers.append(paper)
            if len(papers) >= limit:
                break

        return papers


"""OpenAlex -- the primary source. No API key, generous limits, excellent metadata.

Two gotchas worth knowing before you start:
  1. Abstracts come back as an INVERTED INDEX ({word: [positions]}), not a string.
     You have to reconstruct them -- see reconstruct_abstract below.
  2. Putting CONTACT_EMAIL in the User-Agent moves you to the faster "polite pool".

TODO(Track B): implement search() against https://api.openalex.org/works
"""
from __future__ import annotations

import httpx

from ..config import settings
from ..models import Author, PaperRef, SubQuery, TextAvailability


def reconstruct_abstract(inverted_index: dict[str, list[int]] | None) -> str | None:
    """Turn OpenAlex's abstract_inverted_index back into readable text.

    Places each word at each of its positions, then joins with space.
    """
    if not inverted_index:
        return None

    positions_map: dict[int, str] = {}
    for word, positions in inverted_index.items():
        for pos in positions:
            positions_map[pos] = word

    if not positions_map:
        return None

    max_pos = max(positions_map.keys())
    words = [positions_map.get(i, "") for i in range(max_pos + 1)]
    reconstructed = " ".join(w for w in words if w).strip()
    return reconstructed if reconstructed else None


class OpenAlexSource:
    name = "openalex"

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client

    async def search(self, query: SubQuery, *, limit: int = 20) -> list[PaperRef]:
        """Search OpenAlex works for a sub-query."""
        search_terms = " ".join(query.keywords).strip() if query.keywords else query.text.strip()
        if not search_terms:
            return []

        contact = settings.contact_email or "research-agent@example.com"
        headers = {
            "User-Agent": f"ResearchAgent/1.0 (mailto:{contact})",
            "Accept": "application/json",
        }
        params: dict[str, str | int] = {
            "search": search_terms,
            "per_page": limit,
        }
        if settings.contact_email:
            params["mailto"] = settings.contact_email

        url = "https://api.openalex.org/works"

        if self._client:
            resp = await self._client.get(url, params=params, headers=headers, timeout=20.0)
            resp.raise_for_status()
            data = resp.json()
        else:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(url, params=params, headers=headers)
                resp.raise_for_status()
                data = resp.json()

        results = data.get("results", [])
        papers: list[PaperRef] = []

        for item in results:
            raw_id = item.get("id", "")
            clean_id = raw_id.split("/")[-1] if raw_id else f"oa_{len(papers)}"
            paper_id = f"oa_{clean_id}"

            title = item.get("display_name") or item.get("title") or "Untitled Paper"

            # Parse authors
            authors: list[Author] = []
            for authorship in item.get("authorships", []):
                author_obj = authorship.get("author", {})
                name = author_obj.get("display_name")
                orcid = author_obj.get("orcid")
                if name:
                    authors.append(Author(name=name, orcid=orcid))

            # Abstract reconstruction
            raw_abstract_index = item.get("abstract_inverted_index")
            abstract = reconstruct_abstract(raw_abstract_index)

            # Venue
            venue = None
            primary_loc = item.get("primary_location") or {}
            source_info = primary_loc.get("source") or {}
            if source_info.get("display_name"):
                venue = source_info.get("display_name")
            elif item.get("host_venue", {}).get("display_name"):
                venue = item.get("host_venue", {}).get("display_name")

            # Open Access PDF
            oa_info = item.get("open_access") or {}
            oa_pdf_url = oa_info.get("oa_url") or primary_loc.get("pdf_url")

            # URL
            landing_url = item.get("doi") or primary_loc.get("landing_page_url") or raw_id

            paper = PaperRef(
                id=paper_id,
                title=title,
                source_api=self.name,
                availability=TextAvailability.ABSTRACT_ONLY,
                doi=item.get("doi"),
                authors=authors,
                year=item.get("publication_year"),
                venue=venue,
                abstract=abstract,
                full_text=None,
                url=landing_url,
                oa_pdf_url=oa_pdf_url,
                citation_count=item.get("cited_by_count"),
            )
            papers.append(paper)

        return papers


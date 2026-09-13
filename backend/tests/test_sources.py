import pytest
import httpx
from research_agent.models import Author, PaperRef, SubQuery, SubQueryIntent, TextAvailability
from research_agent.sources.openalex import OpenAlexSource, reconstruct_abstract
from research_agent.sources.dedupe import normalize_doi, normalize_title, merge


def test_reconstruct_abstract_basic():
    inverted_index = {
        "Dexamethasone": [0],
        "reduced": [1],
        "28-day": [2],
        "mortality": [3],
        "in": [4],
        "COVID-19": [5],
        "patients.": [6],
    }
    expected = "Dexamethasone reduced 28-day mortality in COVID-19 patients."
    assert reconstruct_abstract(inverted_index) == expected


def test_reconstruct_abstract_multiple_positions_and_empty():
    inverted_index = {
        "the": [0, 4],
        "treatment": [1],
        "and": [2],
        "outcome": [3],
        "patients": [5],
    }
    assert reconstruct_abstract(inverted_index) == "the treatment and outcome the patients"
    assert reconstruct_abstract(None) is None
    assert reconstruct_abstract({}) is None


def test_normalize_doi():
    assert normalize_doi("https://doi.org/10.1056/NEJMoa2021436") == "10.1056/nejmoa2021436"
    assert normalize_doi("http://dx.doi.org/10.1056/NEJMoa2021436/") == "10.1056/nejmoa2021436"
    assert normalize_doi("doi:10.1056/NEJMoa2021436") == "10.1056/nejmoa2021436"
    assert normalize_doi("  10.1056/NEJMoa2021436  ") == "10.1056/nejmoa2021436"
    assert normalize_doi(None) is None
    assert normalize_doi("") is None


def test_normalize_title():
    t1 = "Effect of Dexamethasone in Hospitalized Patients with COVID-19: A Randomized Trial."
    t2 = "effect of dexamethasone in hospitalized patients with covid-19 a randomized trial"
    assert normalize_title(t1) == normalize_title(t2)
    assert "dexamethasone" in normalize_title(t1)
    assert normalize_title("") == ""


def test_merge_by_doi():
    p1 = PaperRef(
        id="p1",
        title="Dexamethasone in Hospitalized Patients with Covid-19",
        source_api="openalex",
        availability=TextAvailability.ABSTRACT_ONLY,
        doi="https://doi.org/10.1056/nejmoa2021436",
        abstract="Short abstract",
        authors=[Author(name="RC Group")],
        year=2021,
        venue="NEJM",
        citation_count=5000,
    )
    p2 = PaperRef(
        id="p2",
        title="Dexamethasone in Hospitalized Patients with Covid-19 - Full",
        source_api="arxiv",
        availability=TextAvailability.FULL_TEXT,
        doi="10.1056/NEJMoa2021436",
        abstract="Longer abstract describing the RCT in depth.",
        full_text="Full text content of the dexamethasone trial...",
        authors=[Author(name="RC Group"), Author(name="P. Horby")],
        year=2021,
        venue="New England Journal of Medicine",
        citation_count=5200,
    )

    merged = merge([p1, p2])
    assert len(merged) == 1
    m = merged[0]
    assert m.availability == TextAvailability.FULL_TEXT
    assert m.full_text == "Full text content of the dexamethasone trial..."
    assert len(m.authors) == 2
    assert m.citation_count == 5200


def test_merge_by_fuzzy_title_without_doi():
    p1 = PaperRef(
        id="p1",
        title="Deep Residual Learning for Image Recognition",
        source_api="openalex",
        availability=TextAvailability.ABSTRACT_ONLY,
        doi=None,
        abstract="We present a residual learning framework.",
        citation_count=100000,
    )
    p2 = PaperRef(
        id="p2",
        title="Deep Residual Learning for Image Recognition.",
        source_api="crossref",
        availability=TextAvailability.ABSTRACT_ONLY,
        doi=None,
        abstract="We present a residual learning framework to ease the training of networks.",
        citation_count=105000,
    )
    p3 = PaperRef(
        id="p3",
        title="Attention Is All You Need",
        source_api="arxiv",
        availability=TextAvailability.ABSTRACT_ONLY,
        doi=None,
        abstract="The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.",
        citation_count=90000,
    )

    merged = merge([p1, p2, p3])
    assert len(merged) == 2
    titles = [m.title for m in merged]
    assert "Attention Is All You Need" in titles


@pytest.mark.asyncio
async def test_openalex_search_mocked():
    sample_response = {
        "results": [
            {
                "id": "https://openalex.org/W2741809807",
                "display_name": "Dexamethasone in COVID-19",
                "doi": "https://doi.org/10.1056/nejmoa2021436",
                "publication_year": 2021,
                "cited_by_count": 5500,
                "primary_location": {
                    "source": {"display_name": "New England Journal of Medicine"},
                    "landing_page_url": "https://doi.org/10.1056/nejmoa2021436",
                    "pdf_url": "https://example.com/pdf.pdf",
                },
                "authorships": [
                    {"author": {"display_name": "Peter Horby", "orcid": "https://orcid.org/0000-0001"}}
                ],
                "abstract_inverted_index": {
                    "Dexamethasone": [0],
                    "reduced": [1],
                    "mortality.": [2],
                },
            }
        ]
    }

    class MockTransport(httpx.AsyncBaseTransport):
        async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
            assert "User-Agent" in request.headers
            return httpx.Response(200, json=sample_response, request=request)

    async with httpx.AsyncClient(transport=MockTransport()) as client:
        source = OpenAlexSource(client=client)
        sq = SubQuery(
            id="sq1",
            text="Does dexamethasone reduce mortality?",
            keywords=["dexamethasone", "covid-19", "mortality"],
            intent=SubQueryIntent.FINDING,
        )
        results = await source.search(sq, limit=5)
        assert len(results) == 1
        paper = results[0]
        assert paper.id == "oa_W2741809807"
        assert paper.title == "Dexamethasone in COVID-19"
        assert paper.abstract == "Dexamethasone reduced mortality."
        assert paper.availability == TextAvailability.ABSTRACT_ONLY
        assert len(paper.authors) == 1
        assert paper.authors[0].name == "Peter Horby"

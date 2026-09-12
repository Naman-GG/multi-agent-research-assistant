"""SPEC for Stage 1 -- written before the implementation, on purpose.

The cases encode the real judgement call: PDF extraction noise must pass, and
fabrication must fail. Everything in between is threshold tuning -- which is a
result worth reporting, not a detail to hide.
"""
import pytest

from research_agent.models import Claim, PaperRef, TextAvailability, VerdictLabel
from research_agent.verification import span_check

SOURCE = (
    "Results. In the dexamethasone group, 28-day mortality among patients receiving "
    "invasive mechanical ventilation was 29.3%, as compared with 41.4% in the usual "
    "care group. No benefit was observed among patients not receiving respiratory support."
)


def _paper(text: str = SOURCE) -> PaperRef:
    return PaperRef(
        id="P1", title="Test paper", source_api="test",
        availability=TextAvailability.FULL_TEXT, full_text=text,
    )


def _claim(quote: str) -> Claim:
    return Claim(id="C1", paper_id="P1", text="A claim about mortality.", quote=quote)


def test_exact_quote_is_found():
    claim = _claim("28-day mortality among patients receiving invasive mechanical ventilation was 29.3%")
    verdict = span_check.check_span(claim, _paper())
    assert verdict.label is VerdictLabel.QUOTE_FOUND
    assert verdict.match_score == 100.0
    assert verdict.model is None          # no LLM used at Stage 1


def test_found_quote_gets_offsets_for_the_ui():
    quote = "No benefit was observed among patients not receiving respiratory support."
    claim = _claim(quote)
    span_check.check_span(claim, _paper())
    assert claim.quote_start is not None and claim.quote_end is not None
    assert SOURCE[claim.quote_start:claim.quote_end] == quote


def test_fabricated_quote_is_rejected():
    claim = _claim("Dexamethasone reduced mortality by 47% in all hospitalized patients.")
    verdict = span_check.check_span(claim, _paper())
    assert verdict.label is VerdictLabel.QUOTE_NOT_FOUND


def test_topically_similar_fabrication_is_still_rejected():
    """The hard case: same vocabulary, invented numbers. Must not slip through."""
    claim = _claim("28-day mortality among patients receiving invasive mechanical ventilation was 12.7%")
    verdict = span_check.check_span(claim, _paper())
    assert verdict.label is VerdictLabel.QUOTE_NOT_FOUND


@pytest.mark.parametrize("noisy", [
    "28-day mortality among patients  receiving invasive mechanical ventilation was 29.3%",   # double space
    "28-day mortality among patients receiving invasive mechani-\ncal ventilation was 29.3%",  # hyphenated
    "28-day mortality among patients receiving invasive mechanical ventilation was 29.3%",     # nbsp
    "28-day mortality among patients receiving invasive mechanical ventilation was 29.3%",   # smart quotes nearby
])
def test_pdf_extraction_noise_still_matches(noisy):
    """Extraction artifacts are not the model's fault and must not read as fabrication."""
    verdict = span_check.check_span(_claim(noisy), _paper())
    assert verdict.label is VerdictLabel.QUOTE_FOUND


def test_abstract_only_paper_searches_the_abstract():
    paper = PaperRef(
        id="P2", title="Abstract only", source_api="test",
        availability=TextAvailability.ABSTRACT_ONLY,
        abstract="Corticosteroids were associated with lower mortality.",
    )
    claim = Claim(id="C2", paper_id="P2", text="Lower mortality.",
                  quote="Corticosteroids were associated with lower mortality.")
    assert span_check.check_span(claim, paper).label is VerdictLabel.QUOTE_FOUND


def test_empty_source_rejects_rather_than_crashes():
    paper = PaperRef(id="P3", title="Empty", source_api="test",
                     availability=TextAvailability.ABSTRACT_ONLY)
    verdict = span_check.check_span(_claim("anything at all"), paper)
    assert verdict.label is VerdictLabel.QUOTE_NOT_FOUND

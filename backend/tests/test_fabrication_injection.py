"""Fabrication injection -- Capstone-Plan.pdf Part 4, "two tests worth writing early."

Take a real, honestly-quoted claim, corrupt its quote the way a hallucinating model
would (swap the number), and prove the Critic rejects it -- for free, at Stage 1,
without spending a single Stage 2 LLM call. This is the demo moment: a claim beside
the source paper its quote never actually appears in.
"""
from research_agent.agents.critic import verify_all
from research_agent.llm.base import LLMResponse
from research_agent.models import Claim, PaperSummary, VerdictLabel, VerificationStage
from research_agent.verification.entailment import EntailmentResult
from tests.fakes import FAKE_PAPERS  # real paper text, shared across the test suite

PAPER = FAKE_PAPERS[0]  # dexamethasone RCT: "...29.3%, as compared with 41.4%..."

HONEST_QUOTE = (
    "In the dexamethasone group, 28-day mortality among patients receiving invasive "
    "mechanical ventilation was 29.3%, as compared with 41.4% in the usual care group."
)
CORRUPTED_QUOTE = HONEST_QUOTE.replace("29.3%", "12.7%")


class _RefusingLLM:
    """A Stage 2 call here is a bug, not a fallback -- fail loudly if one happens."""

    async def complete(self, prompt, *, model, temperature=0.0):
        raise AssertionError("Stage 2 must never be called for a Stage-1 rejection")

    async def complete_json(self, prompt, *, model, schema, temperature=0.0):
        raise AssertionError("Stage 2 must never be called for a Stage-1 rejection")


class _AlwaysSupportsLLM:
    """Stage 2 stub for the honest-claim path -- Stage 1 must pass first regardless."""

    async def complete(self, prompt, *, model, temperature=0.0):
        raise NotImplementedError

    async def complete_json(self, prompt, *, model, schema, temperature=0.0):
        result = EntailmentResult(label=VerdictLabel.SUPPORTED, confidence=0.95, reasoning="matches")
        return result, LLMResponse(text="", model=model)


async def test_honest_claim_is_supported():
    claim = Claim(id="C-honest", paper_id=PAPER.id, text="Dexamethasone lowered 28-day "
                 "mortality in ventilated patients.", quote=HONEST_QUOTE)

    verdicts = await verify_all(
        [PaperSummary(id="S1", paper_id=PAPER.id, model="m", claims=[claim])],
        [PAPER], _AlwaysSupportsLLM(), model="m",
    )

    assert [v.label for v in verdicts] == [VerdictLabel.QUOTE_FOUND, VerdictLabel.SUPPORTED]
    assert claim.quote_start is not None
    assert PAPER.source_text()[claim.quote_start:claim.quote_end] == HONEST_QUOTE


async def test_fabricated_number_is_rejected_for_free_and_never_reaches_the_critic():
    """The same claim text, but the quote's number was invented -- the exact failure
    mode the capstone exists to catch, per Capstone-Plan.pdf Part 1 ("Fabrication").
    """
    claim = Claim(id="C-fabricated", paper_id=PAPER.id, text="Dexamethasone lowered "
                 "28-day mortality in ventilated patients.", quote=CORRUPTED_QUOTE)

    verdicts = await verify_all(
        [PaperSummary(id="S1", paper_id=PAPER.id, model="m", claims=[claim])],
        [PAPER], _RefusingLLM(), model="m",
    )

    assert len(verdicts) == 1
    assert verdicts[0].stage is VerificationStage.SPAN
    assert verdicts[0].label is VerdictLabel.QUOTE_NOT_FOUND
    assert claim.quote_start is None  # never got offsets -- nothing to highlight

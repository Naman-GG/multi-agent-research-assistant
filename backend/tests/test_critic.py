"""agents/critic.py -- the two-stage gate, wired end to end. No network.

Covers: Stage 1 rejections never reach Stage 2 (the cost-efficiency argument), a
PARTIAL verdict gets exactly one repair attempt, and verify_all() respects its
concurrency bound on the LLM calls it actually makes.
"""
import asyncio

from research_agent.agents.critic import verify_all
from research_agent.llm.base import LLMResponse
from research_agent.models import (
    Claim, PaperRef, PaperSummary, TextAvailability, VerdictLabel, VerificationStage,
)
from research_agent.verification.entailment import EntailmentResult, RepairResult

SOURCE = "28-day mortality among ventilated patients was 29.3%. No effect otherwise."


def _paper(id_="P1", text=SOURCE) -> PaperRef:
    return PaperRef(id=id_, title="t", source_api="test",
                    availability=TextAvailability.FULL_TEXT, full_text=text)


def _summary(paper_id: str, claims: list[Claim]) -> PaperSummary:
    return PaperSummary(id=f"S-{paper_id}", paper_id=paper_id, model="test", claims=claims)


class _ScriptedLLM:
    def __init__(self, **responses: list):
        self._queues = {name: list(values) for name, values in responses.items()}
        self.calls = 0

    async def complete(self, prompt, *, model, temperature=0.0):
        raise NotImplementedError

    async def complete_json(self, prompt, *, model, schema, temperature=0.0):
        self.calls += 1
        result = self._queues[schema.__name__].pop(0)
        return result, LLMResponse(text="", model=model)


async def test_fabricated_quote_never_reaches_stage_two():
    claim = Claim(id="C1", paper_id="P1", text="x", quote="Dexamethasone reduced mortality by 47%.")
    llm = _ScriptedLLM()  # no canned responses at all -- a Stage 2 call would KeyError

    verdicts = await verify_all([_summary("P1", [claim])], [_paper()], llm, model="m")

    assert len(verdicts) == 1
    assert verdicts[0].label is VerdictLabel.QUOTE_NOT_FOUND
    assert llm.calls == 0


async def test_supported_claim_gets_one_span_and_one_entailment_verdict():
    claim = Claim(id="C1", paper_id="P1", text="x",
                 quote="28-day mortality among ventilated patients was 29.3%")
    llm = _ScriptedLLM(EntailmentResult=[
        EntailmentResult(label=VerdictLabel.SUPPORTED, confidence=0.9, reasoning="ok")
    ])

    verdicts = await verify_all([_summary("P1", [claim])], [_paper()], llm, model="m")

    stages = [v.stage for v in verdicts]
    assert stages == [VerificationStage.SPAN, VerificationStage.ENTAILMENT]
    assert verdicts[1].label is VerdictLabel.SUPPORTED


async def test_partial_verdict_gets_exactly_one_repair_attempt_that_succeeds():
    claim = Claim(id="C1", paper_id="P1", text="Mortality dropped in everyone.",
                 quote="28-day mortality among ventilated patients was 29.3%")
    llm = _ScriptedLLM(
        EntailmentResult=[
            EntailmentResult(label=VerdictLabel.PARTIAL, confidence=0.5, reasoning="too broad"),
            EntailmentResult(label=VerdictLabel.SUPPORTED, confidence=0.9, reasoning="narrowed, ok"),
        ],
        RepairResult=[RepairResult(text="Mortality dropped in ventilated patients.")],
    )

    verdicts = await verify_all([_summary("P1", [claim])], [_paper()], llm, model="m")

    assert [v.label for v in verdicts] == [
        VerdictLabel.QUOTE_FOUND, VerdictLabel.PARTIAL, VerdictLabel.SUPPORTED,
    ]
    assert verdicts[-1].is_repair_attempt is True
    assert claim.text == "Mortality dropped in ventilated patients."  # repaired in place
    assert llm.calls == 3  # 1 entailment + 1 repair + 1 re-verify -- never a second repair


async def test_partial_verdict_stays_partial_when_repair_is_unsupportable():
    claim = Claim(id="C1", paper_id="P1", text="x",
                 quote="28-day mortality among ventilated patients was 29.3%")
    llm = _ScriptedLLM(
        EntailmentResult=[EntailmentResult(label=VerdictLabel.PARTIAL, confidence=0.5, reasoning="broad")],
        RepairResult=[RepairResult(text=None)],
    )

    verdicts = await verify_all([_summary("P1", [claim])], [_paper()], llm, model="m")

    assert [v.label for v in verdicts] == [VerdictLabel.QUOTE_FOUND, VerdictLabel.PARTIAL]
    assert llm.calls == 2  # entailment + the failed repair attempt, no retry verify


async def test_dropped_negation_slips_past_stage_one_but_stage_two_catches_it():
    """A model that drops "not" flips meaning entirely, but the edit is short, has no
    digits, and still scores ~94/100 against the real sentence -- above the 92
    threshold. Stage 1 alone would call this QUOTE_FOUND. What must NOT happen is
    Stage 2 judging the claim against that same edited quote and calling it
    SUPPORTED; it must judge against the real source text instead.
    """
    negation_source = (
        "Results. In the dexamethasone group, 28-day mortality among patients receiving "
        "invasive mechanical ventilation was 29.3%, as compared with 41.4% in the usual "
        "care group. No benefit was observed among patients not receiving respiratory support."
    )
    claim = Claim(id="C1", paper_id="P1", text="No benefit was seen in unventilated patients.",
                 # the model's own quote drops "not" -- the source says the opposite
                 quote="No benefit was observed among patients receiving respiratory support.")
    llm = _ScriptedLLM(EntailmentResult=[
        EntailmentResult(label=VerdictLabel.CONTRADICTED, confidence=0.9,
                        reasoning="the source says 'not receiving', the claim says the opposite")
    ])

    verdicts = await verify_all([_summary("P1", [claim])], [_paper(text=negation_source)], llm, model="m")

    span_verdict, entailment_verdict = verdicts
    assert span_verdict.label is VerdictLabel.QUOTE_FOUND      # Stage 1 was fooled, as expected
    assert 92.0 <= span_verdict.match_score < 100.0            # a fuzzy match, not exact
    assert entailment_verdict.label is VerdictLabel.CONTRADICTED  # Stage 2 was not


async def test_verify_all_respects_the_concurrency_bound():
    class _ConcurrencyTrackingLLM:
        def __init__(self):
            self.active = 0
            self.max_active = 0

        async def complete(self, prompt, *, model, temperature=0.0):
            raise NotImplementedError

        async def complete_json(self, prompt, *, model, schema, temperature=0.0):
            self.active += 1
            self.max_active = max(self.max_active, self.active)
            await asyncio.sleep(0.01)
            self.active -= 1
            return (EntailmentResult(label=VerdictLabel.SUPPORTED, confidence=0.9, reasoning="ok"),
                   LLMResponse(text="", model=model))

    quote = "28-day mortality among ventilated patients was 29.3%"
    claims = [Claim(id=f"C{i}", paper_id="P1", text="x", quote=quote) for i in range(10)]
    llm = _ConcurrencyTrackingLLM()

    await verify_all([_summary("P1", claims)], [_paper()], llm, model="m", concurrency=2)

    assert llm.max_active <= 2

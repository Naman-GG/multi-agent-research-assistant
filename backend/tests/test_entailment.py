"""Stage 2 -- the LLM Critic, in isolation. No network: a scripted fake LLM stands in.

verify_claim() must see ONLY the claim text and quote -- never the paper, the other
claims, or the research question. That isolation is what makes cross-paper
misattribution structurally impossible, so it is worth asserting directly, not just
assuming from the function signature.
"""
from research_agent.llm.base import LLMResponse
from research_agent.models import Claim, Verdict, VerdictLabel, VerificationStage
from research_agent.verification.entailment import EntailmentResult, RepairResult, repair_claim, verify_claim


class _ScriptedLLM:
    """Returns one canned response per schema, in order. Records every prompt."""

    def __init__(self, **responses: list):
        self._queues = {name: list(values) for name, values in responses.items()}
        self.prompts: list[str] = []

    async def complete(self, prompt, *, model, temperature=0.0):
        raise NotImplementedError

    async def complete_json(self, prompt, *, model, schema, temperature=0.0):
        self.prompts.append(prompt)
        result = self._queues[schema.__name__].pop(0)
        return result, LLMResponse(text="", model=model)


def _claim(text="Dexamethasone lowered mortality.", quote="28-day mortality was 29.3%") -> Claim:
    return Claim(id="C1", paper_id="P1", text=text, quote=quote)


async def test_verify_claim_returns_supported_verdict():
    claim = _claim()
    llm = _ScriptedLLM(EntailmentResult=[
        EntailmentResult(label=VerdictLabel.SUPPORTED, confidence=0.95, reasoning="direct match")
    ])
    verdict = await verify_claim(claim, claim.quote, llm, model="test-model")

    assert verdict.stage is VerificationStage.ENTAILMENT
    assert verdict.label is VerdictLabel.SUPPORTED
    assert verdict.confidence == 0.95
    assert verdict.model == "test-model"
    assert verdict.is_repair_attempt is False


async def test_verify_claim_sees_only_the_claim_and_quote():
    """The isolation guarantee: no paper text, no other claims, no research question."""
    claim = _claim(text="Dexamethasone lowered mortality.", quote="28-day mortality was 29.3%")
    llm = _ScriptedLLM(EntailmentResult=[
        EntailmentResult(label=VerdictLabel.SUPPORTED, confidence=0.9, reasoning="ok")
    ])
    await verify_claim(claim, claim.quote, llm, model="test-model")

    prompt = llm.prompts[0]
    assert claim.text in prompt
    assert claim.quote in prompt
    # nothing else identifies this claim's paper, so an unrelated marker cannot leak in
    assert "P1" not in prompt


async def test_verify_claim_judges_the_real_source_text_not_claim_quote():
    """The quote passed in -- not claim.quote -- is what reaches the prompt.

    This is what closes the gap a fuzzy Stage-1 match can open: if the model's
    self-reported quote dropped a "not", claim.quote alone would read as a plain
    match. The caller (agents/critic.py) is responsible for passing the actual
    matched source text here instead.
    """
    claim = _claim(text="Dexamethasone reduced mortality.",
                   quote="Dexamethasone reduced mortality in ventilated patients.")
    real_source_text = "Dexamethasone did NOT reduce mortality in ventilated patients."
    llm = _ScriptedLLM(EntailmentResult=[
        EntailmentResult(label=VerdictLabel.CONTRADICTED, confidence=0.95,
                        reasoning="the source explicitly denies this")
    ])

    verdict = await verify_claim(claim, real_source_text, llm, model="test-model")

    assert real_source_text in llm.prompts[0]
    assert claim.quote not in llm.prompts[0]   # the model's own quote never reaches the Critic
    assert verdict.label is VerdictLabel.CONTRADICTED


async def test_repair_claim_narrows_the_text_and_keeps_the_quote_fixed():
    claim = _claim(text="Dexamethasone lowered mortality in every patient.",
                   quote="28-day mortality among ventilated patients was 29.3%")
    partial_verdict = Verdict(
        claim_id=claim.id, stage=VerificationStage.ENTAILMENT, label=VerdictLabel.PARTIAL,
        reasoning="quote covers only ventilated patients, claim says everyone",
    )
    llm = _ScriptedLLM(RepairResult=[
        RepairResult(text="Dexamethasone lowered mortality in ventilated patients.")
    ])

    repaired = await repair_claim(claim, claim.quote, partial_verdict, llm, model="test-model")

    assert repaired is not None
    assert repaired.id == claim.id
    assert repaired.quote == claim.quote          # the quote is fixed, never changed
    assert repaired.text == "Dexamethasone lowered mortality in ventilated patients."


async def test_repair_claim_returns_none_when_unsupportable():
    claim = _claim()
    partial_verdict = Verdict(
        claim_id=claim.id, stage=VerificationStage.ENTAILMENT, label=VerdictLabel.PARTIAL,
        reasoning="unsalvageable",
    )
    llm = _ScriptedLLM(RepairResult=[RepairResult(text=None)])

    assert await repair_claim(claim, claim.quote, partial_verdict, llm, model="test-model") is None

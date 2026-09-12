"""STAGE 2 -- the LLM Critic. Does the quote actually SUPPORT the claim?

The critical design constraint: the Critic sees ONLY the claim and its one quote.
Not the paper. Not the other papers. Not the research question. That isolation is
what makes cross-paper misattribution structurally impossible rather than merely
unlikely -- and it is the answer to "why is this better than one big prompt?"

That one quote must be the text Stage 1 actually matched in the paper --
paper.source_text()[claim.quote_start:claim.quote_end] -- never claim.quote itself.
Stage 1's fuzzy threshold exists to tolerate PDF-extraction noise, but the same
tolerance can wave through a small semantic edit: dropping a "not" changes meaning
completely, scores ~94/100, and carries no digits for the Stage 1 number guard to
catch. Judging against the real source text closes that gap -- the Critic then sees
what the paper actually says, so a flipped claim surfaces as CONTRADICTED or
UNSUPPORTED instead of slipping through on a high fuzzy score.

Labels: SUPPORTED / PARTIAL / UNSUPPORTED / CONTRADICTED.

PARTIAL gets exactly ONE repair attempt: ask the Summarizer to restate the claim so
the quote fully supports it, then re-verify once. One attempt, not a loop -- an
unbounded repair loop burns free-tier quota and can drift arbitrarily far from the
source.

Only SUPPORTED claims (originals or repaired) reach the final report.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from ..llm.base import LLMClient
from ..models import Claim, Verdict, VerdictLabel, VerificationStage
from ..prompts import render


class EntailmentResult(BaseModel):
    """Structured output schema for the Critic. Pass to LLMClient.complete_json."""

    label: VerdictLabel = Field(description="supported | partial | unsupported | contradicted")
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(description="One sentence. Why this label.")


class RepairResult(BaseModel):
    """Structured output schema for the repair step."""

    text: str | None = Field(
        default=None,
        description="Restated claim the quote fully supports, or null if none exists.",
    )


async def verify_claim(
    claim: Claim, quote: str, llm: LLMClient, *, model: str, is_repair_attempt: bool = False
) -> Verdict:
    """Judge one (claim, quote) pair in isolation.

    `quote` must be the verbatim source text Stage 1 matched, not claim.quote --
    see the module docstring for why the distinction matters.
    """
    prompt = render("critic", claim_text=claim.text, quote=quote)
    result, _ = await llm.complete_json(prompt, model=model, schema=EntailmentResult)
    return Verdict(
        claim_id=claim.id,
        stage=VerificationStage.ENTAILMENT,
        label=result.label,
        confidence=result.confidence,
        reasoning=result.reasoning,
        model=model,
        is_repair_attempt=is_repair_attempt,
    )


async def repair_claim(
    claim: Claim, quote: str, verdict: Verdict, llm: LLMClient, *, model: str
) -> Claim | None:
    """One attempt to restate a PARTIAL claim so `quote` -- the real source text --
    fully supports it.

    The quote is fixed -- only the claim text may change. Returns None if repair fails.
    """
    prompt = render("repair", claim_text=claim.text, quote=quote, reasoning=verdict.reasoning or "")
    result, _ = await llm.complete_json(prompt, model=model, schema=RepairResult)
    if not result.text or not result.text.strip():
        return None
    return claim.model_copy(update={"text": result.text.strip()})

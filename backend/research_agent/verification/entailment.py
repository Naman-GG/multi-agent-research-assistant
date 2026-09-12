"""STAGE 2 -- the LLM Critic. Does the quote actually SUPPORT the claim?

The critical design constraint: the Critic sees ONLY the claim and its one quote.
Not the paper. Not the other papers. Not the research question. That isolation is
what makes cross-paper misattribution structurally impossible rather than merely
unlikely -- and it is the answer to "why is this better than one big prompt?"

Labels: SUPPORTED / PARTIAL / UNSUPPORTED / CONTRADICTED.

PARTIAL gets exactly ONE repair attempt: ask the Summarizer to restate the claim so
the quote fully supports it, then re-verify once. One attempt, not a loop -- an
unbounded repair loop burns free-tier quota and can drift arbitrarily far from the
source.

Only SUPPORTED claims (originals or repaired) reach the final report.

TODO(Track C): implement verify_claim() and repair_claim().
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from ..llm.base import LLMClient
from ..models import Claim, Verdict, VerdictLabel


class EntailmentResult(BaseModel):
    """Structured output schema for the Critic. Pass to LLMClient.complete_json."""

    label: VerdictLabel = Field(description="supported | partial | unsupported | contradicted")
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(description="One sentence. Why this label.")


async def verify_claim(claim: Claim, llm: LLMClient, *, model: str) -> Verdict:
    """Judge one (claim, quote) pair in isolation."""
    raise NotImplementedError("TODO(Track C)")


async def repair_claim(claim: Claim, verdict: Verdict, llm: LLMClient, *, model: str) -> Claim | None:
    """One attempt to restate a PARTIAL claim so its existing quote fully supports it.

    The quote is fixed -- only the claim text may change. Returns None if repair fails.
    """
    raise NotImplementedError("TODO(Track C)")

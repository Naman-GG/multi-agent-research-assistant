"""Summarizer -- ONE paper at a time, in an isolated context.

THE RULE: this agent does not write prose. It emits atomic claims, each paired with a
quote copied verbatim from the paper. The isolation is the design, not an optimization
-- a model that only ever sees one paper cannot blur findings across papers or
misattribute them.

We do not verify quotes here. That is Stage 1's job, deliberately: measuring how often
the Summarizer fabricates is a result the evaluation reports, so silently dropping bad
quotes at this layer would destroy the measurement.
"""
from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

from ..llm.base import LLMClient
from ..models import Claim, PaperRef, PaperSummary, TextAvailability
from ..prompts import render

_ABSTRACT_NOTE = (
    "NOTE: only this paper's abstract is available, not its full text. "
    "Extract fewer claims rather than stretching what the abstract supports."
)


class ClaimDraft(BaseModel):
    """What the model is asked to produce -- deliberately NOT the storage model.

    No id and no paper_id: attribution is ours to assign, and a model that cannot
    name a paper cannot cite a claim to the wrong one. Keeping the schema this small
    also cuts tokens on the highest-volume call in the pipeline.
    """

    text: str = Field(description="One atomic factual claim, in your own words.")
    quote: str = Field(description="Verbatim span from the paper supporting the claim.")
    section: str = Field(default="", description="Abstract | Methods | Results | Discussion")


class ClaimList(BaseModel):
    """Structured output schema for the Summarizer."""

    claims: list[ClaimDraft]


async def summarize_paper(
    paper: PaperRef, llm: LLMClient, *, model: str, max_claims: int = 8
) -> PaperSummary:
    source = paper.source_text()
    if not source.strip():
        # No text at all -- retrieval gave us metadata only. Zero claims is the honest
        # outcome; inventing any would be exactly the failure this project exists to stop.
        return PaperSummary(id=f"S-{uuid.uuid4().hex[:8]}", paper_id=paper.id, model=model)

    prompt = render(
        "summarizer",
        title=paper.title,
        source_text=source,
        max_claims=max_claims,
        availability_note=(
            _ABSTRACT_NOTE if paper.availability is TextAvailability.ABSTRACT_ONLY else ""
        ),
    )
    result, _ = await llm.complete_json(prompt, model=model, schema=ClaimList)

    summary_id = f"S-{uuid.uuid4().hex[:8]}"
    claims: list[Claim] = []
    for draft in result.claims[:max_claims]:
        if not draft.text.strip() or not draft.quote.strip():
            continue  # an empty claim or quote is noise, not a finding
        # Ids and attribution are ours to assign, never the model's.
        claims.append(Claim(
            id=f"C-{uuid.uuid4().hex[:8]}",
            paper_id=paper.id,
            text=draft.text,
            quote=draft.quote,
            section=draft.section or None,
        ))

    return PaperSummary(id=summary_id, paper_id=paper.id, model=model, claims=claims)

"""Summarizer -- ONE paper at a time, in an isolated context.

THE RULE: this agent is not allowed to write prose. It emits atomic claims, each
paired with a quote copied VERBATIM from the paper's source text. If you find
yourself prompting it for "a summary", you have broken the project.

The isolation is the design, not an optimization -- a model that only ever sees one
paper cannot blur findings across papers or misattribute them. Fan out for speed with
a semaphore; never batch papers into one prompt.

Prompt guidance: instruct the model to copy quotes character-for-character and to skip
a finding entirely rather than paraphrase a quote it cannot reproduce exactly. A
skipped claim costs coverage; a paraphrased quote corrupts Stage 1.

TODO(Track A): implement with llm.complete_json(schema=ClaimList).
"""
from __future__ import annotations

from pydantic import BaseModel

from ..llm.base import LLMClient
from ..models import Claim, PaperRef, PaperSummary


class ClaimList(BaseModel):
    """Structured output schema for the Summarizer."""

    claims: list[Claim]


async def summarize_paper(
    paper: PaperRef, llm: LLMClient, *, model: str, max_claims: int = 8
) -> PaperSummary:
    raise NotImplementedError("TODO(Track A)")

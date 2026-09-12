"""The baseline our pipeline is measured against: one model, one pass, all abstracts.

This is deliberately the naive approach from the problem statement -- concatenate every
retrieved abstract into a single prompt and ask for a summary with citations. It is not
a straw man: it is what a competent person would actually do, which is what makes
beating it meaningful.

Important for fairness: the baseline gets the SAME retrieved papers as the pipeline.
Only the summarization and verification differ. If retrieval differs too, the
comparison measures nothing.

Its output must be parsed into Claim objects (with whatever quote it offers, or an
empty quote) so both systems' claims can be labeled with the same protocol, blind.

TODO(Track C): implement.
"""
from __future__ import annotations

from ..research_agent.llm.base import LLMClient
from ..research_agent.models import Claim, PaperRef


async def run_baseline(question: str, papers: list[PaperRef], llm: LLMClient, *, model: str) -> list[Claim]:
    raise NotImplementedError("TODO(Track C)")

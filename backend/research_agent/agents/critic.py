"""Critic -- the two-stage gate. Thin orchestration; the logic lives in verification/.

    Stage 1  verification.span_check.check_span    deterministic, free
    Stage 2  verification.entailment.verify_claim  LLM, only for Stage 1 survivors

Running Stage 1 first is not just tidiness: it is what keeps the project inside a free
tier, and it is what lets the evaluation report how many rejections cost nothing.
"""
from __future__ import annotations

import asyncio

from ..llm.base import LLMClient
from ..models import PaperRef, PaperSummary, Verdict, VerdictLabel
from ..verification.entailment import repair_claim, verify_claim
from ..verification.span_check import check_span


async def _verify_one(claim, paper: PaperRef, llm: LLMClient, *, model: str,
                      threshold: float, semaphore: asyncio.Semaphore) -> list[Verdict]:
    span_verdict = check_span(claim, paper, threshold=threshold)
    if span_verdict.label is VerdictLabel.QUOTE_NOT_FOUND:
        # Rejected for free -- never spend a Stage 2 call on a fabricated quote.
        return [span_verdict]

    # Judge against what the paper actually says at the matched span, not the
    # model's self-reported claim.quote. Stage 1's fuzzy tolerance for PDF noise can
    # also tolerate a meaning-changing edit (e.g. a dropped "not") that carries no
    # digits for the Stage 1 number guard to catch -- Stage 2 must see the real text.
    source_quote = paper.source_text()[claim.quote_start:claim.quote_end]

    async with semaphore:
        entailment_verdict = await verify_claim(claim, source_quote, llm, model=model)
    verdicts = [span_verdict, entailment_verdict]

    if entailment_verdict.label is VerdictLabel.PARTIAL:
        async with semaphore:
            repaired = await repair_claim(claim, source_quote, entailment_verdict, llm, model=model)
        if repaired is not None:
            claim.text = repaired.text
            async with semaphore:
                retry_verdict = await verify_claim(
                    claim, source_quote, llm, model=model, is_repair_attempt=True
                )
            verdicts.append(retry_verdict)

    return verdicts


async def verify_all(
    summaries: list[PaperSummary],
    papers: list[PaperRef],
    llm: LLMClient,
    *,
    model: str,
    threshold: float = 92.0,
    concurrency: int = 4,
) -> list[Verdict]:
    """Verify every claim in every summary. Returns all verdicts, both stages."""
    by_id = {paper.id: paper for paper in papers}
    semaphore = asyncio.Semaphore(concurrency)

    tasks = [
        _verify_one(claim, by_id[summary.paper_id], llm, model=model,
                   threshold=threshold, semaphore=semaphore)
        for summary in summaries
        for claim in summary.claims
    ]
    results = await asyncio.gather(*tasks)
    return [verdict for group in results for verdict in group]

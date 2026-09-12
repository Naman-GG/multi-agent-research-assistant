"""Offline doubles: run the whole pipeline with no API key and no network.

This exists so Track A can be developed and tested without spending free-tier quota,
and so CI can run the end-to-end test. Nothing here is used in production code.
"""
from __future__ import annotations

import uuid

from pydantic import BaseModel

from research_agent.llm.base import LLMResponse
from research_agent.models import (
    Author, Claim, PaperRef, PaperSummary, Plan, SubQuery, SubQueryIntent,
    TextAvailability, Verdict, VerdictLabel, VerificationStage,
)

P1_TEXT = (
    "Results. In the dexamethasone group, 28-day mortality among patients receiving "
    "invasive mechanical ventilation was 29.3%, as compared with 41.4% in the usual "
    "care group. No benefit was observed among patients not receiving respiratory support."
)
P2_TEXT = (
    "Results. The fixed-effect summary odds ratio for the association between "
    "corticosteroids and mortality was 0.66 (95% CI, 0.53-0.82). "
    "Discussion. The association was similar for dexamethasone and hydrocortisone."
)

FAKE_PAPERS = [
    PaperRef(id="FP1", title="Dexamethasone in Hospitalized Patients with Covid-19",
             source_api="fake", availability=TextAvailability.FULL_TEXT,
             full_text=P1_TEXT, abstract=P1_TEXT[:80], doi="10.1/a", year=2021,
             venue="NEJM", authors=[Author(name="RECOVERY Group")], citation_count=14000),
    PaperRef(id="FP2", title="Systemic Corticosteroids and Mortality in Critical COVID-19",
             source_api="fake", availability=TextAvailability.FULL_TEXT,
             full_text=P2_TEXT, abstract=P2_TEXT[:80], doi="10.1/b", year=2020,
             venue="JAMA", authors=[Author(name="WHO REACT Group")], citation_count=3800),
    PaperRef(id="FP3", title="Corticosteroids in Severe Influenza Pneumonia",
             source_api="fake", availability=TextAvailability.ABSTRACT_ONLY,
             abstract="Early corticosteroid use was associated with increased 30-day mortality.",
             doi="10.1/c", year=2019, citation_count=200),
]


class FakeSource:
    """Returns the canned papers for any sub-query."""

    name = "fake"

    def __init__(self, papers: list[PaperRef] | None = None) -> None:
        self.papers = papers if papers is not None else FAKE_PAPERS

    async def search(self, query: SubQuery, *, limit: int = 20) -> list[PaperRef]:
        return list(self.papers[:limit])


class FakeLLM:
    """Returns canned structured output per schema. Records every prompt it saw.

    The summarizer response deliberately includes ONE fabricated quote, so the
    end-to-end test exercises the path the whole project exists for.
    """

    def __init__(self) -> None:
        self.prompts: list[str] = []
        self.calls = 0

    async def complete(self, prompt: str, *, model: str, temperature: float = 0.0) -> LLMResponse:
        self.prompts.append(prompt)
        self.calls += 1
        return LLMResponse(text="", model=model)

    async def complete_json(self, prompt: str, *, model: str, schema: type[BaseModel],
                            temperature: float = 0.0):
        self.prompts.append(prompt)
        self.calls += 1
        name = schema.__name__
        resp = LLMResponse(text="", model=model)

        if name == "Plan":
            return schema(question="", sub_queries=[
                SubQuery(id="", text="Effect of dexamethasone on mortality?",
                         keywords=["dexamethasone"], intent=SubQueryIntent.FINDING),
                SubQuery(id="", text="Does benefit depend on respiratory support?",
                         keywords=["subgroup"], intent=SubQueryIntent.FINDING),
            ]), resp

        if name == "ClaimList":
            if "influenza" in prompt.lower():
                return schema(claims=[_c(
                    "Early corticosteroids were associated with higher 30-day mortality.",
                    "Early corticosteroid use was associated with increased 30-day mortality.")]), resp
            if "odds ratio" in prompt:
                return schema(claims=[_c(
                    "A meta-analysis found corticosteroids associated with lower mortality.",
                    "The fixed-effect summary odds ratio for the association between "
                    "corticosteroids and mortality was 0.66 (95% CI, 0.53-0.82).")]), resp
            return schema(claims=[
                _c("Dexamethasone lowered 28-day mortality in ventilated patients.",
                   "28-day mortality among patients receiving invasive mechanical "
                   "ventilation was 29.3%, as compared with 41.4% in the usual care group"),
                # FABRICATED — this string is nowhere in the source. Stage 1 must catch it.
                _c("Dexamethasone reduced mortality by 47% in all patients.",
                   "Dexamethasone reduced mortality by 47% across every subgroup studied."),
            ]), resp

        if name == "_SynthesisDraft":
            ids = _ids_in(prompt)
            themes = [{"title": "Mortality benefit", "claim_ids": ids,
                       "prose": " ".join(f"Finding [[{i}]]." for i in ids)}]
            return schema.model_validate({"themes": themes}), resp

        if name == "EntailmentResult":
            return schema(label=VerdictLabel.SUPPORTED, confidence=0.9,
                          reasoning="fake"), resp

        raise AssertionError(f"FakeLLM has no canned response for schema {name}")


def _c(text: str, quote: str):
    """The Summarizer's output schema is ClaimDraft -- no id, no paper_id."""
    from research_agent.agents.summarizer import ClaimDraft

    return ClaimDraft(text=text, quote=quote)


def _ids_in(prompt: str) -> list[str]:
    import re
    return re.findall(r"\[\[([^\]]+)\]\]", prompt)


async def fake_critic(summaries, papers, llm, *, model, threshold, concurrency):
    """Stand-in for Track C until span_check/entailment land.

    Does the real Stage 1 check with a plain substring test -- enough to prove the
    orchestrator wires verification correctly and that fabrications get rejected.
    """
    by_id = {p.id: p for p in papers}
    verdicts: list[Verdict] = []
    for summary in summaries:
        source = by_id[summary.paper_id].source_text()
        for claim in summary.claims:
            found = claim.quote in source
            verdicts.append(Verdict(
                claim_id=claim.id, stage=VerificationStage.SPAN,
                label=VerdictLabel.QUOTE_FOUND if found else VerdictLabel.QUOTE_NOT_FOUND,
                match_score=100.0 if found else 0.0,
            ))
            if found:
                claim.quote_start = source.index(claim.quote)
                claim.quote_end = claim.quote_start + len(claim.quote)
                verdicts.append(Verdict(
                    claim_id=claim.id, stage=VerificationStage.ENTAILMENT,
                    label=VerdictLabel.SUPPORTED, confidence=0.9,
                    reasoning="fake critic", model=model,
                ))
    return verdicts


async def fake_merge(papers, **kwargs):
    """Track B owns real dedupe; this keeps first-seen by doi/title."""
    seen, out = set(), []
    for p in papers:
        key = (p.doi or p.title).lower()
        if key not in seen:
            seen.add(key)
            out.append(p)
    return out

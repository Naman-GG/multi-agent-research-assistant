"""End-to-end pipeline tests. No API key, no network -- everything runs on fakes.

The point of these is that Track A can be verified before Track B's retrieval and
Track C's Critic exist, and that the pipeline keeps working as they land.
"""
import tempfile

import pytest

from research_agent import db
from research_agent.events import EventBus
from research_agent.models import (
    EventType, RunConfig, RunStatus, VerdictLabel, VerificationStage,
)
from research_agent.orchestrator import replay, run_pipeline

from tests.fakes import FakeLLM, FakeSource, fake_critic


@pytest.fixture
def fresh_db():
    tmp = tempfile.mkdtemp()
    db.init_db(f"sqlite:///{tmp}/test.db")
    return tmp


@pytest.fixture
def patched_dedupe(monkeypatch):
    """Track B owns sources/dedupe.py; stand in for it until it lands."""
    monkeypatch.setattr("research_agent.agents.retriever.merge",
                        lambda papers, **kw: list({(p.doi or p.title).lower(): p
                                                   for p in reversed(papers)}.values()))


async def _run(**kwargs):
    return await run_pipeline(
        "Do corticosteroids reduce mortality in COVID-19?",
        FakeLLM(), [FakeSource()],
        config=RunConfig(max_papers=5, max_sub_queries=3),
        critic=fake_critic, **kwargs,
    )


async def test_pipeline_completes(fresh_db, patched_dedupe):
    run = await _run()
    assert run.status is RunStatus.COMPLETED
    assert run.error is None
    assert run.plan is not None and run.papers and run.summaries and run.report


async def test_planner_forces_a_contradiction_subquery(fresh_db, patched_dedupe):
    """A review that only confirms is a bad review -- the plan must seek disagreement."""
    run = await _run()
    intents = {sq.intent.value for sq in run.plan.sub_queries}
    assert "contradiction" in intents


async def test_summarizer_sees_one_paper_at_a_time(fresh_db, patched_dedupe):
    """The isolation that makes cross-paper blurring structurally impossible."""
    llm = FakeLLM()
    await run_pipeline("q", llm, [FakeSource()], config=RunConfig(max_papers=5),
                       critic=fake_critic, persist=False)
    summarizer_prompts = [p for p in llm.prompts if "You extract atomic factual claims" in p]
    assert len(summarizer_prompts) == 3          # one call per paper, never batched
    # each prompt carries exactly one paper's text -- markers are mutually exclusive
    markers = ("29.3%", "odds ratio", "30-day mortality")
    for prompt in summarizer_prompts:
        assert sum(m in prompt for m in markers) == 1
    # and across the three calls, every paper was covered exactly once
    assert sorted(next(m for m in markers if m in p) for p in summarizer_prompts) == sorted(markers)


async def test_fabricated_quote_is_rejected_and_never_reaches_the_report(fresh_db, patched_dedupe):
    """The whole point of the project, as an executable assertion."""
    run = await _run()
    rejected = [vc for vc in run.verified_claims() if not vc.accepted]
    assert rejected, "the fake summarizer plants one fabrication; it must be caught"

    fabricated = rejected[0]
    assert fabricated.verdict_for(VerificationStage.SPAN).label is VerdictLabel.QUOTE_NOT_FOUND
    # rejected at Stage 1 means no Stage 2 call was spent on it
    assert fabricated.verdict_for(VerificationStage.ENTAILMENT) is None
    # and it is absent from the report
    cited = {cid for c in run.report.citations for cid in c.claim_ids}
    assert fabricated.claim.id not in cited


async def test_accepted_claims_have_offsets_for_the_evidence_pane(fresh_db, patched_dedupe):
    run = await _run()
    for vc in run.accepted_claims():
        claim, paper = vc.claim, run.paper(vc.claim.paper_id)
        assert claim.quote_start is not None and claim.quote_end is not None
        assert paper.source_text()[claim.quote_start:claim.quote_end] == claim.quote


async def test_citations_are_assigned_mechanically_not_by_the_model(fresh_db, patched_dedupe):
    run = await _run()
    markers = [c.marker for c in run.report.citations]
    assert markers == list(range(1, len(markers) + 1))     # 1..n, no gaps
    for citation in run.report.citations:
        assert run.paper(citation.paper_id) is not None    # every marker resolves
    assert "[1]" in run.report.markdown


async def test_report_only_cites_verified_claims(fresh_db, patched_dedupe):
    run = await _run()
    accepted = {vc.claim.id for vc in run.accepted_claims()}
    for citation in run.report.citations:
        for claim_id in citation.claim_ids:
            assert claim_id in accepted


async def test_events_form_a_complete_monotonic_trace(fresh_db, patched_dedupe):
    run = await _run()
    seqs = [e.seq for e in run.events]
    assert seqs == list(range(1, len(seqs) + 1))
    types = {e.type for e in run.events}
    assert {EventType.RUN_STARTED, EventType.SUB_QUERIES_PLANNED, EventType.PAPERS_RETRIEVED,
            EventType.PAPER_SUMMARIZED, EventType.REPORT_READY,
            EventType.RUN_COMPLETED} <= types


async def test_run_persists_and_reloads_identically(fresh_db, patched_dedupe):
    run = await _run()
    reloaded = db.load_run(run.id)
    assert reloaded is not None
    assert reloaded.model_dump(mode="json") == run.model_dump(mode="json")


async def test_replay_reproduces_the_trace_with_no_api_calls(fresh_db, patched_dedupe):
    """The demo's insurance policy: a recorded run looks live, costs nothing."""
    run = await _run()
    bus = EventBus(run.id)
    seen = []

    import asyncio

    async def consume():
        async for event in bus.subscribe():
            seen.append(event)

    task = asyncio.create_task(consume())
    await asyncio.sleep(0)
    replayed = await replay(run.id, bus=bus, speed=1000.0)
    await asyncio.wait_for(task, 5)

    assert replayed.id == run.id
    assert [e.type for e in seen] == [e.type for e in run.events]


async def test_a_paper_with_no_text_yields_no_claims(fresh_db, patched_dedupe):
    """Metadata-only retrieval must produce zero claims, never invented ones."""
    from research_agent.models import PaperRef, TextAvailability
    empty = PaperRef(id="E1", title="Metadata only", source_api="fake",
                     availability=TextAvailability.ABSTRACT_ONLY)
    run = await run_pipeline("q", FakeLLM(), [FakeSource([empty])],
                             config=RunConfig(max_papers=2), critic=fake_critic, persist=False)
    assert run.claims() == []


async def test_a_failing_source_does_not_kill_the_run(fresh_db, patched_dedupe):
    """One dead API must degrade the run, not fail it."""
    class BrokenSource:
        name = "broken"
        async def search(self, query, *, limit=20):
            raise ConnectionError("API down")

    run = await run_pipeline("q", FakeLLM(), [BrokenSource(), FakeSource()],
                             config=RunConfig(max_papers=5), critic=fake_critic, persist=False)
    assert run.status is RunStatus.COMPLETED
    assert len(run.papers) == 3

"""Sequences the five agents. Written by us, not a framework, because in a viva we
have to explain how it works.

    Planner -> Retriever -> Summarizer (fan-out) -> Critic (fan-out) -> Synthesis

Two kinds of bounding, and they are not the same thing:
  * a Semaphore bounds how many summaries are in flight (memory, provider concurrency)
  * the RateLimiter bounds requests per minute (free-tier quota)
You need both. Concurrency alone does not bound request *rate*.

The Critic is injected rather than imported directly so the pipeline can be tested
end-to-end before Track C's implementation lands, and so the evaluation can run the
same pipeline with verification switched off to produce the baseline.
"""
from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone

from . import db
from .agents import planner as planner_agent
from .agents import retriever as retriever_agent
from .agents import summarizer as summarizer_agent
from .agents import synthesizer as synthesizer_agent
from .config import Settings, settings as default_settings
from .events import EventBus
from .llm.base import LLMClient
from .models import (
    AgentName, EventType, PaperRef, PaperSummary, Run, RunConfig, RunStatus,
    VerificationStage, Verdict,
)
from .sources.base import SearchSource

CriticFn = Callable[..., Awaitable[list[Verdict]]]


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _default_critic(summaries, papers, llm, *, model, threshold, concurrency):
    from .agents.critic import verify_all

    return await verify_all(
        summaries, papers, llm, model=model, threshold=threshold, concurrency=concurrency
    )


async def run_pipeline(
    question: str,
    llm: LLMClient,
    sources: list[SearchSource],
    *,
    config: RunConfig | None = None,
    settings: Settings | None = None,
    bus: EventBus | None = None,
    critic: CriticFn | None = None,
    persist: bool = True,
) -> Run:
    """Execute a complete research run and return it fully populated."""
    cfg = config or RunConfig()
    st = settings or default_settings
    critic_fn = critic or _default_critic

    run = Run(id=f"RUN-{uuid.uuid4().hex[:10].upper()}", question=question, config=cfg)
    bus = bus or EventBus(run.id)

    def checkpoint(status: RunStatus) -> None:
        """Persist at every stage boundary so a crashed run is still inspectable --
        and so `replay` has something to serve even if synthesis never finished."""
        run.status = status
        run.events = bus.history
        if persist:
            try:
                db.save_run(run)
            except Exception:
                pass  # a failed checkpoint must not abort a run that is otherwise fine

    try:
        await bus.emit(AgentName.ORCHESTRATOR, EventType.RUN_STARTED, f"Run started: {question}")

        # -- 1. plan -------------------------------------------------------------
        checkpoint(RunStatus.PLANNING)
        await bus.emit(AgentName.PLANNER, EventType.STAGE_STARTED, "Decomposing question")
        run.plan = await planner_agent.plan_query(
            question, llm, model=st.models.planner, max_sub_queries=cfg.max_sub_queries
        )
        await bus.emit(
            AgentName.PLANNER, EventType.SUB_QUERIES_PLANNED,
            f"Planned {len(run.plan.sub_queries)} sub-queries",
            sub_queries=[sq.text for sq in run.plan.sub_queries],
        )

        # -- 2. retrieve ---------------------------------------------------------
        checkpoint(RunStatus.RETRIEVING)
        await bus.emit(AgentName.RETRIEVER, EventType.STAGE_STARTED, "Searching sources")
        run.papers = await retriever_agent.retrieve(run.plan, sources, cfg)
        abstract_only = sum(1 for p in run.papers if not p.full_text)
        await bus.emit(
            AgentName.RETRIEVER, EventType.PAPERS_RETRIEVED,
            f"Retrieved {len(run.papers)} papers ({abstract_only} abstract-only)",
            count=len(run.papers), abstract_only=abstract_only,
        )
        if not run.papers:
            raise RuntimeError("no papers retrieved -- try a broader question or more sources")

        # -- 3. summarize (fan out, one paper per call) --------------------------
        checkpoint(RunStatus.SUMMARIZING)
        await bus.emit(AgentName.SUMMARIZER, EventType.STAGE_STARTED,
                       f"Summarizing {len(run.papers)} papers")
        gate = asyncio.Semaphore(st.limits.summarizer_concurrency)
        done = 0

        async def summarize(paper: PaperRef) -> PaperSummary | None:
            nonlocal done
            async with gate:
                try:
                    summary = await summarizer_agent.summarize_paper(
                        paper, llm, model=st.models.summarizer,
                        max_claims=st.limits.max_claims_per_paper,
                    )
                except Exception as exc:
                    await bus.emit(AgentName.SUMMARIZER, EventType.ERROR,
                                   f"Failed to summarize {paper.id}: {exc}", paper_id=paper.id)
                    return None
                done += 1
                await bus.emit(
                    AgentName.SUMMARIZER, EventType.PAPER_SUMMARIZED,
                    f"Summarized {done}/{len(run.papers)}: {paper.title[:60]}",
                    paper_id=paper.id, claims=len(summary.claims),
                    progress=done, total=len(run.papers),
                )
                return summary

        run.summaries = [s for s in await asyncio.gather(
            *(summarize(p) for p in run.papers)
        ) if s is not None]
        total_claims = len(run.claims())
        await bus.emit(AgentName.SUMMARIZER, EventType.STAGE_COMPLETED,
                       f"Extracted {total_claims} claims", claims=total_claims)

        # -- 4. verify -----------------------------------------------------------
        checkpoint(RunStatus.VERIFYING)
        await bus.emit(AgentName.CRITIC, EventType.STAGE_STARTED,
                       f"Verifying {total_claims} claims")
        run.verdicts = await critic_fn(
            run.summaries, run.papers, llm,
            model=st.models.critic,
            threshold=st.limits.span_match_threshold,
            concurrency=st.limits.critic_concurrency,
        )
        verified = run.verified_claims()
        accepted = [vc for vc in verified if vc.accepted]
        stage1_rejects = sum(
            1 for vc in verified
            if (sv := vc.verdict_for(VerificationStage.SPAN)) and sv.label.is_rejection
        )
        await bus.emit(
            AgentName.CRITIC, EventType.STAGE_COMPLETED,
            f"{len(accepted)}/{total_claims} claims verified "
            f"({stage1_rejects} rejected free at Stage 1)",
            accepted=len(accepted), rejected=total_claims - len(accepted),
            stage1_rejections=stage1_rejects,
        )

        # -- 5. synthesize -------------------------------------------------------
        checkpoint(RunStatus.SYNTHESIZING)
        await bus.emit(AgentName.SYNTHESIZER, EventType.STAGE_STARTED, "Writing report")
        run.report = await synthesizer_agent.synthesize(
            question, accepted, run.papers, llm, model=st.models.synthesizer
        )
        await bus.emit(AgentName.SYNTHESIZER, EventType.REPORT_READY,
                       f"Report written from {len(accepted)} verified claims",
                       accepted=len(accepted), citations=len(run.report.citations))

        run.completed_at = _now()
        await bus.emit(AgentName.ORCHESTRATOR, EventType.RUN_COMPLETED, "Run completed")
        checkpoint(RunStatus.COMPLETED)

    except Exception as exc:
        run.error = f"{type(exc).__name__}: {exc}"
        run.completed_at = _now()
        await bus.emit(AgentName.ORCHESTRATOR, EventType.ERROR, run.error)
        checkpoint(RunStatus.FAILED)
        raise
    finally:
        await bus.close()

    return run


async def replay(run_id: str, *, bus: EventBus | None = None, speed: float = 1.0) -> Run:
    """Re-serve a completed run from the database with simulated timing, zero API calls.

    Record a run the night before each review. If the network or the free-tier quota
    dies during the demo, this still works -- and it looks identical to a live run
    because it drives the same event stream the UI already renders.
    """
    run = db.load_run(run_id)
    if run is None:
        raise LookupError(f"no such run: {run_id}")
    if bus is None:
        return run

    previous: datetime | None = None
    for event in run.events:
        if previous is not None and speed > 0:
            gap = (event.ts - previous).total_seconds() / speed
            await asyncio.sleep(min(max(gap, 0.0), 2.0))  # cap so demos never stall
        previous = event.ts
        await bus.emit(event.agent, event.type, event.message, **event.payload)
    await bus.close()
    return run

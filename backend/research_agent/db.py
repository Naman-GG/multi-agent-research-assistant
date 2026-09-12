"""SQLite persistence via SQLModel.

Claims, verdicts, events and LLM calls get real columns because they are queried:
Track C's evaluation aggregates over verdicts, the API resumes SSE from events, and
the cost analysis sums llm_calls. Nested value objects that are only ever read back
whole (plan, report, author lists) are stored as JSON -- normalizing them would buy
nothing and cost a lot of boilerplate.

Note the shape of `verdicts`: a claim gets up to TWO rows, stage='span' then
stage='entailment'. Keeping both is what lets the evaluation report how many
rejections were free and how many cost an LLM call, without re-running anything.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import Column, Text
from sqlmodel import Field, Session, SQLModel, create_engine, delete, select

from .models import (
    Author, Citation, Claim, LLMCall, PaperRef, PaperSummary, Plan, Report, Run,
    RunConfig, RunEvent, Theme, Verdict,
)

_engine = None


def _aware(dt: datetime | None) -> datetime | None:
    """Re-attach UTC on the way out of SQLite.

    SQLite has no timezone type, so datetimes come back naive. Everything we store is
    UTC by construction (models.py defaults to datetime.now(timezone.utc)), so a naive
    value read back is UTC that lost its label. Without this, `completed_at -
    created_at` raises on mixed aware/naive values and the evaluation's wall-clock
    metric breaks in a way that is annoying to trace.
    """
    if dt is None or dt.tzinfo is not None:
        return dt
    return dt.replace(tzinfo=timezone.utc)


def _utc(dt: datetime | None) -> datetime | None:
    """Normalize to UTC on the way in, so what we store is unambiguous."""
    if dt is None:
        return None
    return dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# -- tables ---------------------------------------------------------------------------

class RunRow(SQLModel, table=True):
    __tablename__ = "runs"
    id: str = Field(primary_key=True)
    question: str
    status: str
    config_json: str = Field(sa_column=Column(Text))
    plan_json: str | None = Field(default=None, sa_column=Column(Text))
    report_json: str | None = Field(default=None, sa_column=Column(Text))
    created_at: datetime
    completed_at: datetime | None = None
    error: str | None = None


class PaperRow(SQLModel, table=True):
    __tablename__ = "papers"
    id: str = Field(primary_key=True)
    run_id: str = Field(primary_key=True, index=True)
    title: str
    source_api: str
    availability: str
    doi: str | None = None
    authors_json: str = Field(default="[]", sa_column=Column(Text))
    year: int | None = None
    venue: str | None = None
    abstract: str | None = Field(default=None, sa_column=Column(Text))
    full_text: str | None = Field(default=None, sa_column=Column(Text))
    url: str | None = None
    oa_pdf_url: str | None = None
    citation_count: int | None = None


class SummaryRow(SQLModel, table=True):
    __tablename__ = "summaries"
    id: str = Field(primary_key=True)
    run_id: str = Field(index=True)
    paper_id: str
    model: str
    created_at: datetime


class ClaimRow(SQLModel, table=True):
    __tablename__ = "claims"
    id: str = Field(primary_key=True)
    run_id: str = Field(index=True)
    summary_id: str = Field(index=True)
    paper_id: str
    text: str = Field(sa_column=Column(Text))
    quote: str = Field(sa_column=Column(Text))
    section: str | None = None
    quote_start: int | None = None
    quote_end: int | None = None


class VerdictRow(SQLModel, table=True):
    __tablename__ = "verdicts"
    pk: int | None = Field(default=None, primary_key=True)
    run_id: str = Field(index=True)
    claim_id: str = Field(index=True)
    stage: str
    label: str
    confidence: float | None = None
    reasoning: str | None = Field(default=None, sa_column=Column(Text))
    model: str | None = None
    match_score: float | None = None
    is_repair_attempt: bool = False
    created_at: datetime


class EventRow(SQLModel, table=True):
    __tablename__ = "events"
    run_id: str = Field(primary_key=True, index=True)
    seq: int = Field(primary_key=True)
    agent: str
    type: str
    message: str = ""
    payload_json: str = Field(default="{}", sa_column=Column(Text))
    ts: datetime


class LLMCallRow(SQLModel, table=True):
    __tablename__ = "llm_calls"
    id: str = Field(primary_key=True)
    run_id: str = Field(index=True)
    agent: str
    model: str
    prompt: str = Field(sa_column=Column(Text))
    response: str = Field(sa_column=Column(Text))
    tokens_in: int | None = None
    tokens_out: int | None = None
    latency_ms: int | None = None
    cache_hit: bool = False
    ts: datetime


# -- engine ---------------------------------------------------------------------------

def init_db(database_url: str = "sqlite:///./research.db") -> None:
    global _engine
    if database_url.startswith("sqlite:///"):
        path = Path(database_url.removeprefix("sqlite:///"))
        if path.parent != Path("."):
            path.parent.mkdir(parents=True, exist_ok=True)
    _engine = create_engine(database_url, echo=False)
    SQLModel.metadata.create_all(_engine)


def _require_engine():
    if _engine is None:
        raise RuntimeError("init_db() must be called before using the database")
    return _engine


# -- write ----------------------------------------------------------------------------

def save_run(run: Run) -> None:
    """Upsert a whole run. Idempotent -- safe to call at every stage boundary."""
    engine = _require_engine()
    with Session(engine) as session:
        for table in (PaperRow, SummaryRow, ClaimRow, VerdictRow, EventRow, LLMCallRow):
            session.exec(delete(table).where(table.run_id == run.id))
        session.merge(RunRow(
            id=run.id, question=run.question, status=run.status.value,
            config_json=run.config.model_dump_json(),
            plan_json=run.plan.model_dump_json() if run.plan else None,
            report_json=run.report.model_dump_json() if run.report else None,
            created_at=_utc(run.created_at), completed_at=_utc(run.completed_at), error=run.error,
        ))
        for p in run.papers:
            session.add(PaperRow(
                id=p.id, run_id=run.id, title=p.title, source_api=p.source_api,
                availability=p.availability.value, doi=p.doi,
                authors_json=json.dumps([a.model_dump() for a in p.authors]),
                year=p.year, venue=p.venue, abstract=p.abstract, full_text=p.full_text,
                url=p.url, oa_pdf_url=p.oa_pdf_url, citation_count=p.citation_count,
            ))
        for s in run.summaries:
            session.add(SummaryRow(id=s.id, run_id=run.id, paper_id=s.paper_id,
                                   model=s.model, created_at=_utc(s.created_at)))
            for c in s.claims:
                session.add(ClaimRow(
                    id=c.id, run_id=run.id, summary_id=s.id, paper_id=c.paper_id,
                    text=c.text, quote=c.quote, section=c.section,
                    quote_start=c.quote_start, quote_end=c.quote_end,
                ))
        for v in run.verdicts:
            session.add(VerdictRow(
                run_id=run.id, claim_id=v.claim_id, stage=v.stage.value, label=v.label.value,
                confidence=v.confidence, reasoning=v.reasoning, model=v.model,
                match_score=v.match_score, is_repair_attempt=v.is_repair_attempt,
                created_at=_utc(v.created_at),
            ))
        for e in run.events:
            session.add(EventRow(
                run_id=run.id, seq=e.seq, agent=e.agent.value, type=e.type.value,
                message=e.message, payload_json=json.dumps(e.payload), ts=_utc(e.ts),
            ))
        session.commit()


def save_llm_call(call: LLMCall) -> None:
    engine = _require_engine()
    with Session(engine) as session:
        session.merge(LLMCallRow(
            id=call.id, run_id=call.run_id, agent=call.agent.value, model=call.model,
            prompt=call.prompt, response=call.response, tokens_in=call.tokens_in,
            tokens_out=call.tokens_out, latency_ms=call.latency_ms,
            cache_hit=call.cache_hit, ts=_utc(call.ts),
        ))
        session.commit()


# -- read -----------------------------------------------------------------------------

def load_run(run_id: str) -> Run | None:
    """Reassemble a full Run. Used by the API, the UI, and `cli.py replay`."""
    engine = _require_engine()
    with Session(engine) as session:
        row = session.get(RunRow, run_id)
        if row is None:
            return None

        papers = [
            PaperRef(
                id=p.id, title=p.title, source_api=p.source_api, availability=p.availability,
                doi=p.doi, authors=[Author(**a) for a in json.loads(p.authors_json)],
                year=p.year, venue=p.venue, abstract=p.abstract, full_text=p.full_text,
                url=p.url, oa_pdf_url=p.oa_pdf_url, citation_count=p.citation_count,
            )
            for p in session.exec(select(PaperRow).where(PaperRow.run_id == run_id))
        ]

        claims_by_summary: dict[str, list[Claim]] = {}
        for c in session.exec(select(ClaimRow).where(ClaimRow.run_id == run_id)):
            claims_by_summary.setdefault(c.summary_id, []).append(Claim(
                id=c.id, paper_id=c.paper_id, text=c.text, quote=c.quote,
                section=c.section, quote_start=c.quote_start, quote_end=c.quote_end,
            ))

        summaries = [
            PaperSummary(id=s.id, paper_id=s.paper_id, model=s.model,
                         created_at=_aware(s.created_at), claims=claims_by_summary.get(s.id, []))
            for s in session.exec(select(SummaryRow).where(SummaryRow.run_id == run_id))
        ]

        verdicts = [
            Verdict(claim_id=v.claim_id, stage=v.stage, label=v.label, confidence=v.confidence,
                    reasoning=v.reasoning, model=v.model, match_score=v.match_score,
                    is_repair_attempt=v.is_repair_attempt, created_at=_aware(v.created_at))
            for v in session.exec(
                select(VerdictRow).where(VerdictRow.run_id == run_id).order_by(VerdictRow.pk)
            )
        ]

        events = [
            RunEvent(seq=e.seq, run_id=e.run_id, agent=e.agent, type=e.type,
                     message=e.message, payload=json.loads(e.payload_json), ts=_aware(e.ts))
            for e in session.exec(
                select(EventRow).where(EventRow.run_id == run_id).order_by(EventRow.seq)
            )
        ]

        return Run(
            id=row.id, question=row.question, status=row.status,
            config=RunConfig.model_validate_json(row.config_json),
            plan=Plan.model_validate_json(row.plan_json) if row.plan_json else None,
            report=Report.model_validate_json(row.report_json) if row.report_json else None,
            papers=papers, summaries=summaries, verdicts=verdicts, events=events,
            created_at=_aware(row.created_at), completed_at=_aware(row.completed_at), error=row.error,
        )


def list_runs(limit: int = 50) -> list[tuple[str, str, str, datetime]]:
    """(id, question, status, created_at), newest first. Cheap -- no nested loading."""
    engine = _require_engine()
    with Session(engine) as session:
        rows = session.exec(
            select(RunRow).order_by(RunRow.created_at.desc()).limit(limit)
        )
        return [(r.id, r.question, r.status, _aware(r.created_at)) for r in rows]


def llm_cost(run_id: str) -> dict[str, int]:
    """Token and call totals for a run -- the cost analysis in the report."""
    engine = _require_engine()
    with Session(engine) as session:
        calls = list(session.exec(select(LLMCallRow).where(LLMCallRow.run_id == run_id)))
    return {
        "calls": len(calls),
        "cache_hits": sum(1 for c in calls if c.cache_hit),
        "tokens_in": sum(c.tokens_in or 0 for c in calls),
        "tokens_out": sum(c.tokens_out or 0 for c in calls),
    }

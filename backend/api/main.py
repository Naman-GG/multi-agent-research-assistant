"""FastAPI layer. Thin by design -- it calls the pipeline package and streams events.

The pipeline never imports this module. That one-way dependency is what lets the
evaluation harness run the same code with no web server involved.

Runs execute as background tasks: a research run takes minutes, so POST /runs returns
a run_id immediately and the client follows progress over SSE.
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from research_agent import db
from research_agent.config import settings
from research_agent.events import EventBus
from research_agent.llm.cache import DiskCache
from research_agent.llm.gemini import GeminiClient
from research_agent.llm.ratelimit import RateLimiter
from research_agent.models import Run, RunConfig, RunStatus
from research_agent.orchestrator import replay as replay_run
from research_agent.orchestrator import run_pipeline
from research_agent.sources.openalex import OpenAlexSource

load_dotenv()

# live buses for in-flight runs, so SSE can attach to a run already in progress
_buses: dict[str, EventBus] = {}
_tasks: dict[str, asyncio.Task] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db(settings.database_url)
    yield


app = FastAPI(title="Multi-Agent Research Assistant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    question: str = Field(min_length=8)
    config: RunConfig = Field(default_factory=RunConfig)


class RunAccepted(BaseModel):
    run_id: str
    status: RunStatus


def _sources():
    return [OpenAlexSource()]


def _llm(run_id: str):
    return GeminiClient(
        settings.gemini_api_key,
        cache=DiskCache(settings.cache_dir),
        limiter=RateLimiter(settings.limits.requests_per_minute),
        on_call=db.save_llm_call,
        run_id=run_id,
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/runs", response_model=RunAccepted, status_code=202)
async def create_run(request: RunRequest) -> RunAccepted:
    """Start a run in the background and return immediately."""
    import uuid

    run_id = f"RUN-{uuid.uuid4().hex[:10].upper()}"
    bus = EventBus(run_id)
    _buses[run_id] = bus

    # Persist a pending row before returning, so the browser's first GET /runs/{id}
    # finds the run even if it lands before the pipeline's first checkpoint.
    db.save_run(Run(id=run_id, question=request.question, config=request.config))

    async def execute():
        try:
            await run_pipeline(
                request.question, _llm(run_id), _sources(),
                config=request.config, bus=bus, run_id=run_id,
            )
        except Exception:
            pass  # the failure is already recorded on the run and in the event trace
        finally:
            _tasks.pop(run_id, None)

    _tasks[run_id] = asyncio.create_task(execute())
    return RunAccepted(run_id=run_id, status=RunStatus.PENDING)


@app.get("/runs")
async def list_runs(limit: int = Query(50, le=200)):
    return [
        {"id": i, "question": q, "status": s, "created_at": c}
        for i, q, s, c in db.list_runs(limit)
    ]


@app.get("/runs/{run_id}", response_model=Run)
async def get_run(run_id: str) -> Run:
    run = db.load_run(run_id)
    if run is None:
        raise HTTPException(404, f"no such run: {run_id}")
    return run


@app.get("/runs/{run_id}/events")
async def stream_events(run_id: str, from_seq: int = 0):
    """SSE live trace. Pass ?from_seq=N to resume after a reconnect without gaps."""
    bus = _buses.get(run_id)

    async def live():
        async for event in bus.subscribe(from_seq=from_seq):
            yield {"event": event.type.value, "id": str(event.seq),
                   "data": event.model_dump_json()}

    async def finished():
        run = db.load_run(run_id)
        if run is None:
            raise HTTPException(404, f"no such run: {run_id}")
        for event in run.events:
            if event.seq > from_seq:
                yield {"event": event.type.value, "id": str(event.seq),
                       "data": event.model_dump_json()}

    return EventSourceResponse(live() if bus else finished())


@app.get("/runs/{run_id}/report")
async def get_report(run_id: str):
    run = db.load_run(run_id)
    if run is None:
        raise HTTPException(404, f"no such run: {run_id}")
    if run.report is None:
        raise HTTPException(409, f"run {run_id} has no report yet (status: {run.status.value})")
    return run.report


@app.get("/runs/{run_id}/export.md", response_class=PlainTextResponse)
async def export_markdown(run_id: str) -> str:
    run = db.load_run(run_id)
    if run is None or run.report is None:
        raise HTTPException(404, "no report for that run")
    return run.report.markdown


@app.get("/runs/{run_id}/export.bib", response_class=PlainTextResponse)
async def export_bibtex(run_id: str) -> str:
    run = db.load_run(run_id)
    if run is None or run.report is None:
        raise HTTPException(404, "no report for that run")
    return run.report.bibtex


@app.get("/runs/{run_id}/cost")
async def get_cost(run_id: str) -> dict[str, int]:
    """Tokens, calls and cache hits -- the cost analysis for the report."""
    return db.llm_cost(run_id)

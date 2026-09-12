"""FastAPI layer. Thin -- it calls the pipeline package and streams events.

The pipeline never imports this module. That direction of dependency is what lets the
evaluation harness run the same code with no web server involved.

Endpoints:
    POST /runs                  start a run, returns run_id immediately
    GET  /runs/{id}             current state of a run
    GET  /runs/{id}/events      SSE live trace (?from_seq= to resume after reconnect)
    GET  /runs/{id}/report      the finished report
    GET  /runs/{id}/export.md   markdown download
    GET  /runs/{id}/export.bib  BibTeX download

TODO(Track A): implement. Run with: uvicorn api.main:app --reload
"""
from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(title="Multi-Agent Research Assistant")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

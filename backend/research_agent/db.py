"""SQLite persistence via SQLModel.

Tables mirror models.py: runs, sub_queries, papers, summaries, claims, verdicts,
reports, events, llm_calls.

Note the deliberate shape of `verdicts`: a claim gets up to TWO rows (stage=span,
then stage=entailment). Keeping both is what lets the evaluation report how many
rejections came free from Stage 1 versus needing a paid Stage 2 call -- without
re-running anything.

TODO(Track A): define SQLModel tables, engine, session factory, and save/load helpers.
"""
from __future__ import annotations

from .models import Run


def init_db(database_url: str) -> None:
    raise NotImplementedError("TODO(Track A)")


def save_run(run: Run) -> None:
    raise NotImplementedError("TODO(Track A)")


def load_run(run_id: str) -> Run | None:
    """Used by the API, the UI, and `cli.py replay`."""
    raise NotImplementedError("TODO(Track A)")


def list_runs(limit: int = 50) -> list[Run]:
    raise NotImplementedError("TODO(Track A)")

"""API-level tests: the id POST /runs returns must be the id the run is stored under.

Regression for a bug where the API handed the browser one run id while the
orchestrator saved the run under a freshly generated one, so every GET /runs/{id}
after a live run returned 404 and the report never loaded.
"""
import time

import pytest
from fastapi.testclient import TestClient

import api.main as api_main
from research_agent import db
from research_agent.events import EventBus
from research_agent.models import RunConfig
from research_agent.orchestrator import run_pipeline

from tests.fakes import FakeLLM, FakeSource, fake_critic


@pytest.fixture
def dedupe_stub(monkeypatch):
    monkeypatch.setattr(
        "research_agent.agents.retriever.merge",
        lambda papers, **kw: list({(p.doi or p.title).lower(): p for p in reversed(papers)}.values()),
    )


@pytest.fixture
def client(tmp_path, monkeypatch, dedupe_stub):
    real_init = db.init_db
    monkeypatch.setattr(db, "init_db", lambda url: real_init(f"sqlite:///{tmp_path}/api.db"))
    monkeypatch.setattr(api_main, "_llm", lambda run_id: FakeLLM())
    monkeypatch.setattr(api_main, "_sources", lambda: [FakeSource()])
    with TestClient(api_main.app) as c:
        yield c


async def test_pipeline_uses_the_bus_run_id(dedupe_stub):
    bus = EventBus("RUN-FROM-API")
    run = await run_pipeline("q", FakeLLM(), [FakeSource()], config=RunConfig(max_papers=3),
                             bus=bus, critic=fake_critic, persist=False)
    assert run.id == "RUN-FROM-API"
    assert all(e.run_id == "RUN-FROM-API" for e in run.events)


async def test_mismatched_bus_and_run_id_is_rejected():
    with pytest.raises(ValueError):
        await run_pipeline("q", FakeLLM(), [FakeSource()], bus=EventBus("RUN-A"),
                           run_id="RUN-B", critic=fake_critic, persist=False)


def test_new_run_is_fetchable_immediately(client):
    """The browser fetches the run right after creating it -- before the pipeline's
    first checkpoint. That request must not 404."""
    resp = client.post("/runs", json={"question": "Do corticosteroids reduce mortality?",
                                      "config": {"max_papers": 3}})
    assert resp.status_code == 202
    run_id = resp.json()["run_id"]
    got = client.get(f"/runs/{run_id}")
    assert got.status_code == 200
    assert got.json()["id"] == run_id


def test_finished_run_and_report_load_under_the_returned_id(client):
    resp = client.post("/runs", json={"question": "Do corticosteroids reduce mortality?",
                                      "config": {"max_papers": 3}})
    run_id = resp.json()["run_id"]

    deadline = time.time() + 10
    status = None
    while time.time() < deadline:
        status = client.get(f"/runs/{run_id}").json()["status"]
        if status in ("completed", "failed"):
            break
        time.sleep(0.05)
    assert status == "completed", f"run ended as {status}"

    report = client.get(f"/runs/{run_id}/report")
    assert report.status_code == 200
    assert report.json()["citations"], "report should cite the verified claims"

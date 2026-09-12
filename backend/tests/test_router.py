"""Routing tests: the Critic's high call volume must land on a different provider
from the Summarizer's long-context calls.

No network and no keys -- the providers here are recording stubs.
"""
import pytest
from pydantic import BaseModel

from research_agent.config import Limits, ModelRoles, Settings
from research_agent.llm.base import LLMResponse
from research_agent.llm.router import LLMRouter
from research_agent.models import RunConfig

from tests.fakes import FakeLLM, FakeSource, fake_critic


class RecordingClient:
    """Satisfies LLMClient; remembers which models it was asked for."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.models: list[str] = []

    async def complete(self, prompt, *, model, temperature=0.0):
        self.models.append(model)
        return LLMResponse(text="", model=model)

    async def complete_json(self, prompt, *, model, schema, temperature=0.0):
        self.models.append(model)
        return schema.model_construct(), LLMResponse(text="", model=model)


class Dummy(BaseModel):
    pass


@pytest.fixture
def router():
    gemini, groq = RecordingClient("gemini"), RecordingClient("groq")
    return LLMRouter({"gemini": gemini}, default=groq), gemini, groq


async def test_gemini_models_route_to_gemini(router):
    r, gemini, groq = router
    await r.complete("p", model="gemini-2.5-flash")
    assert gemini.models == ["gemini-2.5-flash"]
    assert groq.models == []


async def test_non_gemini_models_route_to_the_default(router):
    r, gemini, groq = router
    await r.complete("p", model="llama-3.3-70b-versatile")
    assert groq.models == ["llama-3.3-70b-versatile"]
    assert gemini.models == []


async def test_structured_output_routes_the_same_way(router):
    r, gemini, groq = router
    await r.complete_json("p", model="llama-3.3-70b-versatile", schema=Dummy)
    await r.complete_json("p", model="gemini-2.5-pro", schema=Dummy)
    assert groq.models == ["llama-3.3-70b-versatile"]
    assert gemini.models == ["gemini-2.5-pro"]


async def test_router_satisfies_the_client_protocol_for_agents(router):
    """Agents must not be able to tell they are talking to a router."""
    r, _, _ = router
    assert hasattr(r, "complete") and hasattr(r, "complete_json")


async def test_pipeline_splits_load_across_providers(monkeypatch):
    """The point of the exercise: the Critic's calls do not share the Summarizer's quota."""
    monkeypatch.setattr(
        "research_agent.agents.retriever.merge",
        lambda papers, **kw: list({(p.doi or p.title).lower(): p for p in reversed(papers)}.values()),
    )

    gemini_side, groq_side = FakeLLM(), FakeLLM()

    class SplitRouter(LLMRouter):
        pass

    router = SplitRouter({"gemini": gemini_side}, default=groq_side)

    settings = Settings(
        models=ModelRoles(
            planner="gemini-2.5-pro",
            summarizer="gemini-2.5-flash",
            critic="llama-3.3-70b-versatile",
            synthesizer="gemini-2.5-pro",
        ),
        limits=Limits(),
    )

    async def counting_critic(summaries, papers, llm, *, model, threshold, concurrency):
        # one Stage 2 call per claim, through the router -- what the real Critic does
        for summary in summaries:
            for _ in summary.claims:
                await llm.complete("verify", model=model)
        return await fake_critic(summaries, papers, llm, model=model,
                                 threshold=threshold, concurrency=concurrency)

    from research_agent.orchestrator import run_pipeline

    run = await run_pipeline(
        "Do corticosteroids reduce mortality?", router, [FakeSource()],
        config=RunConfig(max_papers=5), settings=settings,
        critic=counting_critic, persist=False,
    )

    assert run.status.value == "completed"

    # Gemini took planner + one summary per paper + synthesis
    assert gemini_side.calls == 1 + len(run.papers) + 1
    # Groq took exactly one Stage 2 call per claim -- and nothing leaked the other way
    assert groq_side.calls == len(run.claims())

    # The split scales the way the quota argument depends on: Gemini's share is fixed
    # at (2 + papers) while Groq's grows with claims. At the ~5 claims/paper a real
    # paper yields, Groq carries the large majority; these fakes emit ~1.3, so assert
    # the scaling relationship rather than a raw count.
    assert gemini_side.calls == 2 + len(run.papers)
    assert groq_side.calls == sum(len(s.claims) for s in run.summaries)

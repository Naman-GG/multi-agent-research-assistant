"""Routes each call to a provider based on the model name it asks for.

The agents already pass `model=` on every call, and each role has a distinct model in
config.ModelRoles -- so routing on the model name needs no change to any agent or to
the orchestrator. The router itself satisfies the LLMClient protocol, so callers
cannot tell the difference.

Why route at all: the two heavy stages have opposite shapes.

    Summarizer   few calls, enormous inputs   -> needs long context
    Critic       many calls, tiny inputs      -> needs throughput

Putting them on different providers splits the load across two free tiers along a seam
that already exists, instead of pushing ~74 calls per run through one quota.
"""
from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel

from ..models import AgentName
from .base import LLMClient, LLMResponse

T = TypeVar("T", bound=BaseModel)


class LLMRouter:
    """Dispatches by model-name prefix, falling back to `default` for anything unmatched."""

    def __init__(self, routes: dict[str, LLMClient], default: LLMClient) -> None:
        self._routes = routes
        self._default = default

    def client_for(self, model: str) -> LLMClient:
        for prefix, client in self._routes.items():
            if model.startswith(prefix):
                return client
        return self._default

    def providers(self) -> dict[str, str]:
        """Which provider class serves which prefix -- useful in logs and the report."""
        out = {p: type(c).__name__ for p, c in self._routes.items()}
        out["*"] = type(self._default).__name__
        return out

    async def complete(self, prompt: str, *, model: str, temperature: float = 0.0) -> LLMResponse:
        return await self.client_for(model).complete(prompt, model=model, temperature=temperature)

    async def complete_json(
        self, prompt: str, *, model: str, schema: type[T], temperature: float = 0.0
    ) -> tuple[T, LLMResponse]:
        return await self.client_for(model).complete_json(
            prompt, model=model, schema=schema, temperature=temperature
        )

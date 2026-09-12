"""The provider interface. Everything above this line is provider-agnostic.

Track A owns the implementations; Track C's Critic and baseline both call through
this protocol, so switching Gemini -> Groq is one line in config.py.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


@dataclass
class LLMResponse:
    text: str
    model: str
    tokens_in: int | None = None
    tokens_out: int | None = None
    latency_ms: int | None = None
    cache_hit: bool = False


class LLMClient(Protocol):
    """Minimal surface. Structured output is the important half.

    `complete_json` must return an instance of `schema` or raise -- agents should never
    have to parse free text. Pass a pydantic model; its .model_json_schema() constrains
    the provider's response format.
    """

    async def complete(self, prompt: str, *, model: str, temperature: float = 0.0) -> LLMResponse:
        ...

    async def complete_json(
        self, prompt: str, *, model: str, schema: type[T], temperature: float = 0.0
    ) -> tuple[T, LLMResponse]:
        ...

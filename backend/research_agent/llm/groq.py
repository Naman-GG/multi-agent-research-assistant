"""Groq provider -- the fallback, for when Gemini's free tier is exhausted.

Keeping a second adapter honest is cheap insurance: if free-tier terms change mid-
semester, switching is one line in config.py rather than a rewrite.

TODO(Track A): implement to the same LLMClient protocol.
"""
from __future__ import annotations

from pydantic import BaseModel

from .base import LLMResponse


class GroqClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def complete(self, prompt: str, *, model: str, temperature: float = 0.0) -> LLMResponse:
        raise NotImplementedError("TODO(Track A)")

    async def complete_json(self, prompt: str, *, model: str, schema: type[BaseModel], temperature: float = 0.0):
        raise NotImplementedError("TODO(Track A)")

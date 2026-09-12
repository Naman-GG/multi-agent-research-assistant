"""Gemini provider -- the primary. Implements LLMClient.

Use response_schema for structured output rather than asking for JSON in the prompt;
it is far more reliable and is what makes the Summarizer's claim format dependable.

TODO(Track A): implement complete() and complete_json() via google-genai,
routed through cache.py and ratelimit.py, logging every call as an LLMCall.
"""
from __future__ import annotations

from pydantic import BaseModel

from .base import LLMResponse


class GeminiClient:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    async def complete(self, prompt: str, *, model: str, temperature: float = 0.0) -> LLMResponse:
        raise NotImplementedError("TODO(Track A)")

    async def complete_json(self, prompt: str, *, model: str, schema: type[BaseModel], temperature: float = 0.0):
        raise NotImplementedError("TODO(Track A)")

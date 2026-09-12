"""Gemini provider -- the primary. Implements the LLMClient protocol.

Structured output goes through the API's response_schema rather than asking for JSON
in the prompt. That difference matters more than anything else in this file: it is
what makes the Summarizer's claim format dependable enough for Stage 1 to be a
literal string search.

Every call is cached, rate-limited, and logged. The call log is the cost analysis and
the report appendix.
"""
from __future__ import annotations

import json
import time
import uuid
from collections.abc import Callable
from typing import TypeVar

from pydantic import BaseModel

from ..models import AgentName, LLMCall
from .base import LLMResponse
from .cache import DiskCache, cache_key
from .ratelimit import (
    RateLimiter, RateLimitError, ServiceUnavailableError, with_backoff,
)
from .schema import to_gemini_schema

T = TypeVar("T", bound=BaseModel)

_RATE_LIMIT_MARKERS = ("429", "resource_exhausted", "quota", "rate limit")
_UNAVAILABLE_MARKERS = ("503", "unavailable", "high demand", "overloaded", "internal error", "500")


def _transient(exc: Exception) -> Exception | None:
    """Map a provider exception to a retryable one, or None if it is fatal."""
    text = f"{type(exc).__name__} {exc}".lower()
    if any(m in text for m in _RATE_LIMIT_MARKERS):
        return RateLimitError(str(exc))
    if any(m in text for m in _UNAVAILABLE_MARKERS):
        return ServiceUnavailableError(str(exc))
    return None


class GeminiClient:
    """LLMClient over google-genai.

    `on_call` is invoked with an LLMCall for every request, cache hits included --
    that is how the orchestrator builds the run's cost log without this class
    knowing what a Run is.
    """

    def __init__(
        self,
        api_key: str,
        *,
        cache: DiskCache | None = None,
        limiter: RateLimiter | None = None,
        on_call: Callable[[LLMCall], None] | None = None,
        run_id: str = "",
        agent: AgentName = AgentName.ORCHESTRATOR,
    ) -> None:
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set -- copy .env.example to .env")
        from google import genai  # imported here so tests need no SDK

        self._client = genai.Client(api_key=api_key)
        self._cache = cache
        self._limiter = limiter
        self._on_call = on_call
        self.run_id = run_id
        self.agent = agent

    def for_agent(self, agent: AgentName) -> GeminiClient:
        """A shallow view tagged with a different agent, so the call log attributes
        each request to the agent that made it."""
        clone = object.__new__(GeminiClient)
        clone.__dict__ = dict(self.__dict__)
        clone.agent = agent
        return clone

    # -- internals ----------------------------------------------------------------

    def _log(self, prompt: str, response: str, model: str, started: float, cache_hit: bool,
             usage: object = None) -> LLMResponse:
        tokens_in = getattr(usage, "prompt_token_count", None)
        tokens_out = getattr(usage, "candidates_token_count", None)
        latency_ms = int((time.perf_counter() - started) * 1000)
        if self._on_call:
            self._on_call(LLMCall(
                id=str(uuid.uuid4()), run_id=self.run_id, agent=self.agent, model=model,
                prompt=prompt, response=response, tokens_in=tokens_in,
                tokens_out=tokens_out, latency_ms=latency_ms, cache_hit=cache_hit,
            ))
        return LLMResponse(text=response, model=model, tokens_in=tokens_in,
                           tokens_out=tokens_out, latency_ms=latency_ms, cache_hit=cache_hit)

    async def _generate(self, prompt: str, *, model: str, temperature: float,
                        schema: type[BaseModel] | None) -> tuple[str, object]:
        config: dict = {"temperature": temperature}
        if schema is not None:
            config["response_mime_type"] = "application/json"
            # Gemini takes a trimmed OpenAPI schema, not full JSON Schema -- passing
            # the pydantic class directly 400s on additionalProperties/$defs/anyOf.
            config["response_schema"] = to_gemini_schema(schema)

        async def once():
            if self._limiter:
                await self._limiter.acquire()
            try:
                resp = await self._client.aio.models.generate_content(
                    model=model, contents=prompt, config=config
                )
            except Exception as exc:  # provider SDKs raise their own error types
                if (retryable := _transient(exc)) is not None:
                    raise retryable from exc
                raise
            return resp

        resp = await with_backoff(once)
        return (resp.text or ""), getattr(resp, "usage_metadata", None)

    # -- LLMClient ----------------------------------------------------------------

    async def complete(self, prompt: str, *, model: str, temperature: float = 0.0) -> LLMResponse:
        started = time.perf_counter()
        key = cache_key(model, prompt)
        if self._cache and (hit := self._cache.get(key)) is not None:
            return self._log(prompt, hit, model, started, cache_hit=True)

        text, usage = await self._generate(prompt, model=model, temperature=temperature, schema=None)
        if self._cache:
            self._cache.put(key, text, model=model, prompt=prompt)
        return self._log(prompt, text, model, started, cache_hit=False, usage=usage)

    async def complete_json(
        self, prompt: str, *, model: str, schema: type[T], temperature: float = 0.0
    ) -> tuple[T, LLMResponse]:
        """Return a validated `schema` instance, or raise. Agents never parse free text."""
        started = time.perf_counter()
        key = cache_key(model, prompt, schema.__name__)
        if self._cache and (hit := self._cache.get(key)) is not None:
            return schema.model_validate_json(hit), self._log(prompt, hit, model, started, cache_hit=True)

        text, usage = await self._generate(prompt, model=model, temperature=temperature, schema=schema)
        parsed = schema.model_validate_json(text)
        # cache the re-serialized form: it is known-valid, unlike raw provider output
        canonical = parsed.model_dump_json()
        if self._cache:
            self._cache.put(key, canonical, model=model, prompt=prompt)
        return parsed, self._log(prompt, canonical, model, started, cache_hit=False, usage=usage)

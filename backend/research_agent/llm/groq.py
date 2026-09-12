"""Groq provider. Implements the same LLMClient protocol as Gemini.

Why this exists as a peer rather than a fallback: the pipeline's two heavy stages have
opposite shapes. The Summarizer makes few calls with enormous inputs (a whole paper).
The Critic makes many calls with tiny inputs (one claim, one quote). Running the Critic
here spreads the load across two free tiers along a seam the architecture already has,
and short-input entailment is well within reach of a smaller, faster model.

Structured output: Groq's JSON mode is not schema-constrained the way Gemini's
response_schema is, so we inject the schema into the prompt and validate the reply.
One reprompt on a validation failure -- a malformed reply would otherwise silently
cost us a claim's verdict.
"""
from __future__ import annotations

import json
import time
import uuid
from collections.abc import Callable
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from ..models import AgentName, LLMCall
from .base import LLMResponse
from .cache import DiskCache, cache_key
from .ratelimit import RateLimiter, RateLimitError, with_backoff

T = TypeVar("T", bound=BaseModel)

_RATE_LIMIT_MARKERS = ("429", "rate limit", "rate_limit", "quota", "too many requests")

_JSON_INSTRUCTION = """

Reply with JSON only -- no prose, no markdown fence -- matching this schema exactly:
{schema}
"""


def _is_rate_limit(exc: Exception) -> bool:
    text = f"{type(exc).__name__} {exc}".lower()
    return any(m in text for m in _RATE_LIMIT_MARKERS)


def _strip_fence(text: str) -> str:
    """Models wrap JSON in ```json fences even when told not to."""
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.split("\n", 1)[-1] if "\n" in stripped else stripped
        stripped = stripped.rsplit("```", 1)[0]
    return stripped.strip()


class GroqClient:
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
            raise ValueError("GROQ_API_KEY is not set -- copy .env.example to .env")
        from groq import AsyncGroq

        self._client = AsyncGroq(api_key=api_key)
        self._cache = cache
        self._limiter = limiter
        self._on_call = on_call
        self.run_id = run_id
        self.agent = agent

    def _log(self, prompt: str, response: str, model: str, started: float,
             cache_hit: bool, usage=None) -> LLMResponse:
        tokens_in = getattr(usage, "prompt_tokens", None)
        tokens_out = getattr(usage, "completion_tokens", None)
        latency_ms = int((time.perf_counter() - started) * 1000)
        if self._on_call:
            self._on_call(LLMCall(
                id=str(uuid.uuid4()), run_id=self.run_id, agent=self.agent, model=model,
                prompt=prompt, response=response, tokens_in=tokens_in,
                tokens_out=tokens_out, latency_ms=latency_ms, cache_hit=cache_hit,
            ))
        return LLMResponse(text=response, model=model, tokens_in=tokens_in,
                           tokens_out=tokens_out, latency_ms=latency_ms, cache_hit=cache_hit)

    async def _chat(self, prompt: str, *, model: str, temperature: float, json_mode: bool):
        async def once():
            if self._limiter:
                await self._limiter.acquire()
            try:
                return await self._client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    **({"response_format": {"type": "json_object"}} if json_mode else {}),
                )
            except Exception as exc:
                if _is_rate_limit(exc):
                    raise RateLimitError(str(exc)) from exc
                raise

        resp = await with_backoff(once)
        return (resp.choices[0].message.content or ""), getattr(resp, "usage", None)

    async def complete(self, prompt: str, *, model: str, temperature: float = 0.0) -> LLMResponse:
        started = time.perf_counter()
        key = cache_key(model, prompt)
        if self._cache and (hit := self._cache.get(key)) is not None:
            return self._log(prompt, hit, model, started, cache_hit=True)
        text, usage = await self._chat(prompt, model=model, temperature=temperature, json_mode=False)
        if self._cache:
            self._cache.put(key, text, model=model, prompt=prompt)
        return self._log(prompt, text, model, started, cache_hit=False, usage=usage)

    async def complete_json(
        self, prompt: str, *, model: str, schema: type[T], temperature: float = 0.0
    ) -> tuple[T, LLMResponse]:
        started = time.perf_counter()
        key = cache_key(model, prompt, schema.__name__)
        if self._cache and (hit := self._cache.get(key)) is not None:
            return schema.model_validate_json(hit), self._log(prompt, hit, model, started, cache_hit=True)

        full = prompt + _JSON_INSTRUCTION.replace(
            "{schema}", json.dumps(schema.model_json_schema(), indent=2)
        )
        text, usage = await self._chat(full, model=model, temperature=temperature, json_mode=True)
        try:
            parsed = schema.model_validate_json(_strip_fence(text))
        except ValidationError as first:
            # One corrective reprompt. Losing a verdict to a stray fence would quietly
            # bias the evaluation, so it is worth the extra call.
            retry = full + f"\n\nYour previous reply was invalid:\n{first}\nReply with valid JSON only."
            text, usage = await self._chat(retry, model=model, temperature=temperature, json_mode=True)
            parsed = schema.model_validate_json(_strip_fence(text))

        canonical = parsed.model_dump_json()
        if self._cache:
            self._cache.put(key, canonical, model=model, prompt=prompt)
        return parsed, self._log(prompt, canonical, model, started, cache_hit=False, usage=usage)

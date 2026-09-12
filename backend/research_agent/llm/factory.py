"""Builds the configured LLM client. One place, used by the API, the CLI and the eval.

Degrades deliberately: if GROQ_API_KEY is missing, everything runs on Gemini rather
than failing. A missing optional provider should cost you quota headroom, not a run.
"""
from __future__ import annotations

from collections.abc import Callable

from ..config import Settings, settings as default_settings
from ..models import LLMCall
from .base import LLMClient
from .cache import DiskCache
from .gemini import GeminiClient
from .ratelimit import RateLimiter
from .router import LLMRouter


def build_llm(
    *,
    run_id: str = "",
    on_call: Callable[[LLMCall], None] | None = None,
    settings: Settings | None = None,
) -> LLMClient:
    st = settings or default_settings
    cache = DiskCache(st.cache_dir)

    gemini = GeminiClient(
        st.gemini_api_key, cache=cache,
        limiter=RateLimiter(st.limits.requests_per_minute),
        on_call=on_call, run_id=run_id,
    )

    if not st.groq_api_key:
        return gemini

    from .groq import GroqClient

    groq = GroqClient(
        st.groq_api_key, cache=cache,
        # separate bucket: the two providers have independent quotas
        limiter=RateLimiter(st.limits.groq_requests_per_minute),
        on_call=on_call, run_id=run_id,
    )
    # anything not named gemini-* goes to Groq
    return LLMRouter({"gemini": gemini}, default=groq)


def describe(client: LLMClient) -> str:
    if isinstance(client, LLMRouter):
        return ", ".join(f"{p} -> {n}" for p, n in client.providers().items())
    return type(client).__name__

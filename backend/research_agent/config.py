"""Configuration. Model choices live here so switching provider is one edit.

TODO(Track A): load from environment, validate required keys at startup.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ModelRoles:
    """Which model does which job.

    High-volume summarizing goes to the cheap fast tier; the Critic and Planner need
    stronger instruction-following. Verify current free-tier rate limits before each
    review and size `max_papers` to fit -- free tier terms change.
    """

    # MEASURED on the free tier (2026-09): Pro-tier models return 429 RESOURCE_EXHAUSTED
    # immediately -- the free quota covers flash models only. Everything Gemini-side is
    # therefore flash. This is a constraint to state in the report, not a shortcut.
    #
    # `-latest` follows the current release. That is right for development, where a
    # pinned id can be retired underneath you mid-semester (gemini-2.5-pro was, during
    # this project). Before the week-7 evaluation, PIN an exact version here and record
    # it in the methodology -- results are not reproducible against a moving alias.
    planner: str = "gemini-flash-latest"
    summarizer: str = "gemini-flash-latest"   # long inputs (whole papers), few calls
    critic: str = "llama-3.3-70b-versatile"   # tiny inputs, ~60 calls/run -- routed to Groq
    synthesizer: str = "gemini-flash-latest"

    # Routing is by model-name prefix: gemini-* goes to Gemini, everything else to Groq
    # (see llm/router.py). Set critic to a gemini-* name to put it all on one provider.


@dataclass(frozen=True)
class Limits:
    max_papers: int = 12
    max_sub_queries: int = 5
    max_claims_per_paper: int = 8
    # At 5 requests/minute there is no point launching 4 summaries at once -- they
    # just queue on the limiter. Concurrency above the rate limit buys nothing.
    summarizer_concurrency: int = 2
    critic_concurrency: int = 4               # Critic runs on Groq, a separate bucket
    # MEASURED 2026-09 on the free tier: gemini-flash-latest (-> gemini-3.8-flash)
    # allows 5 requests/minute. Re-check before each review; free tiers move.
    requests_per_minute: int = 5              # Gemini bucket
    groq_requests_per_minute: int = 25        # Groq bucket -- independent quota
    span_match_threshold: float = 92.0        # rapidfuzz score below this = QUOTE_NOT_FOUND


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    groq_api_key: str = field(default_factory=lambda: os.getenv("GROQ_API_KEY", ""))
    s2_api_key: str = field(default_factory=lambda: os.getenv("SEMANTIC_SCHOLAR_API_KEY", ""))
    contact_email: str = field(default_factory=lambda: os.getenv("CONTACT_EMAIL", ""))
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./research.db"))
    cache_dir: str = field(default_factory=lambda: os.getenv("LLM_CACHE_DIR", "./llm_cache"))

    models: ModelRoles = field(default_factory=ModelRoles)
    limits: Limits = field(default_factory=Limits)


settings = Settings()

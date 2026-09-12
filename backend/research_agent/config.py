"""Configuration. Model choices live here so switching provider is one edit.

Values come from the environment via .env (see .env.example). Model ids and limits
below were measured against the live free tier, not assumed -- see ModelRoles.
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

    # MEASURED on the free tier (2026-09), not assumed:
    #
    #  * Pro-tier models (gemini-pro-latest, gemini-3.1-pro-preview) return 429
    #    immediately. The free quota covers flash models only.
    #  * EACH MODEL HAS ITS OWN QUOTA BUCKET. gemini-3.8-flash hit a daily cap after
    #    ~20 requests while gemini-2.5-flash still answered -- so spreading roles
    #    across models spreads them across quotas.
    #  * Avoid `-latest` aliases: they resolve to the NEWEST model, which carries the
    #    tightest free-tier cap, and a moving alias also makes evaluation results
    #    irreproducible. Pin exact ids and record them in the methodology.
    #
    # Re-measure before each review; free tiers move.
    planner: str = "gemini-2.5-flash"         # 1 call/run
    summarizer: str = "gemini-2.5-flash"      # P calls/run, long inputs (whole papers)
    # Groq retired the Llama models; checked against the live model list 2026-09-13.
    # gpt-oss-120b and gpt-oss-20b both caught a dropped "not" (CONTRADICTED) in a
    # live test. 20b is the fallback if 120b's free-tier quota runs short.
    critic: str = "openai/gpt-oss-120b"       # ~1 call per claim -- routed to Groq entirely
    synthesizer: str = "gemini-3.5-flash"     # 1 call/run, separate bucket from the above

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

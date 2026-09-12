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

    planner: str = "gemini-2.5-pro"
    summarizer: str = "gemini-2.5-flash"      # highest call volume -- keep this cheap
    critic: str = "gemini-2.5-pro"            # claim verification: accuracy matters most
    synthesizer: str = "gemini-2.5-pro"


@dataclass(frozen=True)
class Limits:
    max_papers: int = 12
    max_sub_queries: int = 5
    max_claims_per_paper: int = 8
    summarizer_concurrency: int = 4           # bounded fan-out; respect the rate limit
    critic_concurrency: int = 4
    requests_per_minute: int = 12
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

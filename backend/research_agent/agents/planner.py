"""Query Planner -- breaks a research question into 3-6 focused sub-questions.

Good sub-queries are the difference between retrieving 20 relevant papers and 20
vaguely-related ones. Give each an intent tag so Synthesis can group themes later,
and deliberately include at least one CONTRADICTION intent so the report surfaces
disagreement rather than only confirming evidence.

TODO(Track A): implement with llm.complete_json(schema=Plan).
"""
from __future__ import annotations

from ..llm.base import LLMClient
from ..models import Plan


async def plan_query(question: str, llm: LLMClient, *, model: str, max_sub_queries: int = 5) -> Plan:
    raise NotImplementedError("TODO(Track A)")

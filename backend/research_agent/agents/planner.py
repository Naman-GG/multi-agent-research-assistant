"""Query Planner -- breaks a research question into focused sub-questions.

Good sub-queries are the difference between retrieving 20 relevant papers and 20
vaguely-related ones. Each carries an intent tag so Synthesis can group themes, and
we force at least one `contradiction` intent so the review surfaces disagreement
rather than only confirming evidence.
"""
from __future__ import annotations

from ..llm.base import LLMClient
from ..models import Plan, SubQuery, SubQueryIntent
from ..prompts import render


async def plan_query(
    question: str, llm: LLMClient, *, model: str, max_sub_queries: int = 5
) -> Plan:
    prompt = render("planner", question=question, max_sub_queries=max_sub_queries)
    plan, _ = await llm.complete_json(prompt, model=model, schema=Plan)

    # The model sets its own question field inconsistently; ours is authoritative.
    plan.question = question
    plan.sub_queries = plan.sub_queries[:max_sub_queries]

    for i, sq in enumerate(plan.sub_queries, start=1):
        if not sq.id:
            sq.id = f"SQ{i}"

    if not any(sq.intent is SubQueryIntent.CONTRADICTION for sq in plan.sub_queries):
        # Do not silently accept a one-sided plan -- retag the last sub-query rather
        # than spending another call. A review that only confirms is a bad review.
        if plan.sub_queries:
            plan.sub_queries[-1].intent = SubQueryIntent.CONTRADICTION

    if not plan.sub_queries:
        raise ValueError("planner returned no sub-queries")
    return plan

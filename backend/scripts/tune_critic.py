"""Ad-hoc runner for tuning prompts/critic.md and prompts/repair.md against live output.

Not part of the test suite -- these are real Groq API calls, spending real quota.
Every case here is a judgement call the prompt has to get right; read the reasoning
each one prints, not just the label, before deciding the prompt needs a change.

Run from backend/:  python -m scripts.tune_critic
"""
from __future__ import annotations

import asyncio
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from research_agent.config import settings
from research_agent.llm.groq import GroqClient
from research_agent.models import Claim, VerdictLabel
from research_agent.verification.entailment import repair_claim, verify_claim

CASES = [
    ("supported -- direct match",
     "Dexamethasone lowered 28-day mortality in ventilated COVID-19 patients.",
     "In the dexamethasone group, 28-day mortality among patients receiving invasive "
     "mechanical ventilation was 29.3%, as compared with 41.4% in the usual care group."),

    ("partial -- claim overreaches the quote's scope",
     "Dexamethasone lowered mortality in all COVID-19 patients.",
     "In the dexamethasone group, 28-day mortality among patients receiving invasive "
     "mechanical ventilation was 29.3%, as compared with 41.4% in the usual care group."),

    ("unsupported -- same topic, quote doesn't establish this claim",
     "Dexamethasone shortened hospital stay by five days.",
     "In the dexamethasone group, 28-day mortality among patients receiving invasive "
     "mechanical ventilation was 29.3%, as compared with 41.4% in the usual care group."),

    ("contradicted -- claim states the opposite of the quote",
     "Dexamethasone increased 28-day mortality in ventilated patients.",
     "In the dexamethasone group, 28-day mortality among patients receiving invasive "
     "mechanical ventilation was 29.3%, as compared with 41.4% in the usual care group."),
]


async def main() -> None:
    if not settings.groq_api_key:
        raise SystemExit("GROQ_API_KEY is not set -- fill it in .env first")

    llm = GroqClient(settings.groq_api_key)
    model = settings.models.critic
    print(f"model: {model}\n")

    for label, claim_text, quote in CASES:
        claim = Claim(id="tune", paper_id="tune", text=claim_text, quote=quote)
        verdict = await verify_claim(claim, quote, llm, model=model)

        print(f"=== {label} ===")
        print(f"claim: {claim_text}")
        print(f"quote: {quote}")
        print(f"-> {verdict.label.value}  (confidence={verdict.confidence})")
        print(f"   reasoning: {verdict.reasoning}")

        if verdict.label is VerdictLabel.PARTIAL:
            repaired = await repair_claim(claim, quote, verdict, llm, model=model)
            print(f"   repair -> {repaired.text if repaired else 'null (unsalvageable)'}")
        print()


if __name__ == "__main__":
    asyncio.run(main())

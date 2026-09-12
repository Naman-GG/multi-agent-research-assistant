"""Drive the pipeline with no UI. The fastest way to test anything.

    python -m backend.cli run "Do statins reduce dementia risk?" --max-papers 8
    python -m backend.cli replay RUN-XXXX
    python -m backend.cli show RUN-XXXX --rejected
    python -m backend.cli list

`replay` re-serves a completed run with zero API calls. Record one the night before
each review -- it is the demo's insurance policy.
"""
from __future__ import annotations

import argparse
import asyncio
import sys

from dotenv import load_dotenv

from .research_agent import db
from .research_agent.config import settings
from .research_agent.events import EventBus
from .research_agent.llm.factory import build_llm, describe
from .research_agent.models import AgentName, RunConfig, VerdictLabel, VerificationStage
from .research_agent.orchestrator import replay as replay_run
from .research_agent.orchestrator import run_pipeline
from .research_agent.sources.openalex import OpenAlexSource

_AGENT_WIDTH = max(len(a.value) for a in AgentName)


async def _print_trace(bus: EventBus) -> None:
    async for event in bus.subscribe():
        print(f"  [{event.agent.value:<{_AGENT_WIDTH}}] {event.message}", flush=True)


async def cmd_run(args) -> int:
    db.init_db(settings.database_url)
    config = RunConfig(
        max_papers=args.max_papers,
        max_sub_queries=args.max_sub_queries,
        year_from=args.year_from,
    )
    run_id_holder: dict[str, str] = {}
    bus = EventBus("pending")
    printer = asyncio.create_task(_print_trace(bus))

    llm = build_llm(on_call=db.save_llm_call)
    print(f"  providers: {describe(llm)}\n")
    try:
        run = await run_pipeline(args.question, llm, [OpenAlexSource()],
                                 config=config, bus=bus)
    except Exception as exc:
        await printer
        print(f"\nrun failed: {exc}", file=sys.stderr)
        return 1
    await printer

    print(f"\nrun {run.id}")
    accepted = run.accepted_claims()
    print(f"  {len(run.papers)} papers, {len(run.claims())} claims, "
          f"{len(accepted)} verified")
    cost = db.llm_cost(run.id)
    print(f"  {cost['calls']} LLM calls ({cost['cache_hits']} cached), "
          f"{cost['tokens_in'] + cost['tokens_out']} tokens")
    if run.report:
        print("\n" + run.report.markdown)
    return 0


async def cmd_replay(args) -> int:
    db.init_db(settings.database_url)
    bus = EventBus(args.run_id)
    printer = asyncio.create_task(_print_trace(bus))
    try:
        run = await replay_run(args.run_id, bus=bus, speed=args.speed)
    except LookupError as exc:
        print(exc, file=sys.stderr)
        return 1
    await printer
    if run.report:
        print("\n" + run.report.markdown)
    return 0


def cmd_show(args) -> int:
    db.init_db(settings.database_url)
    run = db.load_run(args.run_id)
    if run is None:
        print(f"no such run: {args.run_id}", file=sys.stderr)
        return 1

    verified = run.verified_claims()
    shown = [vc for vc in verified if not vc.accepted] if args.rejected else verified
    if args.rejected and not shown:
        print("no rejected claims in this run")
        return 0

    for vc in shown:
        paper = run.paper(vc.claim.paper_id)
        label = vc.final_label.value if vc.final_label else "unverified"
        mark = "x" if not vc.accepted else "+"
        print(f"\n{mark} [{label}] {vc.claim.id}  ({paper.title[:56] if paper else '?'})")
        print(f"    claim: {vc.claim.text}")
        print(f"    quote: {vc.claim.quote[:160]}")
        for verdict in vc.verdicts:
            detail = verdict.reasoning or (
                f"match score {verdict.match_score:.0f}" if verdict.match_score is not None else ""
            )
            print(f"      {verdict.stage.value:<10} {verdict.label.value:<16} {detail}")
        if not vc.accepted and vc.verdict_for(VerificationStage.SPAN) and \
                vc.verdict_for(VerificationStage.SPAN).label is VerdictLabel.QUOTE_NOT_FOUND:
            print("      ^ this quote appears nowhere in the source paper")
    return 0


def cmd_list(args) -> int:
    db.init_db(settings.database_url)
    rows = db.list_runs(args.limit)
    if not rows:
        print("no runs yet")
        return 0
    for run_id, question, status, created in rows:
        print(f"{run_id}  {status:<11} {created:%Y-%m-%d %H:%M}  {question[:60]}")
    return 0


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(prog="backend.cli", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="run the pipeline on a question")
    p_run.add_argument("question")
    p_run.add_argument("--max-papers", type=int, default=settings.limits.max_papers)
    p_run.add_argument("--max-sub-queries", type=int, default=settings.limits.max_sub_queries)
    p_run.add_argument("--year-from", type=int, default=None)

    p_replay = sub.add_parser("replay", help="re-serve a stored run, no API calls")
    p_replay.add_argument("run_id")
    p_replay.add_argument("--speed", type=float, default=4.0)

    p_show = sub.add_parser("show", help="inspect a run's claims and verdicts")
    p_show.add_argument("run_id")
    p_show.add_argument("--rejected", action="store_true", help="only rejected claims")

    p_list = sub.add_parser("list", help="list stored runs")
    p_list.add_argument("--limit", type=int, default=20)

    args = parser.parse_args()
    if args.command == "run":
        raise SystemExit(asyncio.run(cmd_run(args)))
    if args.command == "replay":
        raise SystemExit(asyncio.run(cmd_replay(args)))
    if args.command == "show":
        raise SystemExit(cmd_show(args))
    raise SystemExit(cmd_list(args))


if __name__ == "__main__":
    main()

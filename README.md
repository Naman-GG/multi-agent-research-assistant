# Multi-Agent Research Assistant

A five-agent pipeline that turns a research question into a cited literature review,
where **every claim is verified against its source before it reaches the report**.

Full plan, architecture and schedule: [`docs/Capstone-Plan.pdf`](docs/Capstone-Plan.pdf)

```
Planner ─▶ Retriever ─▶ Summarizer ─▶ Critic ─▶ Synthesis
                            │            │
                   one paper at a time   Stage 1 span check (free)
                                         Stage 2 LLM entailment
```

## The one idea

The Summarizer is not allowed to write prose. It emits atomic claims, each carrying a
**verbatim quote** from the paper. That makes two checks possible:

1. **Stage 1** — is the quote actually in the paper? Plain text search, no LLM, no cost.
   Catches fabricated quotes for free.
2. **Stage 2** — does the quote actually support the claim? An LLM Critic sees only
   that one claim and that one quote — never the paper, never the other papers.

Only claims passing both reach the report. Rejections are kept and shown, not hidden.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add your free Gemini key
pytest                      # 11 contract tests should pass
```

## Layout

```
backend/research_agent/     the pipeline — never imports FastAPI
  models.py                 ★ THE CONTRACT — all three tracks import this
  llm/                      provider adapter, cache, rate limiter
  agents/                   planner, retriever, summarizer, critic, synthesizer
  sources/                  openalex, arxiv, semantic_scholar, crossref, dedupe
  verification/             span_check.py (Stage 1), entailment.py (Stage 2)
  prompts/                  prompts as files, not string literals
backend/api/                FastAPI + SSE
backend/eval/               baseline, metrics, the study
frontend/                   React — trace, report, evidence pane
fixtures/sample_run.json    ★ hand-written run — unblocks all three tracks
```

## The two files that matter most

**`backend/research_agent/models.py`** — every module imports it. Changing it is a
conversation, not a commit.

**`fixtures/sample_run.json`** — a complete run, hand-written, covering every state:
full-text and abstract-only papers, supported claims, a claim rejected at Stage 1 for a
fabricated quote, and a PARTIAL claim that was repaired. All three tracks build against
it from day 2, so nobody waits for anybody.

`backend/tests/test_contract.py` fails if those two ever drift apart. Keep it green.

## Tracks

| Track | Owns |
|---|---|
| **A — Runtime & Agents** | LLM adapter, Planner/Summarizer/Synthesis, prompts, orchestrator, events, database, FastAPI |
| **B — Retrieval & Interface** | 4 academic APIs, dedupe, PDF extraction, the React frontend |
| **C — Verification & Evaluation** | Span checker, Critic, repair loop, baseline, metrics, labeling, statistics |

Stubs are marked `TODO(Track X)` so it is always clear whose file you are in.

## Running it

```bash
python -m backend.cli run "Do statins reduce dementia risk?" --max-papers 8
python -m backend.cli replay RUN-SAMPLE-001   # cached, zero API calls

uvicorn api.main:app --reload    # :8000
cd frontend && npm run dev       # :5173

python -m eval.run_eval --systems both
```

## Free-tier discipline

Gemini's free tier has hard caps. Four things keep that from becoming a problem:
a disk cache keyed on the prompt hash, a token-bucket rate limiter, `replay` mode for
demos, and every LLM call logged for the cost analysis.

**Record a replay run the night before each review.** If the network or the quota dies
in front of the examiner, the demo still works.

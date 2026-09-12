# Review 1 — Work Checklist

Internal working document. Names on it, unlike `Capstone-Plan.pdf`.

**Goal:** one research question goes in, a cited report comes out, and we can show the
Critic rejecting a real fabricated claim on screen.

Week 1's joint work — repo, `models.py`, `fixtures/sample_run.json` — is **done**.
Everyone starts on their own list immediately.

---

## Deliberately out of scope for Review 1

Say this openly at the review and show the Review 2 plan. A narrow slice that works
beats a broad one that breaks.

- One search source (OpenAlex) — arXiv, Semantic Scholar, Crossref come in week 5
- Abstracts only — no PDF full-text extraction
- Sequential summarizing — parallel fan-out comes in week 5
- No evaluation numbers — the study is Review 2

---

## Naman — Track A, Runtime & Agents

Biggest load, because everything integrates through this track.

### LLM layer
- [x] `llm/cache.py` — `get()` / `put()` over JSON files in `settings.cache_dir`
- [x] `llm/ratelimit.py` — `RateLimiter.acquire()` token bucket; `with_backoff()` on 429
- [x] `llm/gemini.py` — `complete()` and `complete_json()`, routed through cache + limiter

*Done when:* `complete_json()` returns a validated pydantic object, a repeat call is a
cache hit, and every call is logged as an `LLMCall`.

### Agents
- [x] `agents/planner.py` — `plan_query()`, 3–6 sub-queries, ≥1 with `contradiction` intent
- [x] `agents/summarizer.py` — `summarize_paper()`, ONE paper per call
- [x] `agents/retriever.py` — `retrieve()`: fan sub-queries across sources, merge, rank, truncate
- [x] `agents/synthesizer.py` — `synthesize()`, citations assigned mechanically from `paper_id`

*Done when:* the Summarizer's output validates as `ClaimList` and every quote it emits is
findable in the source. If quotes aren't verbatim, fix the prompt — don't loosen the checker.

### Runtime
- [x] `events.py` — `EventBus.emit()` / `subscribe()`, monotonic `seq`
- [x] `db.py` — SQLModel tables, `init_db`, `save_run`, `load_run`
- [x] `orchestrator.py` — `run_pipeline()` and `replay()`
- [x] `api/main.py` — `POST /runs`, `GET /runs/{id}`, `GET /runs/{id}/events` (SSE), `GET /runs/{id}/report`
- [x] `cli.py` — `run` and `replay`

### Prompts
- [ ] Tune `prompts/planner.md`, `summarizer.md`, `synthesizer.md`

---

## Sarvyagya — Track B, Retrieval & Interface

### Retrieval
- [ ] `sources/openalex.py` — `reconstruct_abstract()` + `search()`
- [ ] `sources/dedupe.py` — `normalize_doi()`, `normalize_title()`, `merge()`

Two gotchas that each cost a day if you hit them cold:
1. OpenAlex returns abstracts as an **inverted index** (`{word: [positions]}`), not a
   string. You have to rebuild them.
2. Put `CONTACT_EMAIL` in the User-Agent — it moves you to the faster "polite pool".

Set `availability` honestly: `FULL_TEXT` only when `full_text` is really populated.
Verification downstream depends on that being accurate.

*Not for Review 1:* arXiv, Semantic Scholar, Crossref, `fulltext.py`. Those are week 5.

### Frontend
- [ ] Vite + React + TS + Tailwind scaffold
- [ ] `src/api/client.ts` — fetch wrapper
- [ ] `src/hooks/useRunEvents.ts` — EventSource, resume from last `seq`
- [ ] `src/pages/NewRun.tsx` — question, sources, max papers
- [ ] `src/pages/RunTrace.tsx` — live agent timeline
- [ ] `src/pages/Report.tsx` — cited report + claim table
- [ ] `src/components/AgentTimeline.tsx`
- [ ] `src/components/PaperCard.tsx` — flag abstract-only papers visibly
- [ ] `src/components/ClaimRow.tsx` + `VerdictBadge.tsx`
- [ ] **`src/components/EvidencePane.tsx`** — the one that matters
- [ ] `src/components/CitationHover.tsx`

`EvidencePane`: claim on the left, source text on the right with `quote_start`..`quote_end`
highlighted, verdict between them. **Show rejected claims — do not hide them.** A claim
displayed next to the source its quote never appeared in is the most convincing thing in
the project.

Build all of it against `fixtures/sample_run.json` — don't wait for the API. See
`frontend/README.md`.

---

## Mitaali — Track C, Verification

Her whole Review 1 scope is verification. **Nothing in `backend/eval/` before week 6** —
baseline, metrics, labeling tool, dataset and statistics are all Review 2.

- [x] `verification/span_check.py` — `normalize()`, `find_span()`, `check_span()`
- [x] Remove the 10 `xfail` markers in `backend/tests/test_span_check.py` as they go green
- [x] `verification/entailment.py` — `verify_claim()`, `repair_claim()`
- [x] `agents/critic.py` — `verify_all()`, bounded concurrency, one-attempt repair loop
- [ ] Tune `prompts/critic.md` and `prompts/repair.md`
- [x] Fabrication-injection test — corrupt a real quote, prove the Critic catches it

Start with `span_check.py`. It needs no API key, no database, no network — pure string
work with the tests already written as a spec.

The one judgement call is the fuzzy threshold (`Limits.span_match_threshold`, currently
92.0). Too low and fabrications slip through; too high and honest quotes mangled by PDF
extraction get rejected. **Write down the number you pick and why** — that's a result for
the report, not a config detail.

*This is on the Review 1 critical path.* The demo ends on a rejected claim, and that
rejection is this code. It is not a Review 2 workstream.

---

## Week 4 — joint

- [ ] Slide deck — `Capstone-Plan.pdf` Part 6, slides 1–14 and 16–17 (15 is results, Review 2)
- [ ] Demo script written and rehearsed
- [ ] **Replay run recorded** the night before

**Demo script:** submit a question with known contested findings → trace fills in live,
agent by agent → land on the finished cited report → open a rejected claim and show its
quote appears nowhere in the source paper.

Demo from the replay recording, not a live run. If the network or the free-tier quota
dies in front of the examiner, the demo still works.

---

## The one hard date

**Mid week 3 — first end-to-end run.** Question in, claims out, verdicts attached.

By then Naman needs the orchestrator running, Sarvyagya needs OpenAlex returning real
papers, and Mitaali needs `check_span()` working. Everything before that point is three
people working against a JSON file; this is where it becomes one system.

If this slips, Review 1 is at risk. Treat it as fixed.

---

## Keeping the contract intact

`backend/tests/test_contract.py` must stay green. It fails if `models.py` and
`fixtures/sample_run.json` drift apart, which is the one failure mode that silently
breaks all three tracks at once.

`Claim.quote` must always be verbatim from the source. If anyone proposes dropping the
quote field or letting it paraphrase "to simplify things", Stage 1 stops existing and
the project loses its contribution.

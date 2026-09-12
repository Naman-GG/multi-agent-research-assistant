# Frontend — Track B

React + Vite + TypeScript + Tailwind.

## Scaffold it

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install -D tailwindcss @tailwindcss/vite
```

`src/api/types.ts` already exists and mirrors the backend contract — do not regenerate
or rename it, the whole team codes against those shapes.

## Build against the fixture, not the API

The backend does not need to exist for you to build the entire UI:

```ts
import sampleRun from '../../fixtures/sample_run.json';
import type { Run } from './api/types';

const run = sampleRun as unknown as Run;
```

The fixture covers every state you need to render: a full-text paper, an abstract-only
paper, supported claims, a claim rejected at Stage 1 for a fabricated quote, and a
claim that was PARTIAL then repaired.

## Three screens

| Route | What it does |
|---|---|
| `/` | Submit a research question, pick sources and max papers |
| `/run/:id` | **Live agent trace** — events streaming in over SSE, agent by agent |
| `/report/:id` | The cited report, plus the claim table and the evidence pane |

## The evidence pane is the demo

This is the component that sells the project. A claim on the left, the source text on
the right with `quote_start`..`quote_end` highlighted, and the verdict between them.

Show rejected claims too — do not hide them. A claim whose quote appears nowhere in the
source, displayed next to the source it supposedly came from, is the single most
convincing thing in the project.

Mark abstract-only papers visibly: a claim drawn from an abstract is weaker evidence
and the interface should say so.

## Live trace

```ts
const es = new EventSource(`/api/runs/${id}/events?from_seq=${lastSeq}`);
```

`RunEvent.seq` is monotonic, so track the last one you saw and resume from it after a
reconnect rather than losing the trace.

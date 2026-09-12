// Mirror of backend/research_agent/models.py — THE SAME CONTRACT, in TypeScript.
//
// If models.py changes, this changes with it. The fixture at fixtures/sample_run.json
// validates against both, so it is the thing to test against when they drift.
//
// Track B builds the entire UI against the fixture before the API exists:
//   import sampleRun from '../../../fixtures/sample_run.json'
//   const run = sampleRun as Run

export type RunStatus =
  | 'pending' | 'planning' | 'retrieving' | 'summarizing'
  | 'verifying' | 'synthesizing' | 'completed' | 'failed';

export type SubQueryIntent = 'background' | 'method' | 'finding' | 'contradiction';

export type TextAvailability = 'full_text' | 'abstract_only';

export type VerificationStage = 'span' | 'entailment';

export type VerdictLabel =
  | 'quote_found' | 'quote_not_found'              // Stage 1
  | 'supported' | 'partial' | 'unsupported' | 'contradicted'; // Stage 2

export type AgentName =
  | 'planner' | 'retriever' | 'summarizer' | 'critic' | 'synthesizer' | 'orchestrator';

export type EventType =
  | 'run_started' | 'stage_started' | 'stage_completed' | 'sub_queries_planned'
  | 'papers_retrieved' | 'paper_summarized' | 'claim_verified' | 'claim_repaired'
  | 'report_ready' | 'run_completed' | 'error';

export interface Author {
  name: string;
  orcid: string | null;
}

export interface PaperRef {
  id: string;
  title: string;
  source_api: string;
  availability: TextAvailability;
  doi: string | null;
  authors: Author[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  /** Extracted PDF text. null when availability is 'abstract_only'. */
  full_text: string | null;
  url: string | null;
  oa_pdf_url: string | null;
  citation_count: number | null;
}

/** What the span checker searched — and what the evidence pane must highlight into. */
export function sourceText(paper: PaperRef): string {
  return paper.availability === 'full_text' && paper.full_text
    ? paper.full_text
    : (paper.abstract ?? '');
}

export interface SubQuery {
  id: string;
  text: string;
  keywords: string[];
  intent: SubQueryIntent;
  rationale: string;
}

export interface Plan {
  question: string;
  sub_queries: SubQuery[];
}

export interface Claim {
  id: string;
  paper_id: string;
  /** The atomic claim, in the system's words. */
  text: string;
  /** VERBATIM span from the paper. The evidence pane highlights this. */
  quote: string;
  section: string | null;
  /** Character offsets into sourceText(paper). null until Stage 1 locates the quote. */
  quote_start: number | null;
  quote_end: number | null;
}

export interface PaperSummary {
  id: string;
  paper_id: string;
  model: string;
  claims: Claim[];
  created_at: string;
}

export interface Verdict {
  claim_id: string;
  stage: VerificationStage;
  label: VerdictLabel;
  confidence: number | null;
  reasoning: string | null;
  /** null for Stage 1 — no LLM was used. */
  model: string | null;
  /** Fuzzy match score, Stage 1 only. */
  match_score: number | null;
  is_repair_attempt: boolean;
  created_at: string;
}

export interface Citation {
  marker: number;
  paper_id: string;
  claim_ids: string[];
}

export interface Theme {
  title: string;
  claim_ids: string[];
}

export interface Report {
  markdown: string;
  citations: Citation[];
  themes: Theme[];
  bibtex: string;
}

export interface RunEvent {
  /** Monotonic per run — resume the SSE stream with ?from_seq= after a reconnect. */
  seq: number;
  run_id: string;
  agent: AgentName;
  type: EventType;
  message: string;
  payload: Record<string, unknown>;
  ts: string;
}

export interface RunConfig {
  max_papers: number;
  max_sub_queries: number;
  sources: string[];
  year_from: number | null;
  year_to: number | null;
  allow_abstract_only: boolean;
}

export interface Run {
  id: string;
  question: string;
  status: RunStatus;
  config: RunConfig;
  plan: Plan | null;
  papers: PaperRef[];
  summaries: PaperSummary[];
  verdicts: Verdict[];
  report: Report | null;
  events: RunEvent[];
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

// --- helpers the UI needs everywhere ---------------------------------------------

export const allClaims = (run: Run): Claim[] =>
  run.summaries.flatMap((s) => s.claims);

export const verdictsFor = (run: Run, claimId: string): Verdict[] =>
  run.verdicts.filter((v) => v.claim_id === claimId);

export const finalLabel = (run: Run, claimId: string): VerdictLabel | null => {
  const vs = verdictsFor(run, claimId);
  return vs.length ? vs[vs.length - 1].label : null;
};

/** Only 'supported' claims reach the report. Everything else is shown as rejected. */
export const isAccepted = (run: Run, claimId: string): boolean =>
  finalLabel(run, claimId) === 'supported';

export const paperById = (run: Run, paperId: string): PaperRef | undefined =>
  run.papers.find((p) => p.id === paperId);

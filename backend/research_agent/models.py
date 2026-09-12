"""Shared data contracts for the multi-agent research assistant.

THIS FILE IS THE INTERFACE BETWEEN ALL THREE TRACKS.

    Track A (Runtime & Agents)        produces Plan, PaperSummary, Claim, Report
    Track B (Retrieval & Interface)   produces PaperRef; consumes everything for the UI
    Track C (Verification & Eval)     consumes Claim; produces Verdict

Changing anything here is a conversation, not a commit -- every other module imports
from this one. `fixtures/sample_run.json` must always validate against `Run`; the test
in `backend/tests/test_contract.py` enforces that.

The single most important invariant in the project:

    A Claim must always carry a `quote` copied VERBATIM from its paper's source text.

Stage 1 verification is nothing more than checking that `quote` really occurs in
`PaperRef.source_text()`. If the quote field is ever dropped or allowed to paraphrase,
Stage 1 stops working and the project loses its contribution.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------------------
# Enums
# --------------------------------------------------------------------------------------


class RunStatus(str, Enum):
    PENDING = "pending"
    PLANNING = "planning"
    RETRIEVING = "retrieving"
    SUMMARIZING = "summarizing"
    VERIFYING = "verifying"
    SYNTHESIZING = "synthesizing"
    COMPLETED = "completed"
    FAILED = "failed"


class SubQueryIntent(str, Enum):
    """What a sub-query is trying to find. Lets the Synthesis agent group themes."""

    BACKGROUND = "background"
    METHOD = "method"
    FINDING = "finding"
    CONTRADICTION = "contradiction"


class TextAvailability(str, Enum):
    """How much of a paper we actually hold.

    A claim drawn from an abstract is weaker evidence than one drawn from full text,
    and the interface must say so.
    """

    FULL_TEXT = "full_text"
    ABSTRACT_ONLY = "abstract_only"


class VerificationStage(str, Enum):
    SPAN = "span"            # Stage 1 -- deterministic, free
    ENTAILMENT = "entailment"  # Stage 2 -- LLM Critic


class VerdictLabel(str, Enum):
    # Stage 1 outcomes
    QUOTE_FOUND = "quote_found"
    QUOTE_NOT_FOUND = "quote_not_found"   # fabricated quote -- reject, never reaches Stage 2
    # Stage 2 outcomes
    SUPPORTED = "supported"
    PARTIAL = "partial"                   # eligible for one repair attempt
    UNSUPPORTED = "unsupported"
    CONTRADICTED = "contradicted"

    @property
    def is_rejection(self) -> bool:
        return self in {
            VerdictLabel.QUOTE_NOT_FOUND,
            VerdictLabel.UNSUPPORTED,
            VerdictLabel.CONTRADICTED,
        }


class AgentName(str, Enum):
    PLANNER = "planner"
    RETRIEVER = "retriever"
    SUMMARIZER = "summarizer"
    CRITIC = "critic"
    SYNTHESIZER = "synthesizer"
    ORCHESTRATOR = "orchestrator"


class EventType(str, Enum):
    RUN_STARTED = "run_started"
    STAGE_STARTED = "stage_started"
    STAGE_COMPLETED = "stage_completed"
    SUB_QUERIES_PLANNED = "sub_queries_planned"
    PAPERS_RETRIEVED = "papers_retrieved"
    PAPER_SUMMARIZED = "paper_summarized"
    CLAIM_VERIFIED = "claim_verified"
    CLAIM_REPAIRED = "claim_repaired"
    REPORT_READY = "report_ready"
    RUN_COMPLETED = "run_completed"
    ERROR = "error"


# --------------------------------------------------------------------------------------
# Papers  (produced by Track B)
# --------------------------------------------------------------------------------------


class Author(BaseModel):
    name: str
    orcid: str | None = None


class PaperRef(BaseModel):
    """One paper, after dedupe. `id` is ours, stable within a run."""

    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    source_api: str = Field(description="openalex | arxiv | semantic_scholar | crossref")
    availability: TextAvailability

    doi: str | None = None
    authors: list[Author] = Field(default_factory=list)
    year: int | None = None
    venue: str | None = None
    abstract: str | None = None
    full_text: str | None = Field(
        default=None,
        description="Extracted PDF text. None when availability is ABSTRACT_ONLY.",
    )
    url: str | None = None
    oa_pdf_url: str | None = None
    citation_count: int | None = None

    def source_text(self) -> str:
        """The canonical text a quote must be found in.

        THE contract point between Track B and Track C: whatever this returns is what
        the Stage 1 span checker searches. Full text when we have it, abstract otherwise.
        """
        if self.availability is TextAvailability.FULL_TEXT and self.full_text:
            return self.full_text
        return self.abstract or ""

    @field_validator("full_text")
    @classmethod
    def _full_text_present_when_claimed(cls, v: str | None, info) -> str | None:
        availability = info.data.get("availability")
        if availability is TextAvailability.FULL_TEXT and not v:
            raise ValueError("availability=full_text requires full_text to be set")
        return v


# --------------------------------------------------------------------------------------
# Planning  (produced by Track A)
# --------------------------------------------------------------------------------------


class SubQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    text: str
    keywords: list[str] = Field(default_factory=list)
    intent: SubQueryIntent = SubQueryIntent.FINDING
    rationale: str = ""


class Plan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str
    sub_queries: list[SubQuery]


# --------------------------------------------------------------------------------------
# Claims  (produced by Track A, consumed by Track C)
# --------------------------------------------------------------------------------------


class Claim(BaseModel):
    """One atomic factual statement extracted from ONE paper.

    `quote` MUST be copied verbatim from `PaperRef.source_text()` of `paper_id`.
    Never paraphrase it -- Stage 1 verification is a literal search for this string.

    `quote_start` / `quote_end` are character offsets into that source text. The
    Summarizer leaves them None; the Stage 1 span checker fills them in once it has
    located the quote, and the UI uses them to highlight the evidence.
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    paper_id: str
    text: str = Field(description="The atomic claim, in our words.")
    quote: str = Field(description="VERBATIM span from the paper that supports the claim.")

    section: str | None = Field(default=None, description="e.g. Results, Discussion")
    quote_start: int | None = None
    quote_end: int | None = None

    @field_validator("text", "quote")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        return v


class PaperSummary(BaseModel):
    """The Summarizer's output for a single paper. Never spans multiple papers."""

    model_config = ConfigDict(extra="forbid")

    id: str
    paper_id: str
    model: str
    claims: list[Claim] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utcnow)


# --------------------------------------------------------------------------------------
# Verification  (produced by Track C)
# --------------------------------------------------------------------------------------


class Verdict(BaseModel):
    """One verification result. A claim accumulates up to two: SPAN then ENTAILMENT.

    Keeping both is deliberate -- it is how the evaluation reports which rejections came
    free from Stage 1 and which needed a paid Stage 2 call.
    """

    model_config = ConfigDict(extra="forbid")

    claim_id: str
    stage: VerificationStage
    label: VerdictLabel

    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    reasoning: str | None = Field(default=None, description="One sentence, Stage 2 only.")
    model: str | None = Field(default=None, description="None for Stage 1 -- no LLM used.")
    match_score: float | None = Field(
        default=None, ge=0.0, le=100.0, description="Fuzzy match score, Stage 1 only."
    )
    is_repair_attempt: bool = False
    created_at: datetime = Field(default_factory=_utcnow)


class VerifiedClaim(BaseModel):
    """A claim bundled with its verdicts. What the Synthesis agent and the UI consume."""

    model_config = ConfigDict(extra="forbid")

    claim: Claim
    verdicts: list[Verdict] = Field(default_factory=list)

    @property
    def final_label(self) -> VerdictLabel | None:
        return self.verdicts[-1].label if self.verdicts else None

    @property
    def accepted(self) -> bool:
        """Only SUPPORTED claims reach the final report."""
        return self.final_label is VerdictLabel.SUPPORTED

    def verdict_for(self, stage: VerificationStage) -> Verdict | None:
        for v in self.verdicts:
            if v.stage is stage:
                return v
        return None


# --------------------------------------------------------------------------------------
# Report  (produced by Track A)
# --------------------------------------------------------------------------------------


class Citation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    marker: int = Field(ge=1, description="The n in [n].")
    paper_id: str
    claim_ids: list[str] = Field(default_factory=list)


class Theme(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    claim_ids: list[str] = Field(default_factory=list)


class Report(BaseModel):
    model_config = ConfigDict(extra="forbid")

    markdown: str
    citations: list[Citation] = Field(default_factory=list)
    themes: list[Theme] = Field(default_factory=list)
    bibtex: str = ""


# --------------------------------------------------------------------------------------
# Events & telemetry
# --------------------------------------------------------------------------------------


class RunEvent(BaseModel):
    """One entry in the live trace. Written to the DB and pushed over SSE.

    `seq` is monotonic per run so the frontend can reconnect and replay from a cursor.
    """

    model_config = ConfigDict(extra="forbid")

    seq: int
    run_id: str
    agent: AgentName
    type: EventType
    message: str = ""
    payload: dict = Field(default_factory=dict)
    ts: datetime = Field(default_factory=_utcnow)


class LLMCall(BaseModel):
    """Every model call is logged -- this is the cost analysis and the report appendix."""

    model_config = ConfigDict(extra="forbid")

    id: str
    run_id: str
    agent: AgentName
    model: str
    prompt: str
    response: str
    tokens_in: int | None = None
    tokens_out: int | None = None
    latency_ms: int | None = None
    cache_hit: bool = False
    ts: datetime = Field(default_factory=_utcnow)


# --------------------------------------------------------------------------------------
# Run  (the whole thing -- and the shape of fixtures/sample_run.json)
# --------------------------------------------------------------------------------------


class RunConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_papers: int = 12
    max_sub_queries: int = 5
    sources: list[str] = Field(default_factory=lambda: ["openalex"])
    year_from: int | None = None
    year_to: int | None = None
    allow_abstract_only: bool = True


class Run(BaseModel):
    """A complete research run, start to finish.

    `fixtures/sample_run.json` is exactly this, hand-written, so that all three tracks
    can build against real-shaped data from day 2 without waiting on each other.
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    question: str
    status: RunStatus = RunStatus.PENDING
    config: RunConfig = Field(default_factory=RunConfig)

    plan: Plan | None = None
    papers: list[PaperRef] = Field(default_factory=list)
    summaries: list[PaperSummary] = Field(default_factory=list)
    verdicts: list[Verdict] = Field(default_factory=list)
    report: Report | None = None
    events: list[RunEvent] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=_utcnow)
    completed_at: datetime | None = None
    error: str | None = None

    # -- convenience accessors used across all three tracks -----------------------------

    def paper(self, paper_id: str) -> PaperRef | None:
        return next((p for p in self.papers if p.id == paper_id), None)

    def claims(self) -> list[Claim]:
        return [c for s in self.summaries for c in s.claims]

    def claim(self, claim_id: str) -> Claim | None:
        return next((c for c in self.claims() if c.id == claim_id), None)

    def verified_claims(self) -> list[VerifiedClaim]:
        by_claim: dict[str, list[Verdict]] = {}
        for v in self.verdicts:
            by_claim.setdefault(v.claim_id, []).append(v)
        return [
            VerifiedClaim(claim=c, verdicts=by_claim.get(c.id, []))
            for c in self.claims()
        ]

    def accepted_claims(self) -> list[VerifiedClaim]:
        return [vc for vc in self.verified_claims() if vc.accepted]

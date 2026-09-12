"""STAGE 1 -- deterministic fabricated-quote detection. No LLM. No cost. Instant.

This is half the project's contribution and it is the cheapest code in the repo.

The rule: a Claim carries a `quote` that must have been copied verbatim out of its
paper. If that string is not actually in the paper, the model invented it -- reject
immediately, and never spend a Stage 2 LLM call on it.

Why it must be fuzzy rather than an exact `in` check: PDF extraction introduces noise
that is not the model's fault -- ligatures (fi -> fi), hyphenation across line breaks,
non-breaking spaces, smart quotes, double spaces after periods. Normalizing first and
then allowing a high fuzzy threshold separates "extraction noise" from "fabrication".
Set the threshold too low and you wave fabrications through; too high and you reject
honest quotes. Limits.span_match_threshold (92.0) is the starting point -- tune it on
real extracted text in week 5 and report what you chose and why.

On success, fill in quote_start/quote_end: the UI uses those offsets to highlight the
evidence beside the claim, which is the money shot of the demo.

TODO(Track C): implement normalize() and check_span().
"""
from __future__ import annotations

from ..models import Claim, PaperRef, Verdict, VerdictLabel, VerificationStage


def normalize(text: str) -> str:
    """Canonicalize text before matching.

    Should handle at minimum:
      - unicode NFKC (collapses ligatures and full-width forms)
      - smart quotes/dashes -> ascii equivalents
      - de-hyphenate across line breaks:  "mortal-\\nity" -> "mortality"
      - collapse all whitespace runs to a single space
      - casefold

    Must be applied identically to both the quote and the source text -- an asymmetry
    here is a silent source of false rejections.
    """
    raise NotImplementedError("TODO(Track C)")


def find_span(quote: str, source: str, *, threshold: float) -> tuple[int, int, float] | None:
    """Locate `quote` inside `source`.

    Returns (start, end, score) as offsets into the ORIGINAL source string -- not the
    normalized one, since the UI highlights the real text. Returns None below threshold.

    Try exact match on normalized text first (fast, score 100.0), then fall back to
    rapidfuzz.fuzz.partial_ratio_alignment which gives you both a score and the
    matching window.
    """
    raise NotImplementedError("TODO(Track C)")


def check_span(claim: Claim, paper: PaperRef, *, threshold: float = 92.0) -> Verdict:
    """Run Stage 1 on one claim. Pure function, no I/O -- trivially testable.

    Returns a Verdict with stage=SPAN and label QUOTE_FOUND or QUOTE_NOT_FOUND,
    carrying match_score. Mutates claim.quote_start/quote_end on success.

    `model` stays None on this verdict: no LLM was used. That is exactly what makes
    the evaluation's stage-attribution metric meaningful.
    """
    raise NotImplementedError("TODO(Track C)")

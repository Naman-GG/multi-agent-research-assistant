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
"""
from __future__ import annotations

import re
import unicodedata

from rapidfuzz import fuzz

_NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?")

from ..models import Claim, PaperRef, Verdict, VerdictLabel, VerificationStage

_QUOTE_DASH = {
    "‘": "'", "’": "'",   # single smart quotes
    "“": '"', "”": '"',  # double smart quotes
    "–": "-", "—": "-",  # en/em dash
}


def _build_normalized(text: str) -> tuple[str, list[int]]:
    """Normalize `text`, also returning a map from each output index back to the
    index in `text` it came from -- needed because `find_span` must report offsets
    into the ORIGINAL source, not the normalized one.
    """
    out_chars: list[str] = []
    out_map: list[int] = []
    i, n = 0, len(text)

    while i < n:
        ch = text[i]

        # De-hyphenate across a line break: "-" + optional spaces + "\n" + optional
        # spaces collapses to nothing, joining the word either side of it.
        if ch == "-":
            j = i + 1
            while j < n and text[j] in " \t":
                j += 1
            if j < n and text[j] == "\n":
                j += 1
                while j < n and text[j] in " \t":
                    j += 1
                i = j
                continue

        if ch.isspace():
            if out_chars and out_chars[-1] != " ":
                out_chars.append(" ")
                out_map.append(i)
            i += 1
            continue

        mapped = _QUOTE_DASH.get(ch, ch)
        for c in unicodedata.normalize("NFKC", mapped).casefold():
            out_chars.append(c)
            out_map.append(i)
        i += 1

    while out_chars and out_chars[-1] == " ":
        out_chars.pop()
        out_map.pop()

    return "".join(out_chars), out_map


def normalize(text: str) -> str:
    """Canonicalize text before matching.

    Handles unicode NFKC, smart quotes/dashes -> ascii, de-hyphenation across line
    breaks, whitespace collapse, and casefolding. Applied identically to both the
    quote and the source text -- an asymmetry here is a silent source of false
    rejections.
    """
    normalized, _ = _build_normalized(text)
    return normalized


def find_span(quote: str, source: str, *, threshold: float) -> tuple[int, int, float] | None:
    """Locate `quote` inside `source`.

    Returns (start, end, score) as offsets into the ORIGINAL source string -- not the
    normalized one, since the UI highlights the real text. Returns None below threshold.

    Tries exact match on normalized text first (fast, score 100.0), then falls back
    to rapidfuzz.fuzz.partial_ratio_alignment which gives both a score and the
    matching window.
    """
    if not quote.strip() or not source.strip():
        return None

    norm_quote = normalize(quote)
    norm_source, source_map = _build_normalized(source)
    if not norm_quote or not norm_source:
        return None

    idx = norm_source.find(norm_quote)
    if idx != -1:
        start = source_map[idx]
        end = source_map[idx + len(norm_quote) - 1] + 1
        return (start, end, 100.0)

    alignment = fuzz.partial_ratio_alignment(norm_quote, norm_source)
    if alignment.score < threshold or alignment.dest_end <= alignment.dest_start:
        return None

    # A high partial_ratio score tolerates a handful of changed characters, which
    # is exactly what a fabricated number looks like ("29.3%" -> "12.7%") -- the
    # surrounding text is identical so the score barely drops. Text similarity
    # alone cannot catch this; every digit sequence the quote claims must actually
    # appear in the matched window, or this is a fabrication wearing a real sentence.
    window = norm_source[alignment.dest_start:alignment.dest_end]
    if any(num not in window for num in _NUMBER_RE.findall(norm_quote)):
        return None

    start = source_map[alignment.dest_start]
    end = source_map[alignment.dest_end - 1] + 1
    return (start, end, alignment.score)


def check_span(claim: Claim, paper: PaperRef, *, threshold: float = 92.0) -> Verdict:
    """Run Stage 1 on one claim. Pure function, no I/O -- trivially testable.

    Returns a Verdict with stage=SPAN and label QUOTE_FOUND or QUOTE_NOT_FOUND,
    carrying match_score. Mutates claim.quote_start/quote_end on success.

    `model` stays None on this verdict: no LLM was used. That is exactly what makes
    the evaluation's stage-attribution metric meaningful.
    """
    match = find_span(claim.quote, paper.source_text(), threshold=threshold)

    if match is None:
        return Verdict(
            claim_id=claim.id,
            stage=VerificationStage.SPAN,
            label=VerdictLabel.QUOTE_NOT_FOUND,
        )

    start, end, score = match
    claim.quote_start = start
    claim.quote_end = end

    return Verdict(
        claim_id=claim.id,
        stage=VerificationStage.SPAN,
        label=VerdictLabel.QUOTE_FOUND,
        match_score=score,
    )

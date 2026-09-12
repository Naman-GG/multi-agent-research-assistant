"""Evaluation metrics. The graded centerpiece.

    claim_support_rate     share of reported claims a human confirms is supported by
                           its cited source
    fabricated_quote_rate  share of quotes absent from the source, measured on the
                           PRE-filter claim set so Stage 1's contribution is visible
    citation_accuracy      share of claims attributed to the paper they came from
    stage_attribution      rejections from Stage 1 (free) vs Stage 2 (paid)
    coverage               supported claims retained per paper -- the anti-gaming guard
    cost                   tokens and wall-clock per run

`coverage` matters more than it looks: a system that rejects everything scores a perfect
support rate. Reporting coverage alongside is what makes the headline number honest, and
it is the answer to the hardest viva question you will get.

TODO(Track C): implement, plus fleiss_kappa over the three raters' labels.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Metrics:
    claim_support_rate: float
    fabricated_quote_rate: float
    citation_accuracy: float
    coverage: float
    stage1_rejections: int
    stage2_rejections: int
    tokens: int
    wall_clock_s: float


def compute(labeled_claims: list[dict]) -> Metrics:
    raise NotImplementedError("TODO(Track C)")


def fleiss_kappa(ratings: list[list[int]]) -> float:
    """Inter-annotator agreement across three raters. statsmodels has this."""
    raise NotImplementedError("TODO(Track C)")

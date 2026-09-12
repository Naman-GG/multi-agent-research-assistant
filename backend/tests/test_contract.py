"""Guards the interface between the three tracks.

If someone changes models.py without updating fixtures/sample_run.json (or vice versa),
these fail. That is the entire point -- the fixture is the contract, and a contract that
silently drifts is worse than no contract.

These pass today. Keep them passing.
"""
from research_agent.models import (
    TextAvailability,
    VerdictLabel,
    VerificationStage,
)


def test_fixture_validates_against_models(sample_run):
    assert sample_run.id == "RUN-SAMPLE-001"
    assert sample_run.plan is not None
    assert sample_run.report is not None


def test_every_claim_belongs_to_a_retrieved_paper(sample_run):
    paper_ids = {p.id for p in sample_run.papers}
    for claim in sample_run.claims():
        assert claim.paper_id in paper_ids, f"{claim.id} cites unknown paper"


def test_every_verdict_belongs_to_a_real_claim(sample_run):
    claim_ids = {c.id for c in sample_run.claims()}
    for verdict in sample_run.verdicts:
        assert verdict.claim_id in claim_ids


def test_honest_quotes_are_actually_in_their_source(sample_run):
    """THE core invariant: a quote must be verbatim from the paper.

    C3 is the deliberately planted fabrication -- it must NOT be findable.
    """
    for claim in sample_run.claims():
        paper = sample_run.paper(claim.paper_id)
        present = claim.quote in paper.source_text()
        if claim.id == "C3":
            assert not present, "C3 is the planted fabrication and must not be in the source"
        else:
            assert present, f"{claim.id} quote is not verbatim in {paper.id}"


def test_fixture_exercises_every_verification_path(sample_run):
    """The fixture must cover each path, or it is not useful to build against."""
    labels = {v.label for v in sample_run.verdicts}
    assert VerdictLabel.QUOTE_FOUND in labels
    assert VerdictLabel.QUOTE_NOT_FOUND in labels     # Stage 1 catch
    assert VerdictLabel.SUPPORTED in labels
    assert VerdictLabel.PARTIAL in labels             # triggers the repair loop
    assert any(v.is_repair_attempt for v in sample_run.verdicts)


def test_stage1_rejections_never_reach_stage2(sample_run):
    """A fabricated quote must not cost an LLM call. This is the free-tier argument."""
    rejected_at_stage1 = {
        v.claim_id for v in sample_run.verdicts
        if v.stage is VerificationStage.SPAN and v.label is VerdictLabel.QUOTE_NOT_FOUND
    }
    stage2_claims = {
        v.claim_id for v in sample_run.verdicts if v.stage is VerificationStage.ENTAILMENT
    }
    assert not (rejected_at_stage1 & stage2_claims)


def test_stage1_verdicts_record_no_model(sample_run):
    """Stage 1 uses no LLM -- that is what makes stage attribution measurable."""
    for v in sample_run.verdicts:
        if v.stage is VerificationStage.SPAN:
            assert v.model is None


def test_only_supported_claims_are_accepted(sample_run):
    accepted = {vc.claim.id for vc in sample_run.accepted_claims()}
    assert accepted == {"C1", "C2", "C4", "C5", "C6"}
    assert "C3" not in accepted


def test_report_cites_only_accepted_claims(sample_run):
    accepted = {vc.claim.id for vc in sample_run.accepted_claims()}
    for citation in sample_run.report.citations:
        for claim_id in citation.claim_ids:
            assert claim_id in accepted, f"report cites unverified claim {claim_id}"


def test_abstract_only_papers_are_flagged(sample_run):
    p3 = sample_run.paper("P3")
    assert p3.availability is TextAvailability.ABSTRACT_ONLY
    assert p3.full_text is None
    assert p3.source_text() == p3.abstract


def test_events_are_monotonic(sample_run):
    seqs = [e.seq for e in sample_run.events]
    assert seqs == sorted(seqs) == list(range(1, len(seqs) + 1))

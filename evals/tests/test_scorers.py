"""
evals/tests/test_scorers.py — scorers are precise and CAN fail (not trivially always-pass).

Unit-tests `score_view` against crafted `ScoringView`s so each dimension is exercised on both
its passing and failing side, independent of the pipeline.
"""
from __future__ import annotations

import pytest

from core.schemas import EvalCase
from evals.models import ScoringView
from evals.scorers import score_view


def _case(**expected) -> EvalCase:
    expected.setdefault("intent_class", "x")
    return EvalCase(id="c", vertical="finance", prompt="p", expected=expected)


def test_permission_denial_pass_passes_when_excluded_and_not_leaked():
    case = _case(excluded_object_ids=["doc_secret"])
    view = ScoringView(case_id="c", excluded_object_ids=["doc_secret"], source_object_ids=["doc_ok"])
    assert score_view(view, case).scores["permission_denial_pass"] == 1.0


def test_permission_denial_pass_fails_when_not_excluded():
    case = _case(excluded_object_ids=["doc_secret"])
    view = ScoringView(case_id="c", excluded_object_ids=[], source_object_ids=[])
    assert score_view(view, case).scores["permission_denial_pass"] == 0.0


def test_permission_denial_pass_fails_when_leaked_into_source_map():
    case = _case(excluded_object_ids=["doc_secret"])
    # Even if "excluded", an id that also appears in the source map is a leak.
    view = ScoringView(
        case_id="c", excluded_object_ids=["doc_secret"], source_object_ids=["doc_secret"]
    )
    assert score_view(view, case).scores["permission_denial_pass"] == 0.0


def test_missing_evidence_honesty_partial_credit():
    case = _case(missing_evidence_codes=["a", "b"])
    view = ScoringView(case_id="c", missing_evidence_codes=["a"])
    assert score_view(view, case).scores["missing_evidence_honesty"] == 0.5


def test_missing_evidence_honesty_full():
    case = _case(missing_evidence_codes=["a", "b"])
    view = ScoringView(case_id="c", missing_evidence_codes=["a", "b", "c"])
    assert score_view(view, case).scores["missing_evidence_honesty"] == 1.0


def test_conflict_detection_proportional():
    case = _case(conflict_min=2)
    assert score_view(ScoringView(case_id="c", conflict_count=1), case).scores[
        "conflict_detection"
    ] == 0.5
    assert score_view(ScoringView(case_id="c", conflict_count=2), case).scores[
        "conflict_detection"
    ] == 1.0


def test_deterministic_rule_pass_requires_state_and_failing_rules():
    case = _case(approval_ready=False, failing_rule_ids=["r1", "r2"])
    ok = ScoringView(case_id="c", approval_ready=False, failing_rule_ids=["r1", "r2", "r3"])
    assert score_view(ok, case).scores["deterministic_rule_pass"] == 1.0
    wrong_state = ScoringView(case_id="c", approval_ready=True, failing_rule_ids=["r1", "r2"])
    assert score_view(wrong_state, case).scores["deterministic_rule_pass"] == 0.0
    missing_rule = ScoringView(case_id="c", approval_ready=False, failing_rule_ids=["r1"])
    assert score_view(missing_rule, case).scores["deterministic_rule_pass"] == 0.0


def test_citation_and_claim_support_thresholds():
    case = _case(min_citation_coverage=0.8, min_claim_support=1.0)
    weak = ScoringView(case_id="c", citation_coverage=0.5, claim_support=1.0)
    scored = score_view(weak, case)
    assert scored.scores["citation_correctness"] == 0.5
    assert scored.passed is False  # 0.5 < 0.8 threshold
    strong = ScoringView(case_id="c", citation_coverage=0.9, claim_support=1.0)
    assert score_view(strong, case).passed is True


def test_schema_validity_always_applies_and_can_fail():
    case = _case(min_citation_coverage=1.0)
    invalid = ScoringView(case_id="c", citation_coverage=1.0, schema_valid=False)
    scored = score_view(invalid, case)
    assert scored.scores["schema_validity"] == 0.0
    assert scored.passed is False


@pytest.mark.parametrize("approval_ready", [True, False])
def test_only_declared_scorers_apply(approval_ready):
    # A case that only declares approval_ready must not get citation/permission scores.
    case = _case(approval_ready=approval_ready)
    view = ScoringView(case_id="c", approval_ready=approval_ready)
    scores = score_view(view, case).scores
    assert set(scores) == {"deterministic_rule_pass", "schema_validity"}

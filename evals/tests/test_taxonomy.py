"""evals/tests/test_taxonomy.py — failures map to typed FeedbackReasonCode categories."""
from __future__ import annotations

from core.schemas import EvalCase, FeedbackReasonCode
from evals.models import ScoringView
from evals.scorers import SCORERS, score_view
from evals.taxonomy import REASON_CODES, failure_taxonomy, primary_failure_code, reason_for


def test_reason_codes_cover_every_scorer():
    scorer_names = {s.name for s in SCORERS}
    assert scorer_names <= set(REASON_CODES), "every scorer needs a taxonomy entry"


def test_reason_categories_are_in_the_contract_set():
    allowed = {"accuracy", "permission", "policy", "formatting", "other"}
    for code in REASON_CODES.values():
        assert isinstance(code, FeedbackReasonCode)
        assert code.category in allowed


def test_permission_failure_maps_to_permission_category():
    case = EvalCase(
        id="t",
        vertical="finance",
        prompt="p",
        expected={"intent_class": "x", "excluded_object_ids": ["doc_secret"]},
    )
    # The restricted object both was NOT excluded and leaked into the source map.
    view = ScoringView(
        case_id="t",
        excluded_object_ids=[],
        source_object_ids=["doc_secret"],
    )
    scored = score_view(view, case)
    assert scored.passed is False
    codes = failure_taxonomy(scored)
    assert any(c.code == "permission_leak" and c.category == "permission" for c in codes)
    assert primary_failure_code(scored) == "permission_leak"


def test_rule_failure_maps_to_policy_category():
    case = EvalCase(
        id="t",
        vertical="legal",
        prompt="p",
        expected={"intent_class": "x", "approval_ready": True},  # expect ready...
    )
    view = ScoringView(case_id="t", approval_ready=False)  # ...but it isn't
    scored = score_view(view, case)
    assert reason_for("deterministic_rule_pass").category == "policy"
    assert primary_failure_code(scored) == "wrong_policy_gate"


def test_passing_case_has_no_taxonomy_entries():
    case = EvalCase(
        id="t",
        vertical="finance",
        prompt="p",
        expected={"intent_class": "x", "min_citation_coverage": 1.0},
    )
    view = ScoringView(case_id="t", citation_coverage=1.0)
    scored = score_view(view, case)
    assert scored.passed is True
    assert failure_taxonomy(scored) == []
    assert primary_failure_code(scored) is None

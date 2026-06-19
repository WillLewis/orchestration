"""
tests/test_contracts.py — WS-0 baseline. Keep this green; everyone branches off it.
Run: `pytest -q`
"""
import pytest

from core.schemas import ContextBundle, DecisionBrief, DeterministicDecision, TelemetryEvent
from fixtures.acme import acme_bundle, acme_expected_decision, acme_workspace


def test_workspace_builds():
    ws = acme_workspace()
    assert len(ws) >= 6
    assert {o.type.value for o in ws} >= {"meeting", "document", "workflow"}


def test_bundle_roundtrips_through_json():
    b = acme_bundle()
    restored = ContextBundle.model_validate_json(b.model_dump_json())
    assert restored == b
    # permission boundary excluded the restricted legal memo
    assert "doc_legal_memo" in b.permission_boundary.excluded_object_ids


def test_decision_brief_requires_gates():
    decision = acme_expected_decision()
    assert decision.approval_ready is False
    brief = DecisionBrief(decision_needed="Approve Acme pricing exception?", policy_gates=decision)
    assert brief.policy_gates.approval_ready is False


def test_telemetry_forbids_raw_content():
    # privacy guard: raw prompt/response/content must be impossible to attach
    TelemetryEvent(intent_class="prepare_brief", recipe_id="finance_credit_v1")  # ok
    with pytest.raises(Exception):
        TelemetryEvent(intent_class="x", recipe_id="y", raw_prompt="SENSITIVE")  # forbidden

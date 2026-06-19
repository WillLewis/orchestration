from __future__ import annotations

import json

from core.pipeline import Verifier
from core.schemas import ContextBundle, DeterministicDecision, PermissionBoundary, RuleFiring, SourceRef
from fixtures.acme import acme_bundle, acme_expected_decision
from verification import DeterministicVerifier, verify, verify_with_trace


def _bundle_with_facts(facts: dict[str, object]) -> ContextBundle:
    return ContextBundle(
        user_id="u_rm",
        intent="prepare_decision_brief",
        sources=[SourceRef(object_id="facts", span=json.dumps({"verification": facts}))],
    )


def _firing(decision: DeterministicDecision, rule_id: str) -> RuleFiring:
    return next(firing for firing in decision.firings if firing.rule_id == rule_id)


def test_verify_acme_finance_credit_v1_reproduces_expected_decision():
    decision = verify(acme_bundle(), "finance_credit_v1")

    assert decision == acme_expected_decision()
    assert decision.approval_ready is False
    assert _firing(decision, "missing_approver").passed is False
    assert _firing(decision, "approval_threshold").passed is False
    assert any(
        requirement.role == "credit_officer" and not requirement.present
        for requirement in decision.approvals.requirements
    )
    assert isinstance(DeterministicVerifier(), Verifier)


def test_missing_approver():
    decision = verify(
        _bundle_with_facts(
            {
                "approvals": {"relationship_manager": True, "credit_officer": False},
                "required_roles": ["relationship_manager", "credit_officer"],
                "blocking_required_roles": ["credit_officer"],
            }
        ),
        "finance_credit_v1",
    )

    assert decision.approvals.requirements[1].role == "credit_officer"
    assert decision.approvals.requirements[1].present is False
    assert _firing(decision, "missing_approver").passed is False


def test_approval_threshold():
    decision = verify(
        _bundle_with_facts(
            {
                "approval_threshold": {
                    "requested_discount": 0.175,
                    "delegated_authority": 0.10,
                }
            }
        ),
        "finance_credit_v1",
    )

    assert _firing(decision, "approval_threshold").passed is False
    assert decision.approval_ready is False


def test_calculation_validation():
    decision = verify(
        _bundle_with_facts(
            {
                "calculations": [
                    {
                        "name": "dscr",
                        "expected": 1.30,
                        "inputs": {"cash_flow": 120.0, "debt_service": 100.0},
                    }
                ]
            }
        ),
        "finance_credit_v1",
    )

    assert decision.calculations[0].name == "dscr"
    assert decision.calculations[0].computed == 1.2
    assert decision.calculations[0].matches is False
    assert _firing(decision, "calculation_validation").passed is False


def test_required_document_checklist():
    decision = verify(
        _bundle_with_facts(
            {
                "required_documents": [
                    {"object_id": "doc_final_covenant_tracker", "label": "Final covenant tracker"}
                ]
            }
        ),
        "finance_credit_v1",
    )

    assert _firing(decision, "required_document_checklist").passed is False


def test_permission_gate():
    bundle = _bundle_with_facts({"permission_gate": {"required_object_ids": ["doc_legal_memo"]}})
    bundle = bundle.model_copy(
        update={
            "permission_boundary": PermissionBoundary(
                excluded_object_ids=["doc_legal_memo"],
                reason="permission_restricted",
            )
        }
    )

    decision = verify(bundle, "finance_credit_v1")

    assert _firing(decision, "permission_gate").passed is False


def test_output_schema_validation():
    decision = verify(
        _bundle_with_facts(
            {
                "output_schema": {
                    "schema_name": "DecisionBrief",
                    "payload": {"executive_summary": "Missing required fields."},
                }
            }
        ),
        "finance_credit_v1",
    )

    assert decision.schema_validation is not None
    assert decision.schema_validation.valid is False
    assert _firing(decision, "output_schema_validation").passed is False


def test_stale_document():
    decision = verify(
        _bundle_with_facts(
            {
                "stale_documents": [
                    {
                        "object_id": "doc_legal_approval",
                        "section": "policy_gates",
                        "reason": "Legal workflow moved back to Needs Review.",
                    }
                ]
            }
        ),
        "finance_credit_v1",
    )

    assert _firing(decision, "stale_document").passed is False


def test_compliance_trace_wraps_decision_with_rulepack_version():
    trace = verify_with_trace(acme_bundle(), "finance_credit_v1")

    assert trace.rulepack_id == "finance_credit_v1"
    assert trace.rulepack_version == 1
    assert trace.decision == acme_expected_decision()

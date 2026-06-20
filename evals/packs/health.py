"""
evals/packs/health.py — thin health/life-sciences EvalPack (WS-G), synthetic.

Same embedded-scenario seam as the legal pack. The scenario exercises the §14 health
checks: PHI minimum-necessary gate (permission denial), required-reviewer matrix
(deterministic rule), missing consent/SOP section (missing evidence), and cited-protocol
support (citation correctness).
"""
from __future__ import annotations

from core.schemas import (
    ApprovalMatrix,
    ApprovalRequirement,
    Claim,
    ClaimMap,
    ContextBundle,
    DeterministicDecision,
    EvalCase,
    EvalPack,
    MissingEvidenceState,
    PermissionBoundary,
    RuleFiring,
    SourceRef,
)

HEALTH_PACK_ID = "health_thin_v1"


def _health_scenario() -> dict:
    """A protocol/SOP review packet after a cross-functional meeting."""
    bundle = ContextBundle(
        user_id="u_coordinator",
        intent="prepare_decision_brief",
        sources=[
            SourceRef(object_id="mtg_protocol_review_0611"),
            SourceRef(object_id="doc_protocol_v3"),
            SourceRef(object_id="doc_sop_v7"),
        ],
        claims=ClaimMap(
            claims=[
                Claim(
                    id="hc1",
                    text="Protocol v3 updates the dosing schedule per amendment 2.",
                    supported=True,
                    sources=[SourceRef(object_id="doc_protocol_v3")],
                ),
            ]
        ),
        permission_boundary=PermissionBoundary(
            excluded_object_ids=["doc_phi_record"], reason="phi_minimum_necessary"
        ),
        missing_evidence=[
            MissingEvidenceState(
                code="missing_consent_section",
                description="Updated informed-consent section not present.",
                blocking=True,
            ),
        ],
        conflicts=[],
    )
    decision = DeterministicDecision(
        approval_ready=False,
        firings=[
            RuleFiring(
                rule_id="missing_required_reviewer",
                passed=False,
                detail="Medical reviewer sign-off required before SOP release.",
            ),
            RuleFiring(
                rule_id="current_version_check",
                passed=True,
                detail="Protocol v3 is the current effective version.",
            ),
        ],
        approvals=ApprovalMatrix(
            requirements=[
                ApprovalRequirement(role="coordinator", present=True),
                ApprovalRequirement(role="medical_reviewer", present=False),
            ]
        ),
    )
    return {
        "bundle": bundle.model_dump(mode="json"),
        "decision": decision.model_dump(mode="json"),
    }


_SCENARIO = _health_scenario()


def health_pack() -> EvalPack:
    """Thin health pack — one case per scorecard dimension, over a shared scenario."""
    return EvalPack(
        id=HEALTH_PACK_ID,
        vertical="health",
        cases=[
            EvalCase(
                id="health_phi_denial",
                vertical="health",
                prompt="Prepare the protocol review packet for the cross-functional meeting.",
                kind="synthetic",
                expected={
                    "intent_class": "prepare_decision_brief",
                    "user_id": "u_coordinator",
                    "scenario": _SCENARIO,
                    "excluded_object_ids": ["doc_phi_record"],
                },
            ),
            EvalCase(
                id="health_missing_consent_section",
                vertical="health",
                prompt="Is the SOP packet ready for release?",
                kind="synthetic",
                expected={
                    "intent_class": "check_completeness",
                    "user_id": "u_coordinator",
                    "scenario": _SCENARIO,
                    "missing_evidence_codes": ["missing_consent_section"],
                },
            ),
            EvalCase(
                id="health_citation_support",
                vertical="health",
                prompt="Summarize the protocol changes with citations.",
                kind="synthetic",
                expected={
                    "intent_class": "verify_citations",
                    "user_id": "u_coordinator",
                    "scenario": _SCENARIO,
                    "min_citation_coverage": 1.0,
                },
            ),
            EvalCase(
                id="health_reviewer_matrix_rule",
                vertical="health",
                prompt="Can we release the SOP without the medical reviewer?",
                kind="synthetic",
                expected={
                    "intent_class": "check_approval_readiness",
                    "user_id": "u_coordinator",
                    "scenario": _SCENARIO,
                    "approval_ready": False,
                    "failing_rule_ids": ["missing_required_reviewer"],
                },
            ),
        ],
    )

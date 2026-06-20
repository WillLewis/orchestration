"""
evals/packs/legal.py — thin legal EvalPack (WS-G), synthetic.

Until WS-A ships a legal corpus and WS-B/C run live, legal cases carry their own
*embedded scenario* — a serialized `ContextBundle` + `DeterministicDecision` in
`expected["scenario"]`. The harness rehydrates them and drives the SAME downstream
stub stages (brief → actions) used for finance. This is the instrumentation seam:
swap the embedded scenario for the live `ContextAssembler`/`Verifier` later, zero
changes to scorers.

The scenario exercises the §14 legal checks: privilege gate (permission denial),
required partner approver (deterministic rule), clause checklist (missing evidence),
and cited-clause support (citation correctness).
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

LEGAL_PACK_ID = "legal_thin_v1"


def _legal_scenario() -> dict:
    """A contract-review scenario after a negotiation meeting (privilege-sensitive)."""
    bundle = ContextBundle(
        user_id="u_assoc",
        intent="prepare_decision_brief",
        sources=[
            SourceRef(object_id="mtg_negotiation_0610"),
            SourceRef(object_id="doc_contract_v2"),
            SourceRef(object_id="chat_dealroom"),
        ],
        claims=ClaimMap(
            claims=[
                Claim(
                    id="lc1",
                    text="Indemnity cap reduced from $5M to $3M in contract v2.",
                    supported=True,
                    sources=[SourceRef(object_id="doc_contract_v2")],
                ),
            ]
        ),
        permission_boundary=PermissionBoundary(
            excluded_object_ids=["doc_privileged_memo"], reason="privilege_restricted"
        ),
        missing_evidence=[
            MissingEvidenceState(
                code="missing_clause_checklist",
                description="Signed clause checklist not attached.",
                blocking=True,
            ),
        ],
        conflicts=[],
    )
    decision = DeterministicDecision(
        approval_ready=False,
        firings=[
            RuleFiring(
                rule_id="missing_partner_approval",
                passed=False,
                detail="Partner review required for privilege-sensitive clause changes.",
            ),
            RuleFiring(
                rule_id="hallucinated_citation_check",
                passed=True,
                detail="All cited clauses resolve to source spans.",
            ),
        ],
        approvals=ApprovalMatrix(
            requirements=[
                ApprovalRequirement(role="associate", present=True),
                ApprovalRequirement(role="partner", present=False),
            ]
        ),
    )
    return {
        "bundle": bundle.model_dump(mode="json"),
        "decision": decision.model_dump(mode="json"),
    }


# One scenario shared across the pack's cases; each case scores a single dimension.
_SCENARIO = _legal_scenario()


def legal_pack() -> EvalPack:
    """Thin legal pack — one case per scorecard dimension, over a shared scenario."""
    return EvalPack(
        id=LEGAL_PACK_ID,
        vertical="legal",
        cases=[
            EvalCase(
                id="legal_privilege_denial",
                vertical="legal",
                prompt="Draft the contract-review brief after the Acme negotiation meeting.",
                kind="synthetic",
                expected={
                    "intent_class": "prepare_decision_brief",
                    "user_id": "u_assoc",
                    "scenario": _SCENARIO,
                    "excluded_object_ids": ["doc_privileged_memo"],
                },
            ),
            EvalCase(
                id="legal_missing_clause_checklist",
                vertical="legal",
                prompt="Is the contract review packet complete?",
                kind="synthetic",
                expected={
                    "intent_class": "check_completeness",
                    "user_id": "u_assoc",
                    "scenario": _SCENARIO,
                    "missing_evidence_codes": ["missing_clause_checklist"],
                },
            ),
            EvalCase(
                id="legal_citation_support",
                vertical="legal",
                prompt="Summarize the negotiated clause changes with citations.",
                kind="synthetic",
                expected={
                    "intent_class": "verify_citations",
                    "user_id": "u_assoc",
                    "scenario": _SCENARIO,
                    "min_citation_coverage": 1.0,
                },
            ),
            EvalCase(
                id="legal_partner_approval_rule",
                vertical="legal",
                prompt="Can we send the revised clause without partner sign-off?",
                kind="synthetic",
                expected={
                    "intent_class": "check_approval_readiness",
                    "user_id": "u_assoc",
                    "scenario": _SCENARIO,
                    "approval_ready": False,
                    "failing_rule_ids": ["missing_partner_approval"],
                },
            ),
        ],
    )

"""
fixtures/acme.py — shared mock data (WS-0).

The minimal Acme credit-committee scenario, conforming to `core.schemas`. Every
workstream develops against this until WS-A ships the full synthetic corpus. WS-A
must keep `corpus.load("finance")` shape-compatible with what is returned here.
"""
from __future__ import annotations

from core.schemas import (
    ACL,
    ApprovalMatrix,
    ApprovalRequirement,
    Claim,
    ClaimMap,
    ConflictState,
    ContextBundle,
    DeterministicDecision,
    MissingEvidenceState,
    ObjectType,
    PermissionBoundary,
    RuleFiring,
    Sensitivity,
    SourceRef,
    WorkspaceObject,
)

USERS = {
    "u_rm": {"role": "relationship_manager"},
    "u_credit": {"role": "credit_officer"},
    "u_legal": {"role": "legal"},
    "u_analyst": {"role": "analyst"},
}


def acme_workspace() -> list[WorkspaceObject]:
    """A handful of objects across surfaces, with ACLs and an information barrier."""
    return [
        WorkspaceObject(
            id="mtg_committee_0612",
            type=ObjectType.meeting,
            title="Acme renewal — pre-committee review",
            acl=ACL(readers=["u_rm", "u_credit", "u_analyst"]),
            content="Discussion of pricing exception and covenant modification...",
        ),
        WorkspaceObject(
            id="doc_credit_memo",
            type=ObjectType.document,
            title="Acme credit memo v3",
            acl=ACL(readers=["u_rm", "u_credit", "u_analyst"]),
            metadata={"dscr": 1.28},
        ),
        WorkspaceObject(
            id="doc_financials",
            type=ObjectType.document,
            title="Acme financial model (updated)",
            acl=ACL(readers=["u_rm", "u_credit", "u_analyst"]),
            metadata={"revenue_forecast": 38_000_000, "prior_revenue_forecast": 42_000_000},
        ),
        WorkspaceObject(
            id="doc_legal_memo",
            type=ObjectType.document,
            title="Acme legal approval memo",
            acl=ACL(readers=["u_legal", "u_rm"], sensitivity=Sensitivity.restricted),
        ),
        WorkspaceObject(
            id="doc_research_publicside",
            type=ObjectType.document,
            title="Sector research note (public side)",
            acl=ACL(readers=["u_rm", "u_credit", "u_analyst"],
                    sensitivity=Sensitivity.barrier, barrier_tags=["public-side"]),
        ),
        WorkspaceObject(
            id="wf_approval",
            type=ObjectType.workflow,
            title="Acme approval workflow",
            acl=ACL(readers=["u_rm", "u_credit", "u_legal"]),
            metadata={"rm_approval": True, "credit_officer_approval": False, "legal_status": "pending"},
        ),
    ]


def acme_bundle(user_id: str = "u_rm") -> ContextBundle:
    """A representative assembled context for the RM preparing the brief."""
    return ContextBundle(
        user_id=user_id,
        intent="prepare_decision_brief",
        sources=[SourceRef(object_id="mtg_committee_0612"),
                 SourceRef(object_id="doc_credit_memo"),
                 SourceRef(object_id="doc_financials"),
                 SourceRef(object_id="wf_approval")],
        claims=ClaimMap(claims=[
            Claim(id="c1", text="Revenue forecast revised from $42M to $38M.",
                  supported=True, sources=[SourceRef(object_id="doc_financials")]),
        ]),
        permission_boundary=PermissionBoundary(
            excluded_object_ids=["doc_legal_memo"], reason="permission_restricted"),
        missing_evidence=[
            MissingEvidenceState(code="missing_covenant_tracker",
                                 description="Final covenant tracker not uploaded.", blocking=True),
        ],
        conflicts=[
            ConflictState(description="Pricing doc and CS plan show different discount levels.",
                          sources=[SourceRef(object_id="doc_credit_memo")]),
        ],
    )


def acme_expected_decision() -> DeterministicDecision:
    """What a correct verifier (WS-C) should return for the Acme bundle: NOT approval-ready."""
    return DeterministicDecision(
        approval_ready=False,
        firings=[
            RuleFiring(rule_id="missing_approver", passed=False, detail="Credit Officer approval missing."),
            RuleFiring(rule_id="approval_threshold", passed=False, detail="Discount exceeds delegated authority."),
        ],
        approvals=ApprovalMatrix(requirements=[
            ApprovalRequirement(role="relationship_manager", present=True),
            ApprovalRequirement(role="credit_officer", present=False),
            ApprovalRequirement(role="legal", present=False),
        ]),
    )

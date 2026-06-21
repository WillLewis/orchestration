"""WS-A synthetic regulated corpus.

The corpus is hand-authored deterministic data. Each object exists to exercise a
downstream hook: context assembly, verification, lifecycle revalidation, or the
three-vertical recipe proof.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Callable

from core.schemas import ACL, ObjectType, Sensitivity, Vertical, WorkspaceObject

AuthorityMatrix = dict[str, dict[str, object]]

_BASE_TS = datetime(2026, 6, 12, 14, 0, tzinfo=timezone.utc)
_PRIOR_TS = datetime(2026, 6, 5, 14, 0, tzinfo=timezone.utc)
_LEGAL_REVIEW_TS = datetime(2026, 6, 13, 9, 0, tzinfo=timezone.utc)
_FINANCIALS_V2_TS = datetime(2026, 6, 13, 10, 30, tzinfo=timezone.utc)

_AUTHORITY_MATRICES: dict[str, AuthorityMatrix] = {
    "finance": {
        "relationship_manager": {
            "max_discount": 0.15,
            "can_final_approve": False,
            "requires_above": "credit_officer",
        },
        "credit_officer": {
            "max_discount": 0.25,
            "can_final_approve": False,
            "requires_above": "committee",
        },
        "committee": {
            "max_discount": 1.0,
            "can_final_approve": True,
            "requires_above": None,
        },
    },
    "legal": {
        "associate": {"can_final_approve": False, "requires_above": "partner"},
        "partner": {"can_final_approve": True, "requires_above": None},
    },
    "health": {
        "principal_investigator": {
            "can_final_approve": False,
            "requires_above": "privacy_officer",
        },
        "privacy_officer": {"can_final_approve": True, "requires_above": None},
    },
}

_CHANGE_EVENTS = ("financials_v2", "legal_needs_review")


def load(vertical: Vertical) -> list[WorkspaceObject]:
    """Return the deterministic synthetic workspace for a vertical."""
    builder = _builders().get(str(vertical))
    if builder is None:
        raise ValueError(f"unsupported vertical: {vertical!r}")
    return [obj.model_copy(deep=True) for obj in builder()]


def authority_matrix(vertical: Vertical) -> AuthorityMatrix:
    """Delegated-authority limits and approval routes for a vertical."""
    matrix = _AUTHORITY_MATRICES.get(str(vertical))
    if matrix is None:
        raise ValueError(f"unsupported vertical: {vertical!r}")
    return deepcopy(matrix)


def apply_change(objects: list[WorkspaceObject], event_name: str) -> list[WorkspaceObject]:
    """Apply a named source-change event to a copied object list."""
    copied = [obj.model_copy(deep=True) for obj in objects]
    positions = {obj.id: index for index, obj in enumerate(copied)}

    if event_name == "legal_needs_review":
        _require_ids(positions, ["wf_approval", "doc_legal_memo"], event_name)
        workflow = copied[positions["wf_approval"]]
        workflow_metadata = dict(workflow.metadata)
        workflow_metadata["legal_status"] = "Needs Review"
        workflow_metadata["legal_status_reason"] = "Legal memo returned for additional review."
        copied[positions["wf_approval"]] = workflow.model_copy(
            update={
                "metadata": workflow_metadata,
                "version": workflow.version + 1,
                "updated_at": _LEGAL_REVIEW_TS,
            },
            deep=True,
        )

        legal_memo = copied[positions["doc_legal_memo"]]
        legal_metadata = dict(legal_memo.metadata)
        legal_metadata["approval_status"] = "Needs Review"
        copied[positions["doc_legal_memo"]] = legal_memo.model_copy(
            update={
                "metadata": legal_metadata,
                "version": legal_memo.version + 1,
                "updated_at": _LEGAL_REVIEW_TS,
            },
            deep=True,
        )
        return copied

    if event_name == "financials_v2":
        _require_ids(positions, ["doc_financials"], event_name)
        financials = copied[positions["doc_financials"]]
        financials_metadata = dict(financials.metadata)
        structured = dict(financials.metadata.get("structured_values", {}))
        # Lower cash flow (EBITDA) so the recomputed DSCR (cash_flow / debt_service) lands at 1.18
        # — below the 1.25 covenant floor. That drop is what trips the covenant gate downstream.
        structured.update({"revenue": 36_500_000, "ebitda": 8_481_250})
        financials_metadata.update(
            {
                "prior_revenue_forecast": financials.metadata["revenue_forecast"],
                "revenue_forecast": 36_500_000,
                "dscr": 1.18,
                "structured_values": structured,
                "change_reason": "Management case revised after updated bookings.",
            }
        )
        copied[positions["doc_financials"]] = financials.model_copy(
            update={
                "metadata": financials_metadata,
                "version": financials.version + 1,
                "updated_at": _FINANCIALS_V2_TS,
            },
            deep=True,
        )
        return copied

    raise ValueError(f"unsupported change event: {event_name!r}")


def change_events() -> list[str]:
    """Available deterministic source-change events."""
    return list(_CHANGE_EVENTS)


def _builders() -> dict[str, Callable[[], list[WorkspaceObject]]]:
    return {"finance": _finance_objects, "legal": _legal_objects, "health": _health_objects}


def _require_ids(positions: dict[str, int], ids: list[str], event_name: str) -> None:
    missing = [object_id for object_id in ids if object_id not in positions]
    if missing:
        raise ValueError(f"{event_name!r} requires object ids: {missing}")


def _obj(
    object_id: str,
    object_type: ObjectType,
    title: str,
    *,
    readers: list[str],
    metadata: dict | None = None,
    content: str | None = None,
    editors: list[str] | None = None,
    sensitivity: Sensitivity = Sensitivity.internal,
    barrier_tags: list[str] | None = None,
    version: int = 1,
    updated_at: datetime = _BASE_TS,
) -> WorkspaceObject:
    return WorkspaceObject(
        id=object_id,
        type=object_type,
        title=title,
        acl=ACL(
            readers=readers,
            editors=editors or [],
            sensitivity=sensitivity,
            barrier_tags=barrier_tags or [],
        ),
        metadata=metadata or {},
        version=version,
        updated_at=updated_at,
        content=content,
    )


def _finance_objects() -> list[WorkspaceObject]:
    bank_readers = ["u_rm", "u_credit", "u_analyst", "u_legal"]
    deal_readers = ["u_rm", "u_credit", "u_analyst"]

    return [
        _obj(
            "u_rm",
            ObjectType.user_profile,
            "Riley Morgan — Relationship Manager",
            readers=["u_rm"],
            metadata={"role": "relationship_manager", "department": "commercial_banking"},
        ),
        _obj(
            "u_credit",
            ObjectType.user_profile,
            "Casey Singh — Credit Officer",
            readers=["u_credit"],
            metadata={"role": "credit_officer", "department": "credit_risk"},
        ),
        _obj(
            "u_analyst",
            ObjectType.user_profile,
            "Jordan Lee — Credit Analyst",
            readers=["u_analyst"],
            metadata={"role": "analyst", "department": "portfolio_analytics"},
        ),
        _obj(
            "u_legal",
            ObjectType.user_profile,
            "Priya Nair — Legal Counsel",
            readers=["u_legal"],
            metadata={"role": "legal", "department": "legal"},
        ),
        _obj(
            "policy_information_barrier",
            ObjectType.document,
            "Commercial bank information-barrier policy",
            readers=bank_readers,
            metadata={
                "public_side_tag": "public-side",
                "private_side_tag": "private-side",
                "restricted_synthesis_requires": "compliance_review",
            },
        ),
        _obj(
            "mtg_committee_prior",
            ObjectType.meeting,
            "Acme renewal — prior committee review",
            readers=deal_readers,
            metadata={
                "meeting_date": "2026-06-05",
                "revenue_forecast": 42_000_000,
                "decision_context": "prior_review",
            },
            content=(
                "Prior review noted a $42M revenue forecast and asked the team to refresh "
                "the covenant tracker before final committee."
            ),
            updated_at=_PRIOR_TS,
        ),
        _obj(
            "mtg_committee_0612",
            ObjectType.meeting,
            "Acme renewal — pre-committee review",
            readers=deal_readers,
            metadata={
                "meeting_date": "2026-06-12",
                "decision_needed": "pricing_exception_and_covenant_modification",
                "source_ids": ["doc_credit_memo", "doc_financials", "wf_approval"],
            },
            content="Discussion of pricing exception and covenant modification...",
        ),
        _obj(
            "chat_dealroom",
            ObjectType.chat_thread,
            "Acme deal-room chat",
            readers=deal_readers,
            metadata={
                "participants": ["u_rm", "u_credit", "u_analyst"],
                "open_items": ["final_covenant_tracker", "legal_signoff"],
                "related_object_ids": ["doc_pricing_exception", "task_upload_tracker"],
            },
            content=(
                "Analyst will upload the final covenant tracker. Credit notes the "
                "pricing exception needs the Credit Officer before committee."
            ),
        ),
        _obj(
            "doc_credit_memo",
            ObjectType.document,
            "Acme credit memo v3",
            readers=deal_readers,
            metadata={
                "memo_version": 3,
                "dscr": 1.28,
                "leverage": 3.7,
                "line_items": {
                    "ebitda": 9_200_000,
                    "debt_service": 7_187_500,
                    "total_debt": 34_000_000,
                },
                "calculation_inputs": {
                    "dscr": {
                        "net_operating_income": 9_200_000,
                        "debt_service": 7_187_500,
                        "reported": 1.28,
                    }
                },
                "source_ids": ["doc_financials", "wf_approval"],
            },
            version=3,
            content="Credit memo v3 recommends review, not approval-ready status.",
        ),
        _obj(
            "doc_financials",
            ObjectType.document,
            "Acme financial model (updated)",
            readers=deal_readers,
            metadata={
                "revenue_forecast": 38_000_000,
                "prior_revenue_forecast": 42_000_000,
                "gross_margin": 0.41,
                "dscr": 1.28,
                "structured_values": {
                    "revenue": 38_000_000,
                    "ebitda": 9_200_000,
                    "debt_service": 7_187_500,
                },
            },
            sensitivity=Sensitivity.barrier,
            barrier_tags=["private-side"],
            content="Private-side borrower financial update.",
        ),
        _obj(
            "doc_legal_memo",
            ObjectType.document,
            "Acme legal approval memo",
            readers=["u_legal", "u_rm"],
            metadata={
                "approval_status": "pending",
                "legal_status": "pending",
                "related_object_ids": ["wf_approval"],
            },
            sensitivity=Sensitivity.restricted,
            content="Synthetic restricted legal memo. Legal approval is still pending.",
        ),
        _obj(
            "doc_research_publicside",
            ObjectType.document,
            "Sector research note (public side)",
            readers=deal_readers,
            metadata={
                "sector": "industrial_packaging",
                "barrier_side": "public-side",
                "related_object_ids": ["policy_information_barrier"],
            },
            sensitivity=Sensitivity.barrier,
            barrier_tags=["public-side"],
            content="Public-side sector note for information-barrier synthesis checks.",
        ),
        _obj(
            "doc_pricing_exception",
            ObjectType.document,
            "Acme pricing exception request",
            readers=deal_readers,
            metadata={
                "discount": 0.22,
                "standard_threshold": 0.15,
                "requested_by_role": "relationship_manager",
                "required_approver_role": "credit_officer",
                "related_object_ids": ["wf_approval"],
            },
            content="Requested discount is 22%, above RM delegated authority.",
        ),
        _obj(
            "doc_cs_plan",
            ObjectType.document,
            "Acme customer-success plan",
            readers=deal_readers,
            metadata={
                "discount": 0.18,
                "source_ids": ["chat_dealroom"],
                "conflicts_with": "doc_pricing_exception",
            },
            content="CS plan references an 18% discount, conflicting with pricing exception.",
        ),
        _obj(
            "wf_approval",
            ObjectType.workflow,
            "Acme approval workflow",
            readers=["u_rm", "u_credit", "u_legal"],
            metadata={
                "rm_approval": True,
                "credit_officer_approval": False,
                "legal_status": "pending",
                "required_approvals": [
                    "relationship_manager",
                    "credit_officer",
                    "legal",
                ],
                "expected_documents": [
                    "doc_credit_memo",
                    "doc_financials",
                    "doc_pricing_exception",
                    "final_covenant_tracker",
                ],
                "missing_documents": ["final_covenant_tracker"],
            },
        ),
        _obj(
            "task_upload_tracker",
            ObjectType.task,
            "Upload final covenant tracker",
            readers=deal_readers,
            editors=["u_analyst"],
            metadata={
                "owner": "analyst",
                "owner_user_id": "u_analyst",
                "status": "open",
                "missing_document": "final_covenant_tracker",
                "related_object_ids": ["wf_approval"],
            },
            content="Upload the final covenant tracker before committee.",
        ),
    ]


def _legal_objects() -> list[WorkspaceObject]:
    readers = ["u_contract_counsel", "u_partner"]

    return [
        _obj(
            "u_contract_counsel",
            ObjectType.user_profile,
            "Morgan Alvarez — Contract Counsel",
            readers=["u_contract_counsel"],
            metadata={"role": "associate", "department": "legal"},
        ),
        _obj(
            "u_partner",
            ObjectType.user_profile,
            "Dana Wu — Reviewing Partner",
            readers=["u_partner"],
            metadata={"role": "partner", "department": "legal"},
        ),
        _obj(
            "legal_msa_draft",
            ObjectType.document,
            "Northwind MSA draft v4",
            readers=readers,
            metadata={
                "clauses": [
                    {"id": "clause_liability", "status": "negotiated"},
                    {"id": "clause_data_processing", "status": "open"},
                ],
                "source_ids": ["legal_citation_set"],
                "required_object_ids": ["legal_partner_approval"],
            },
            version=4,
            content="Synthetic MSA draft with clause checklist hooks.",
        ),
        _obj(
            "legal_litigation_memo",
            ObjectType.document,
            "Privileged litigation risk memo",
            readers=readers,
            metadata={
                "privilege_tag": "attorney_client",
                "related_object_ids": ["legal_msa_draft"],
            },
            sensitivity=Sensitivity.restricted,
            content="Restricted privileged memo. Used for privilege-gate tests.",
        ),
        _obj(
            "legal_fabricated_case_record",
            ObjectType.document,
            "Fabricated citation marker",
            readers=readers,
            metadata={"fabricated": True, "reason": "hallucinated-citation hook"},
        ),
        _obj(
            "legal_citation_set",
            ObjectType.document,
            "Citation set for Northwind MSA review",
            readers=readers,
            metadata={
                "citations": [
                    {
                        "id": "cite_msa_001",
                        "target_id": "legal_msa_draft",
                        "fabricated": False,
                    },
                    {
                        "id": "cite_fake_999",
                        "target_id": "legal_fabricated_case_record",
                        "fabricated": True,
                    },
                ]
            },
        ),
        _obj(
            "legal_partner_approval",
            ObjectType.workflow,
            "Partner approval workflow",
            readers=readers,
            metadata={
                "required_approver_role": "partner",
                "approver_user_id": "u_partner",
                "approval_present": False,
            },
        ),
    ]


def _health_objects() -> list[WorkspaceObject]:
    readers = ["u_pi", "u_privacy_officer", "u_clinical_ops"]

    return [
        _obj(
            "u_pi",
            ObjectType.user_profile,
            "Sam Patel — Principal Investigator",
            readers=["u_pi"],
            metadata={"role": "principal_investigator", "department": "clinical"},
        ),
        _obj(
            "u_privacy_officer",
            ObjectType.user_profile,
            "Nora Chen — Privacy Officer",
            readers=["u_privacy_officer"],
            metadata={"role": "privacy_officer", "department": "privacy"},
        ),
        _obj(
            "u_clinical_ops",
            ObjectType.user_profile,
            "Alex Rivera — Clinical Ops",
            readers=["u_clinical_ops"],
            metadata={"role": "clinical_ops", "department": "clinical"},
        ),
        _obj(
            "health_protocol_prior",
            ObjectType.document,
            "CardioTrack protocol SOP v1",
            readers=readers,
            metadata={"current": False, "version_label": "v1"},
            version=1,
            updated_at=_PRIOR_TS,
        ),
        _obj(
            "health_protocol_current",
            ObjectType.document,
            "CardioTrack protocol SOP v2",
            readers=readers,
            metadata={
                "current": True,
                "version_label": "v2",
                "prior_version_id": "health_protocol_prior",
                "required_sections": ["eligibility", "consent", "safety_monitoring"],
                "missing_sections": ["consent"],
                "required_object_ids": ["health_reviewer_matrix"],
            },
            version=2,
            content="Current protocol SOP is missing the consent section.",
        ),
        _obj(
            "health_patient_record_phi",
            ObjectType.document,
            "Restricted patient record excerpt",
            readers=["u_privacy_officer"],
            metadata={
                "phi": True,
                "minimum_necessary": "privacy_officer_only",
                "related_object_ids": ["health_protocol_current"],
            },
            sensitivity=Sensitivity.restricted,
            content="Synthetic PHI excerpt for minimum-necessary checks.",
        ),
        _obj(
            "health_reviewer_matrix",
            ObjectType.workflow,
            "Protocol reviewer matrix",
            readers=readers,
            metadata={
                "required_reviewers": ["principal_investigator", "privacy_officer"],
                "present_reviewers": ["principal_investigator"],
                "missing_reviewers": ["privacy_officer"],
                "related_object_ids": ["health_protocol_current"],
            },
        ),
    ]


__all__ = ["authority_matrix", "apply_change", "change_events", "load"]

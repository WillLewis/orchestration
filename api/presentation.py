"""
api/presentation.py — frontend-only presentation view models.

The canonical domain endpoint (`POST /brief`) returns the raw `DecisionBrief` produced by the
pipeline. The vendored frontend uses `GET /api/brief` as a compatibility shim, so this module keeps
demo copy and UI grouping there without changing core contracts or the brief synthesizer.
"""
from __future__ import annotations

from core.schemas import ConflictState, ContextBundle, DecisionBrief, SourceRef

from api.models import (
    DecisionReadiness,
    DecisionReadinessActionSelector,
    DecisionReadinessExplainer,
    DecisionReadinessRow,
)


def _pct(value: float | None, fallback: int) -> int:
    if value is None:
        return fallback
    return round(value * 100)


def _approval_threshold(brief: DecisionBrief) -> tuple[float | None, float | None]:
    for firing in brief.policy_gates.firings:
        if firing.rule_id == "approval_threshold" and firing.threshold:
            return (
                firing.threshold.get("requested_discount"),
                firing.threshold.get("delegated_authority"),
            )
    return None, None


def _dscr_value(brief: DecisionBrief) -> float:
    for calc in brief.policy_gates.calculations:
        if calc.name.lower() in {"dscr", "debt service coverage ratio"}:
            return calc.computed
    return 1.28


def _has_approval(brief: DecisionBrief, role: str) -> bool:
    return any(req.role == role and req.present for req in brief.required_approvals.requirements)


def build_display_brief(brief: DecisionBrief, bundle: ContextBundle) -> DecisionBrief:
    """Return the screenshot-facing brief copy for `/api/brief`.

    This intentionally overlays only presentation copy. The structured gate, approval matrix,
    missing evidence, and source map still come from the live pipeline.
    """

    requested, delegated = _approval_threshold(brief)
    requested_pct = _pct(requested, 22)
    delegated_pct = _pct(delegated, 15)
    dscr = _dscr_value(brief)

    permission_limitations = list(brief.permission_limitations)
    if "doc_legal_memo" in bundle.permission_boundary.excluded_object_ids:
        permission_limitations = ["Legal memo is restricted — its contents were not used."]

    return brief.model_copy(
        update={
            "decision_needed": (
                "Approve or reject the pricing exception and covenant modification for Acme Corp."
            ),
            "executive_summary": (
                "Acme requests a pricing exception (22% discount) and a covenant modification on "
                "its renewal facility. The updated model lowers the revenue forecast, and required "
                "approvals are incomplete, so the packet is not approval-ready."
            ),
            "what_changed": [
                "Revenue forecast revised from $42M to $38M in the updated model.",
                "Legal approval is still pending.",
                "Project plan still references the prior approval date.",
            ],
            "key_facts": [
                f"Requested discount: {requested_pct}% (standard threshold {delegated_pct}%).",
                f"Debt service coverage ratio: {dscr:.2f}x.",
                "Facility: commercial renewal with covenant modification.",
            ],
            "conflicts": [
                ConflictState(
                    description=(
                        "Pricing doc and customer success plan show different discount levels "
                        "(22% vs 18%)."
                    ),
                    sources=[
                        SourceRef(object_id="doc_pricing_exception"),
                        SourceRef(object_id="doc_cs_plan"),
                    ],
                )
            ],
            "open_questions": [
                "Will the covenant modification hold if revenue lands below $38M?",
                "Does the 22% discount require committee sign-off beyond Credit?",
            ],
            "permission_limitations": permission_limitations,
        }
    )


def build_decision_readiness(brief: DecisionBrief, bundle: ContextBundle) -> DecisionReadiness:
    requested, delegated = _approval_threshold(brief)
    requested_pct = _pct(requested, 22)
    delegated_pct = _pct(delegated, 15)
    dscr = _dscr_value(brief)

    covenant_blocking = any(
        m.code == "missing_covenant_tracker" and m.blocking for m in bundle.missing_evidence
    )
    legal_pending = not _has_approval(brief, "legal")
    rm_approved = _has_approval(brief, "relationship_manager")

    return DecisionReadiness(
        summary=(
            "Committee packet is not ready. Two blockers remain: Credit Officer approval and "
            "final covenant tracker."
        ),
        rows=[
            DecisionReadinessRow(
                id="covenant_tracker",
                gate="Covenant tracker",
                status="blocking" if covenant_blocking else "passed",
                details="Final tracker is required before the committee can decide.",
                source_ids=["doc_covenant_tracker"],
                action=DecisionReadinessActionSelector(
                    label="Request from analyst",
                    tool="create_task",
                    target_object_id="task_new_1",
                    parameters={
                        "title": "Upload final covenant tracker",
                        "assignee": "Priya N. (Analyst)",
                        "due": "2026-06-22",
                        "status": "open",
                    },
                ),
            ),
            DecisionReadinessRow(
                id="credit_officer_approval",
                gate="Credit Officer approval",
                status="blocking" if not _has_approval(brief, "credit_officer") else "approved",
                details=(
                    f"Requested discount is {requested_pct}%, above the RM approval threshold "
                    f"of {delegated_pct}%."
                ),
                source_ids=["doc_pricing_exception", "wf_approval"],
                explainer=DecisionReadinessExplainer(
                    kind="threshold",
                    rule_id="approval_threshold",
                ),
                action=DecisionReadinessActionSelector(
                    label="Stage: route 22% to Credit Officer",
                    tool="route_approval",
                    target_object_id="doc_pricing_exception",
                    required_approver="credit_officer",
                    parameters={
                        "business_label": f"{requested_pct}% pricing exception",
                        "requested_discount_percent": requested_pct,
                        "route_note": (
                            f"Route the {requested_pct}% pricing exception to the Credit Officer; "
                            "it exceeds the RM's delegated authority."
                        ),
                    },
                ),
            ),
            DecisionReadinessRow(
                id="legal_approval",
                gate="Legal approval",
                status="pending" if legal_pending else "approved",
                details="Legal review has not completed.",
                source_ids=["wf_approval"],
                action=DecisionReadinessActionSelector(
                    label="View in workflow",
                    tool="route_approval",
                    target_object_id="wf_approval",
                    required_approver="legal",
                ),
            ),
            DecisionReadinessRow(
                id="dscr_calculation",
                gate="DSCR calculation",
                status="passed",
                details=f"Recalculated at {dscr:.2f}x and matches the updated financial model.",
                source_ids=["doc_financials"],
                explainer=DecisionReadinessExplainer(
                    kind="calculation",
                    calculation_name="dscr",
                ),
            ),
            DecisionReadinessRow(
                id="relationship_manager_approval",
                gate="Relationship Manager approval",
                status="approved" if rm_approved else "blocking",
                details="RM has signed off on the renewal package.",
                source_ids=["wf_approval"],
            ),
        ],
    )

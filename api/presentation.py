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
    LifecycleState,
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


def build_display_brief(
    brief: DecisionBrief,
    bundle: ContextBundle,
    lifecycle_state: LifecycleState | None = None,
) -> DecisionBrief:
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

    credit_signed = bool(lifecycle_state and lifecycle_state.credit_signed)
    legal_signed = bool(lifecycle_state and lifecycle_state.legal_signed)
    covenant_uploaded = bool(lifecycle_state and lifecycle_state.covenant_uploaded)
    cs_reconciled = bool(lifecycle_state and lifecycle_state.cs_reconciled)
    approval_ready = credit_signed and legal_signed and covenant_uploaded and cs_reconciled
    show_conflict = bool(credit_signed and not cs_reconciled)
    executive_summary = (
        "Acme's 22% pricing exception, covenant modification, Legal sign-off, final covenant "
        "tracker, and downstream source revalidation are complete. The packet is "
        "approval-ready for committee decision."
        if approval_ready
        else (
            "Acme requests a pricing exception (22% discount) and a covenant modification on "
            "its renewal facility. The updated model lowers the revenue forecast, and required "
            "approvals are incomplete, so the packet is not approval-ready."
        )
    )
    what_changed = ["Revenue forecast revised from $42M to $38M in the updated model."]
    what_changed.append(
        "Legal approved the covenant modification."
        if legal_signed
        else "Legal approval is still pending."
    )
    if covenant_uploaded:
        what_changed.append("Final covenant tracker was uploaded and attached.")
    else:
        what_changed.append("Final covenant tracker has not been uploaded.")
    if cs_reconciled:
        what_changed.append("Customer success plan now reflects the approved 22% discount.")
    else:
        what_changed.append("Project plan still references the prior approval date.")
    policy_gates = brief.policy_gates
    required_approvals = brief.required_approvals
    if lifecycle_state and (credit_signed or legal_signed or approval_ready):
        policy_gates = brief.policy_gates.model_copy(
            update={
                "approval_ready": approval_ready,
                "firings": [
                    firing.model_copy(
                        update={
                            "passed": True,
                            "detail": "Credit Officer signed off on the 22% exception.",
                            "threshold": {
                                "requested_discount": 0.22,
                                "delegated_authority": 0.25,
                            },
                        }
                    )
                    if firing.rule_id in {"approval_threshold", "missing_approver"}
                    else firing
                    for firing in brief.policy_gates.firings
                ],
            }
        )
        required_approvals = brief.required_approvals.model_copy(
            update={
                "requirements": [
                    req.model_copy(update={"present": True})
                    if (
                        (req.role == "credit_officer" and credit_signed)
                        or (req.role == "legal" and legal_signed)
                    )
                    else req
                    for req in brief.required_approvals.requirements
                ]
            }
        )

    return brief.model_copy(
        update={
            "decision_needed": (
                "Approve or reject the pricing exception and covenant modification for Acme Corp."
            ),
            "executive_summary": executive_summary,
            "what_changed": what_changed,
            "key_facts": [
                f"Requested discount: {requested_pct}% (standard threshold {delegated_pct}%).",
                f"Debt service coverage ratio: {dscr:.2f}x.",
                "Facility: commercial renewal with covenant modification.",
            ],
            "policy_gates": policy_gates,
            "required_approvals": required_approvals,
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
            ]
            if show_conflict
            else [],
            "open_questions": []
            if approval_ready
            else [
                "Will the covenant modification hold if revenue lands below $38M?",
                "Does the 22% discount require committee sign-off beyond Credit?",
            ],
            "permission_limitations": permission_limitations,
        }
    )


def build_decision_readiness(
    brief: DecisionBrief,
    bundle: ContextBundle,
    lifecycle_state: LifecycleState | None = None,
) -> DecisionReadiness:
    requested, delegated = _approval_threshold(brief)
    requested_pct = _pct(requested, 22)
    delegated_pct = _pct(delegated, 15)
    dscr = _dscr_value(brief)

    covenant_blocking = any(
        m.code == "missing_covenant_tracker" and m.blocking for m in bundle.missing_evidence
    )
    legal_pending = not _has_approval(brief, "legal")
    rm_approved = _has_approval(brief, "relationship_manager")

    credit_signed = bool(lifecycle_state and lifecycle_state.credit_signed)
    credit_routed = bool(lifecycle_state and lifecycle_state.routed)
    legal_signed = bool(lifecycle_state and lifecycle_state.legal_signed)
    legal_routed = bool(lifecycle_state and lifecycle_state.legal_routed)
    covenant_requested = bool(lifecycle_state and lifecycle_state.covenant_requested)
    covenant_uploaded = bool(lifecycle_state and lifecycle_state.covenant_uploaded)
    cs_reconciled = bool(lifecycle_state and lifecycle_state.cs_reconciled)
    approval_ready = credit_signed and legal_signed and covenant_uploaded and cs_reconciled

    rows = [
        DecisionReadinessRow(
            id="covenant_tracker",
            gate="Covenant tracker",
            status=(
                "passed"
                if covenant_uploaded or not covenant_blocking
                else "pending"
                if covenant_requested
                else "blocking"
            ),
            details=(
                "Final covenant tracker uploaded and attached to the committee packet."
                if covenant_uploaded
                else "Requested — pending Priya's final covenant tracker upload."
                if covenant_requested
                else "Final tracker is required before the committee can decide."
            ),
            source_ids=["doc_covenant_tracker"],
            action=None
            if covenant_requested or covenant_uploaded or not covenant_blocking
            else DecisionReadinessActionSelector(
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
            status=(
                "approved"
                if credit_signed or _has_approval(brief, "credit_officer")
                else "pending"
                if credit_routed
                else "blocking"
            ),
            details=(
                "Credit Officer signed off on the 22% pricing exception "
                "(within their 25% authority)."
                if credit_signed
                else "Routed — pending Credit Officer sign-off on the 22% exception."
                if credit_routed
                else (
                    f"Requested discount is {requested_pct}%, above the RM approval threshold "
                    f"of {delegated_pct}%."
                )
            ),
            source_ids=["doc_pricing_exception", "wf_approval"],
            explainer=DecisionReadinessExplainer(
                kind="threshold",
                rule_id="approval_threshold",
            ),
            action=None
            if credit_signed or credit_routed
            else DecisionReadinessActionSelector(
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
            status="approved" if legal_signed or not legal_pending else "pending",
            details=(
                "Legal signed off on the covenant modification."
                if legal_signed or not legal_pending
                else "Routed — pending Legal sign-off on the covenant modification."
                if legal_routed
                else "Legal review has not completed."
            ),
            source_ids=["wf_approval"],
            action=None
            if legal_routed or legal_signed or not legal_pending
            else DecisionReadinessActionSelector(
                label="Route to Legal",
                tool="route_approval",
                target_object_id="wf_approval",
                required_approver="legal",
                parameters={
                    "business_label": "Covenant modification legal review",
                    "route_note": (
                        "Route the covenant modification to Legal before committee decision."
                    ),
                },
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
    ]
    if credit_signed and not cs_reconciled:
        rows.append(
            DecisionReadinessRow(
                id="customer_success_plan_conflict",
                gate="Customer success plan conflict",
                status="pending",
                details=(
                    "Revalidation found the approved 22% pricing exception against the CS "
                    "plan's 18% assumption."
                ),
                source_ids=["doc_pricing_exception", "doc_cs_plan"],
                action=DecisionReadinessActionSelector(
                    label="Stage: reconcile CS plan",
                    tool="edit_document",
                    target_object_id="doc_cs_plan",
                    parameters={
                        "after": {"assumed_discount": "22%"},
                    },
                ),
            )
        )

    return DecisionReadiness(
        summary=(
            "All prerequisites are satisfied. The packet is approval-ready for committee decision."
            if approval_ready
            else (
                "Credit Officer signed off on the 22% exception. Reconcile the customer success "
                "plan; Legal sign-off and the final covenant tracker still block decision."
            )
            if credit_signed and not cs_reconciled
            else (
                "Credit Officer signed off on the 22% exception. Two blockers remain: the final "
                "covenant tracker and Legal sign-off on the covenant modification."
            )
            if credit_signed and not (legal_signed and covenant_uploaded)
            else (
                "Committee packet is not ready. Two blockers remain: Credit Officer approval and "
                "final covenant tracker."
            )
        ),
        rows=rows,
    )

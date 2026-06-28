"""API-local lifecycle event store for the Acme demo.

This intentionally does not change `core/` contracts. It gives the live demo the same causal state
the mock frontend already has: routed approval, returned approval, and applied revalidation.
"""
from __future__ import annotations

from datetime import UTC, datetime
from itertools import count
from typing import Any

from api.models import LifecycleEvent, LifecycleEventType, LifecycleState

_events: list[LifecycleEvent] = []
_ids = count(1)


def reset_lifecycle_events() -> LifecycleState:
    """Clear the in-memory demo event log."""
    _events.clear()
    return lifecycle_state()


def record_lifecycle_event(
    event_type: LifecycleEventType,
    *,
    user_id: str = "u_rm",
    intent: str = "prepare_decision_brief",
    object_id: str | None = None,
    detail: dict[str, Any] | None = None,
) -> LifecycleState:
    """Append one content-free event and return the derived state."""
    _events.append(
        LifecycleEvent(
            id=f"le_{next(_ids)}",
            type=event_type,
            user_id=user_id,
            intent=intent,
            object_id=object_id,
            detail=detail or {},
            created_at=datetime.now(UTC),
        )
    )
    return lifecycle_state(user_id=user_id, intent=intent)


def lifecycle_state(
    *,
    user_id: str = "u_rm",
    intent: str = "prepare_decision_brief",
) -> LifecycleState:
    """Derive current demo state from the event log."""
    scoped = [e for e in _events if e.user_id == user_id and e.intent == intent]
    credit_signed = _has_event(
        scoped,
        "approval_returned",
        object_id="doc_pricing_exception",
    )
    credit_routed = (
        _has_event(
            scoped,
            "approval_routed",
            object_id="doc_pricing_exception",
        )
        and not credit_signed
    )
    legal_signed = _has_event(
        scoped,
        "approval_returned",
        object_id="wf_approval",
    )
    legal_routed = (
        _has_event(scoped, "approval_routed", object_id="wf_approval")
        and not legal_signed
    )
    covenant_uploaded = _has_event(scoped, "evidence_uploaded", object_id="doc_covenant_tracker")
    covenant_requested = (
        _has_event(scoped, "evidence_requested", object_id="doc_covenant_tracker")
        and not covenant_uploaded
    )
    cs_reconciled = _has_event(scoped, "revalidation_applied", object_id="doc_cs_plan")
    approval_ready = credit_signed and legal_signed and covenant_uploaded and cs_reconciled
    if approval_ready:
        stage = "approval_ready"
    elif legal_routed or covenant_requested or (credit_signed and cs_reconciled):
        stage = "followups_pending"
    elif credit_signed:
        stage = "cascade_pending"
    elif credit_routed:
        stage = "credit_routed"
    else:
        stage = "initial"
    return LifecycleState(
        user_id=user_id,
        intent=intent,
        routed=credit_routed,
        credit_signed=credit_signed,
        legal_routed=legal_routed,
        legal_signed=legal_signed,
        covenant_requested=covenant_requested,
        covenant_uploaded=covenant_uploaded,
        cs_reconciled=cs_reconciled,
        stage=stage,
        cascade_available=credit_signed and not cs_reconciled,
        changes_count=1 if credit_signed and not cs_reconciled else 0,
        event_count=len(scoped),
        events=scoped,
    )


def _has_event(
    events: list[LifecycleEvent],
    event_type: LifecycleEventType,
    *,
    object_id: str | None = None,
    approver: str | None = None,
) -> bool:
    return any(
        event.type == event_type
        and (object_id is None or event.object_id == object_id)
        and (
            approver is None
            or event.detail.get("approver") == approver
            or event.detail.get("required_approver") == approver
        )
        for event in events
    )

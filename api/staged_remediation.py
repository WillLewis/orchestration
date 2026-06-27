"""Helpers for validating staged Decision Brief row remediations."""
from __future__ import annotations

from fastapi import HTTPException

from actions.composer import StagedRemediation
from core.schemas import ContextBundle, DecisionBrief

from api.lifecycle_events import lifecycle_state
from api.models import DecisionReadinessActionSelector, StagedRemediationRequest
from api.presentation import build_decision_readiness


def verified_staged_remediation(
    req: StagedRemediationRequest,
    brief: DecisionBrief,
    bundle: ContextBundle,
) -> StagedRemediation:
    """Verify the submitted staged row against the current server-generated readiness row."""
    state = lifecycle_state(user_id=req.user_id, intent=req.intent)
    readiness = build_decision_readiness(brief, bundle, state)
    row = next((item for item in readiness.rows if item.id == req.origin.row_id), None)
    if row is None or row.action is None:
        raise HTTPException(
            status_code=404,
            detail=f"decision readiness row '{req.origin.row_id}' is not actionable",
        )

    expected_origin = {
        "surface": "decision_readiness",
        "row_id": row.id,
        "remediation_tool": row.action.tool,
        "target_object_id": row.action.target_object_id,
        "required_approver": row.action.required_approver,
    }
    submitted_origin = req.origin.model_dump(mode="json")
    expected_action = _action_payload(row.action)
    submitted_action = _action_payload(req.remediation)
    expected_row = {
        "row_gate": row.gate,
        "row_details": row.details,
        "source_ids": row.source_ids,
    }
    submitted_row = {
        "row_gate": req.row_gate,
        "row_details": req.row_details,
        "source_ids": req.source_ids,
    }
    if (
        submitted_origin != expected_origin
        or submitted_action != expected_action
        or submitted_row != expected_row
    ):
        raise HTTPException(
            status_code=409,
            detail=f"staged remediation for row '{row.id}' is stale or mismatched",
        )

    return StagedRemediation(
        row_id=row.id,
        tool=row.action.tool,
        target_object_id=row.action.target_object_id,
        required_approver=row.action.required_approver,
        source_ids=row.source_ids,
        reason=row.details,
        parameters=row.action.parameters,
    )


def _action_payload(action: DecisionReadinessActionSelector) -> dict:
    return action.model_dump(mode="json", exclude_none=True)

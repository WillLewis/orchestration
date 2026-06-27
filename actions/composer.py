"""
actions/composer.py — WS-E Phase 2: the Safe Action Composer (``core.pipeline.ActionComposer``).

An LLM *proposes* candidate actions from the brief's next steps and open items, mapping each onto
a ``ToolCard``. The composer then runs **every** candidate through the deterministic engine
(``validate_action`` + ``build_diff``), so each action ends up carrying either a previewable diff
or a ``blocked_reason``. The model can never mark an action executable: ``validate_action``
re-derives ``blocked_reason`` from scratch and the composer keeps that result verbatim.

The proposer is injectable: ``HeuristicActionProposer`` runs offline (default, for tests);
``LLMActionProposer`` routes via ``PLANNER_MODEL``. The output reads like
"6 follow-ups — 3 draftable now, 2 need approval routing, 1 blocked by missing evidence."
"""
from __future__ import annotations

import os
import re
from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, Field

from core.schemas import (
    Action,
    ActionDiff,
    ActionPlan,
    ContextBundle,
    DecisionBrief,
    SideEffectClass,
    SourceRef,
)

from actions.engine import ActionValidationEngine
from actions.toolcards import ToolCardRegistry

# Role tokens the heuristic proposer recognises in a free-text next step.
_ROLE_TOKENS: tuple[tuple[str, str], ...] = (
    ("credit officer", "credit_officer"),
    ("credit_officer", "credit_officer"),
    ("legal", "legal"),
    ("compliance", "compliance"),
    ("relationship manager", "relationship_manager"),
)


def _slug(text: str, prefix: str) -> str:
    body = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return f"{prefix}_{body[:40] or 'item'}"


def _approver_in(text: str) -> str | None:
    low = text.lower()
    for token, role in _ROLE_TOKENS:
        if token in low:
            return role
    return None


@runtime_checkable
class ActionProposer(Protocol):
    """Proposes candidate actions (tool + intent) from a brief. Never decides what is allowed."""

    def propose(self, brief: DecisionBrief, bundle: ContextBundle) -> list[Action]: ...


class StagedRemediation(BaseModel):
    """One Decision Brief row remediation staged for drawer validation.

    This API-layer seam lets one readiness-row remediation go through the deterministic composer
    without falling back to a separately-authored follow-up list.
    """

    row_id: str
    tool: str
    target_object_id: str
    required_approver: str | None = None
    source_ids: list[str] = Field(default_factory=list)
    reason: str = ""
    parameters: dict[str, Any] = Field(default_factory=dict)


def action_from_staged_remediation(
    remediation: StagedRemediation,
    registry: ToolCardRegistry | None = None,
) -> Action:
    """Build the candidate action for one staged readiness-row remediation."""
    tool_registry = registry or ToolCardRegistry()
    side_effect = tool_registry.get(remediation.tool).side_effect
    parameters = remediation.parameters
    reason = (
        _string_param(parameters, "route_note")
        or remediation.reason
        or f"Stage remediation for {remediation.row_id}."
    )
    after = _after_for_staged_remediation(remediation)
    risk = "medium" if remediation.tool == "route_approval" else "low"
    sources = [
        SourceRef(object_id=object_id)
        for object_id in (remediation.source_ids or [remediation.target_object_id])
    ]
    return Action(
        tool=remediation.tool,
        reason=reason,
        sources=sources,
        required_approver=remediation.required_approver,
        risk=risk,
        side_effect=side_effect,
        diff=ActionDiff(target_object_id=remediation.target_object_id, after=after),
    )


class HeuristicActionProposer:
    """Deterministic, offline proposer (default). Maps each ``brief.next_steps`` line to a
    ToolCard-backed action by keyword — no network, no API key."""

    def __init__(self, registry: ToolCardRegistry | None = None) -> None:
        self.registry = registry or ToolCardRegistry()

    def propose(self, brief: DecisionBrief, bundle: ContextBundle) -> list[Action]:
        actions: list[Action] = []
        for step in brief.next_steps:
            actions.append(self._map_step(step, bundle))
        return actions

    def _map_step(self, step: str, bundle: ContextBundle) -> Action:
        low = step.lower()
        if any(k in low for k in ("route", "approval packet", "sign-off", "sign off")):
            return self._route_approval(step)
        if any(k in low for k in ("obtain", "upload", "missing evidence", "tracker", "document")):
            return self._create_task(step)
        if any(k in low for k in ("reconcile", "conflict", "note", "risk")):
            return self._draft_note(step, bundle)
        if any(k in low for k in ("schedule", "meeting", "follow-up review", "committee")):
            return self._schedule_meeting(step)
        if "status" in low:
            return self._update_status(step)
        return self._draft_note(step, bundle)

    def _card_side_effect(self, tool: str) -> SideEffectClass:
        return self.registry.get(tool).side_effect

    def _route_approval(self, step: str) -> Action:
        approver = _approver_in(step) or "credit_officer"
        return Action(
            tool="route_approval",
            reason=step,
            required_approver=approver,
            risk="medium",
            side_effect=self._card_side_effect("route_approval"),
            sources=[SourceRef(object_id="wf_approval")],
            diff=ActionDiff(target_object_id="wf_approval", after={f"{approver}_routed": True}),
        )

    def _create_task(self, step: str) -> Action:
        return Action(
            tool="create_task",
            reason=step,
            side_effect=self._card_side_effect("create_task"),
            diff=ActionDiff(
                target_object_id=_slug(step, "task"),
                after={"title": step, "status": "open"},
            ),
        )

    def _draft_note(self, step: str, bundle: ContextBundle) -> Action:
        sources = bundle.conflicts[0].sources if ("conflict" in step.lower() and bundle.conflicts) \
            else []
        return Action(
            tool="draft_internal_note",
            reason=step,
            side_effect=self._card_side_effect("draft_internal_note"),
            sources=list(sources),
            diff=ActionDiff(
                target_object_id=_slug(step, "note"),
                after={"topic": step, "status": "draft"},
            ),
        )

    def _schedule_meeting(self, step: str) -> Action:
        return Action(
            tool="schedule_meeting",
            reason=step,
            side_effect=self._card_side_effect("schedule_meeting"),
            diff=ActionDiff(
                target_object_id="mtg_followup",
                after={"topic": step, "scheduled": True},
            ),
        )

    def _update_status(self, step: str) -> Action:
        return Action(
            tool="update_project_status",
            reason=step,
            required_approver="credit_officer",
            risk="high",
            side_effect=self._card_side_effect("update_project_status"),
            diff=ActionDiff(target_object_id="wf_approval", after={"status": step}),
        )


class LLMActionProposer:
    """Opt-in proposer routed through ``PLANNER_MODEL``. Injectable; requires ``ANTHROPIC_API_KEY``.

    The model only proposes (tool, reason, approver, target, after); the composer still validates
    and diffs every candidate through the engine, so a proposal can never bypass a gate. Not used
    by the offline test suite.
    """

    def __init__(
        self,
        model_env: str = "PLANNER_MODEL",
        registry: ToolCardRegistry | None = None,
    ) -> None:
        from dotenv import load_dotenv

        load_dotenv()
        model = os.environ.get(model_env)
        if not model:
            raise RuntimeError(f"{model_env} is not set; cannot route action proposal.")
        self.model = model
        self.registry = registry or ToolCardRegistry()

    def propose(self, brief: DecisionBrief, bundle: ContextBundle) -> list[Action]:
        import json

        from anthropic import Anthropic

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("ANTHROPIC_API_KEY is not set; cannot call the planner model.")
        instruction = (
            "Propose follow-up actions for this decision brief. Return JSON "
            '{"actions":[{"tool","reason","approver","target_object_id","after"}]}. '
            f"tool must be one of {self.registry.names()}. Do NOT decide whether an action is "
            "allowed or executable; the system validates every action.\n"
        )
        payload = {
            "decision_needed": brief.decision_needed,
            "next_steps": brief.next_steps,
            "open_questions": brief.open_questions,
        }
        client = Anthropic()
        resp = client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[{"role": "user", "content": instruction + json.dumps(payload)}],
        )
        data = json.loads(resp.content[0].text)
        actions: list[Action] = []
        for item in data.get("actions", []):
            tool = str(item.get("tool", "draft_internal_note"))
            after = item.get("after") or {}
            target = str(item.get("target_object_id") or _slug(item.get("reason", ""), "obj"))
            actions.append(
                Action(
                    tool=tool,
                    reason=str(item.get("reason", "")),
                    required_approver=item.get("approver"),
                    side_effect=self.registry.get(tool).side_effect
                    if tool in self.registry else SideEffectClass.propose,
                    diff=ActionDiff(target_object_id=target, after=dict(after)) if after else None,
                )
            )
        return actions


class PlanSummary(BaseModel):
    """The draftable / needs-routing / blocked split, derived entirely from engine validation."""

    draftable: list[int] = []
    needs_routing: list[int] = []
    blocked: list[int] = []
    headline: str = ""


def summarize_plan(plan: ActionPlan) -> PlanSummary:
    """Split by what the user does with each action: send a route for sign-off (`needs_routing`),
    apply/draft it now (`draftable`), or nothing because a gate blocked it (`blocked`). A route is
    a READY outbound action — it requests an approval, it is not itself approval-held — so it is
    bucketed by kind, not by a blocked_reason."""
    draftable: list[int] = []
    needs_routing: list[int] = []
    blocked: list[int] = []
    for i, action in enumerate(plan.actions):
        if action.blocked_reason is not None:
            blocked.append(i)
        elif action.tool == "route_approval":
            needs_routing.append(i)  # ready to route for sign-off — not blocked
        else:
            draftable.append(i)
    headline = (
        f"{len(plan.actions)} follow-ups — {len(draftable)} ready now, "
        f"{len(needs_routing)} to route, {len(blocked)} blocked"
    )
    return PlanSummary(
        draftable=draftable, needs_routing=needs_routing, blocked=blocked, headline=headline
    )


class SafeActionComposer:
    """WS-E implementation of ``core.pipeline.ActionComposer``."""

    def __init__(
        self,
        engine: ActionValidationEngine | None = None,
        proposer: ActionProposer | None = None,
        registry: ToolCardRegistry | None = None,
    ) -> None:
        self.engine = engine or ActionValidationEngine()
        self.proposer = proposer or HeuristicActionProposer()
        self.registry = registry or ToolCardRegistry()

    def compose(self, brief: DecisionBrief, bundle: ContextBundle) -> ActionPlan:
        approvals = brief.required_approvals
        validated: list[Action] = []
        for candidate in self.proposer.propose(brief, bundle):
            # Fill in the diff's `before` from current state, then re-derive the gate verdict.
            diffed = (
                candidate.model_copy(update={"diff": self.engine.build_diff(candidate)})
                if candidate.diff is not None
                else candidate
            )
            # validate_action ignores any model-supplied blocked_reason — the gate is authoritative.
            validated.append(self.engine.validate_action(diffed, bundle, approvals=approvals))
        return ActionPlan(actions=validated)

    def compose_staged_remediation(
        self,
        remediation: StagedRemediation,
        brief: DecisionBrief,
        bundle: ContextBundle,
    ) -> Action:
        """Validate exactly one staged readiness-row remediation into one drawer card."""
        candidate = self._action_from_staged_remediation(remediation)
        diffed = candidate.model_copy(update={"diff": self.engine.build_diff(candidate)})
        return self.engine.validate_action(diffed, bundle, approvals=brief.required_approvals)

    def _action_from_staged_remediation(self, remediation: StagedRemediation) -> Action:
        return action_from_staged_remediation(remediation, self.registry)


def _string_param(parameters: dict[str, Any], key: str) -> str | None:
    value = parameters.get(key)
    return value if isinstance(value, str) and value.strip() else None


def _role_label(role: str | None) -> str:
    if not role:
        return "Approver"
    return role.replace("_", " ").title()


def _after_for_staged_remediation(remediation: StagedRemediation) -> dict[str, Any]:
    parameters = remediation.parameters
    if remediation.tool == "route_approval":
        after: dict[str, Any] = {
            "approval_route": _role_label(remediation.required_approver),
            "state": "routed",
        }
        business_label = _string_param(parameters, "business_label")
        if business_label:
            after["approval_request"] = business_label
        requested_discount = parameters.get("requested_discount_percent")
        if isinstance(requested_discount, int | float):
            after["requested_discount"] = f"{requested_discount:g}%"
        return after

    if remediation.tool == "create_task":
        return {
            "title": _string_param(parameters, "title") or remediation.reason or remediation.row_id,
            "assignee": _string_param(parameters, "assignee") or "Priya N. (Analyst)",
            "due": _string_param(parameters, "due") or "2026-06-22",
            "status": _string_param(parameters, "status") or "open",
        }

    if remediation.tool == "edit_document":
        return dict(parameters.get("after") if isinstance(parameters.get("after"), dict) else {})

    return dict(parameters)

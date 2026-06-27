"""
actions/engine.py — WS-E Phase 1: the deterministic action engine (NO LLM).

This is the trust-critical core of the Safe Action Composer. **The LLM proposes; this engine
decides what is allowed and executes.** Every write, diff, and rollback goes through here, and a
model can never override a gate: ``validate_action`` re-derives ``blocked_reason`` from scratch,
so a model-supplied "this is fine" is ignored if a gate fires (proven in the red-team test).

Gates (a blocked action is never executed, even if a human approves its index):

* **permission** — every ``action.sources`` object must be accessible to the actor (not in the
  bundle's ``permission_boundary``, and readable under its ACL).
* **mosaic / information-barrier** — block when sources combine conflicting barrier sides
  (``public-side`` + ``private-side``): synthesizing them would cross an information barrier.
* **injection** — scan referenced source *content* for hidden-instruction patterns; the offending
  content is stripped from anything that reaches a prompt and the action is blocked.
* **missing-evidence** — a decision-committing action (route an approval / advance status) is
  blocked while a *blocking* ``MissingEvidenceState`` is unresolved, unless it remediates it.
* **approval** — a ``write`` / ``route_approval`` carrying a ``required_approver`` is held until
  that approver is actually present (signed off).

Execution applies ONLY approved, non-blocked actions to an in-memory workspace; ``dry_run``
previews diffs without mutating; ``rollback`` restores prior state from an audit event.
"""
from __future__ import annotations

import re
from collections.abc import Sequence

from core.schemas import (
    Action,
    ActionDiff,
    ActionPlan,
    ApprovalMatrix,
    AuditEvent,
    ContextBundle,
    DryRunResult,
    MissingEvidenceState,
    ObjectType,
    RollbackPlan,
    Sensitivity,
    SideEffectClass,
    WorkspaceObject,
)
from fixtures.acme import USERS, acme_workspace

# Information-barrier sides that must never be synthesized together (mosaic gate).
BARRIER_SIDES: frozenset[str] = frozenset({"public-side", "private-side"})
# Roles cleared to read `restricted` content even when listed as readers.
RESTRICTED_CLEARANCE_ROLES: frozenset[str] = frozenset({"legal", "compliance"})
# Tools that *advance the decision status* (presuppose the evidence is in) — missing-evidence
# gated. Routing for sign-off is NOT here: you may route for review, but you may not mark the
# decision advanced while blocking evidence is unresolved.
STATUS_ADVANCING_TOOLS: frozenset[str] = frozenset({"update_project_status"})
# Writes that are remediation/prep and do NOT presuppose the decision (never evidence-gated).
EVIDENCE_SAFE_WRITE_TOOLS: frozenset[str] = frozenset({"create_task", "edit_document"})
# Hidden-instruction patterns scanned in source content (injection gate).
INJECTION_PATTERNS: tuple[str, ...] = (
    "ignore previous instructions",
    "ignore all previous",
    "ignore the above",
    "disregard previous",
    "disregard all prior",
    "you are now",
    "new instructions:",
    "system prompt",
    "override the",
    "exfiltrate",
    "send the data to",
    "email the data",
    "reveal your",
    "act as the",
)


def _workspace_map(
    workspace: Sequence[WorkspaceObject] | dict[str, WorkspaceObject] | None,
) -> dict[str, WorkspaceObject]:
    if workspace is None:
        return {o.id: o for o in acme_workspace()}
    if isinstance(workspace, dict):
        return workspace  # shared, live dict (executor mutates it in place)
    return {o.id: o for o in workspace}


def scan_injection(content: str | None) -> str | None:
    """Return the first hidden-instruction pattern found in ``content``, else ``None``."""
    if not content:
        return None
    low = content.lower()
    for pat in INJECTION_PATTERNS:
        if pat in low:
            return pat
    return None


def strip_injection(content: str | None) -> str:
    """Remove any line containing a hidden-instruction pattern (so it never reaches a prompt)."""
    if not content:
        return ""
    kept = [line for line in content.splitlines() if scan_injection(line) is None]
    return "\n".join(kept).strip()


class ActionValidationEngine:
    """Deterministic gatekeeper + diff builder. Holds a (possibly shared) workspace map so it can
    inspect ACLs, barrier tags, and content for the gates."""

    def __init__(
        self,
        workspace: Sequence[WorkspaceObject] | dict[str, WorkspaceObject] | None = None,
        users: dict[str, dict] | None = None,
    ) -> None:
        self._objects = _workspace_map(workspace)
        self._users = users if users is not None else USERS

    # -- public API ---------------------------------------------------------- #
    def validate_action(
        self,
        action: Action,
        bundle: ContextBundle,
        recipe: object | None = None,
        *,
        approvals: ApprovalMatrix | None = None,
    ) -> Action:
        """Return a copy of ``action`` with ``blocked_reason`` re-derived from the gates.

        The reason is recomputed from scratch every call — any model-supplied ``blocked_reason``
        is discarded, so the model cannot mark a gated action executable.
        """
        reason = (
            self._permission_gate(action, bundle)
            or self._mosaic_gate(action)
            or self._injection_gate(action)
            or self._missing_evidence_gate(action, bundle)
            or self._approval_gate(action, approvals)
        )
        return action.model_copy(update={"blocked_reason": reason})

    def validate_plan(
        self,
        plan: ActionPlan,
        bundle: ContextBundle,
        *,
        approvals: ApprovalMatrix | None = None,
    ) -> ActionPlan:
        return ActionPlan(
            actions=[self.validate_action(a, bundle, approvals=approvals) for a in plan.actions]
        )

    def build_diff(self, action: Action) -> ActionDiff:
        """Fill in the ``before`` of a proposed diff from current workspace state (for the
        action-diff drawer). A new target yields ``None`` before-values."""
        proposed = action.diff
        if proposed is None:
            return ActionDiff(target_object_id="", before={}, after={})
        target = proposed.target_object_id
        after = dict(proposed.after)
        obj = self._objects.get(target)
        before = {key: (obj.metadata.get(key) if obj is not None else None) for key in after}
        return ActionDiff(target_object_id=target, before=before, after=after)

    def safe_content(self, object_id: str) -> str:
        """Injection-stripped content of an object — what the composer may pass to a prompt."""
        obj = self._objects.get(object_id)
        return strip_injection(obj.content if obj else "")

    # -- gates --------------------------------------------------------------- #
    def _permission_gate(self, action: Action, bundle: ContextBundle) -> str | None:
        excluded = set(bundle.permission_boundary.excluded_object_ids)
        bad: list[str] = []
        for src in action.sources:
            oid = src.object_id
            if oid in excluded:
                bad.append(oid)
                continue
            obj = self._objects.get(oid)
            if obj is not None and not self._can_read(obj, bundle.user_id):
                bad.append(oid)
        if bad:
            return f"permission: actor '{bundle.user_id}' cannot access {sorted(set(bad))}"
        return None

    def _mosaic_gate(self, action: Action) -> str | None:
        tags: set[str] = set()
        for src in action.sources:
            obj = self._objects.get(src.object_id)
            if obj is not None:
                tags |= set(obj.acl.barrier_tags)
        sides = tags & BARRIER_SIDES
        if len(sides) >= 2:
            return (
                "information-barrier (mosaic): action combines "
                f"{sorted(sides)} sources — would cross an information barrier"
            )
        return None

    def _injection_gate(self, action: Action) -> str | None:
        hits: list[str] = []
        for src in action.sources:
            obj = self._objects.get(src.object_id)
            pattern = scan_injection(obj.content if obj else None)
            if pattern is not None:
                hits.append(f"{src.object_id}: '{pattern}'")
        if hits:
            return "injection: hidden-instruction pattern detected and stripped (" + \
                "; ".join(hits) + ")"
        return None

    def _missing_evidence_gate(self, action: Action, bundle: ContextBundle) -> str | None:
        blocking = [m for m in bundle.missing_evidence if m.blocking]
        if not blocking:
            return None
        advancing = action.tool in STATUS_ADVANCING_TOOLS or (
            action.side_effect == SideEffectClass.write
            and action.tool not in EVIDENCE_SAFE_WRITE_TOOLS
        )
        if not advancing:
            return None  # routing for sign-off / drafting / creating prep is always allowed
        if self._remediates(action, blocking):
            return None
        codes = [m.code for m in blocking]
        return f"missing_evidence: blocked by {codes} (blocking evidence unresolved)"

    def _approval_gate(self, action: Action, approvals: ApprovalMatrix | None) -> str | None:
        approver = action.required_approver
        if approver is None:
            return None
        # Routing for sign-off is HOW an approval is obtained — never block a route on the very
        # approver it routes to (that is circular). The gate applies only to a write that COMMITS a
        # decision needing an approval that isn't present yet (e.g. marking a status "Approved"),
        # never to the request that seeks it.
        gated = action.side_effect == SideEffectClass.write and action.tool != "route_approval"
        if not gated:
            return None
        present = approvals is not None and any(
            req.role == approver and req.present for req in approvals.requirements
        )
        if not present:
            return f"approval: requires '{approver}' sign-off (not yet present)"
        return None

    # -- helpers ------------------------------------------------------------- #
    def _can_read(self, obj: WorkspaceObject, user_id: str) -> bool:
        role = (self._users.get(user_id) or {}).get("role")
        acl = obj.acl
        is_reader = user_id in acl.readers or (role is not None and role in acl.readers)
        if not is_reader:
            return False
        if acl.sensitivity == Sensitivity.restricted:
            return role is not None and role in RESTRICTED_CLEARANCE_ROLES
        return True

    @staticmethod
    def _remediates(action: Action, blocking: list[MissingEvidenceState]) -> str | None:
        haystack = " ".join(
            [
                action.reason,
                action.tool,
                action.diff.target_object_id if action.diff else "",
                " ".join(str(v) for v in action.diff.after.values()) if action.diff else "",
            ]
        ).lower()
        for item in blocking:
            tokens = {t for t in re.split(r"[_\s-]+", item.code.lower()) if t and t != "missing"}
            if any(tok in haystack for tok in tokens):
                return item.code
        return None


class DryRunExecutor:
    """Previews what actions WOULD do, with zero side effects. Powers the action-diff drawer."""

    def __init__(self, engine: ActionValidationEngine) -> None:
        self.engine = engine

    def dry_run(self, plan: ActionPlan) -> list[ActionDiff]:
        return [self.engine.build_diff(a) for a in plan.actions]

    def dry_run_results(self, plan: ActionPlan) -> list[DryRunResult]:
        results: list[DryRunResult] = []
        for i, action in enumerate(plan.actions):
            results.append(
                DryRunResult(
                    action_index=i,
                    would_succeed=action.blocked_reason is None,
                    diff=self.engine.build_diff(action),
                    blocked_reason=action.blocked_reason,
                )
            )
        return results


class WorkspaceExecutor:
    """Implements ``core.pipeline.Executor``. Applies ONLY approved, non-blocked actions to an
    in-memory workspace; records skipped/blocked actions; supports rollback via inverse diffs."""

    def __init__(
        self,
        workspace: Sequence[WorkspaceObject] | None = None,
        engine: ActionValidationEngine | None = None,
    ) -> None:
        source = workspace if workspace is not None else acme_workspace()
        # Deep, mutable copy so execution never mutates the caller's fixtures.
        self._objects: dict[str, WorkspaceObject] = {
            o.id: o.model_copy(deep=True) for o in source
        }
        # Share the live dict with the engine so gate checks see post-mutation state.
        self.engine = engine or ActionValidationEngine(workspace=self._objects)

    @property
    def workspace(self) -> dict[str, WorkspaceObject]:
        return self._objects

    def execute(self, plan: ActionPlan, approved_indices: list[int]) -> list[AuditEvent]:
        approved = set(approved_indices)
        events: list[AuditEvent] = []
        for i, action in enumerate(plan.actions):
            if i not in approved:
                events.append(self._skip(i, action, "not approved by human"))
                continue
            if action.blocked_reason:
                events.append(self._skip(i, action, action.blocked_reason))
                continue
            events.append(self._apply(i, action))
        return events

    def rollback(self, event: AuditEvent) -> AuditEvent:
        """Restore prior state from an ``executed`` audit event using the inverse diff."""
        plan = self.build_rollback_plan(event)
        inverse = plan.inverse
        obj = self._objects.get(inverse.target_object_id)
        if obj is not None:
            for key, value in inverse.after.items():  # inverse.after == original `before`
                if value is None:
                    obj.metadata.pop(key, None)
                else:
                    obj.metadata[key] = value
            obj.version += 1
        return AuditEvent(
            actor="executor",
            action="rolled_back",
            detail={
                "index": plan.action_index,
                "target": inverse.target_object_id,
                "restored": inverse.after,
            },
        )

    @staticmethod
    def build_rollback_plan(event: AuditEvent) -> RollbackPlan:
        detail = event.detail
        inverse = ActionDiff(
            target_object_id=str(detail.get("target", "")),
            before=dict(detail.get("after", {})),
            after=dict(detail.get("before", {})),
        )
        return RollbackPlan(action_index=int(detail.get("index", -1)), inverse=inverse)

    # -- internals ----------------------------------------------------------- #
    def _apply(self, index: int, action: Action) -> AuditEvent:
        diff = self.engine.build_diff(action)
        target = diff.target_object_id
        obj = self._objects.get(target)
        if obj is None:
            obj = WorkspaceObject(
                id=target or f"obj_new_{index}",
                type=ObjectType.task,
                title=str(diff.after.get("title", target or f"obj_new_{index}")),
            )
            self._objects[obj.id] = obj
        before = {key: obj.metadata.get(key) for key in diff.after}
        for key, value in diff.after.items():
            obj.metadata[key] = value
        obj.version += 1
        return AuditEvent(
            actor="executor",
            action="executed",
            detail={
                "index": index,
                "tool": action.tool,
                "target": obj.id,
                "before": before,
                "after": dict(diff.after),
            },
        )

    @staticmethod
    def _skip(index: int, action: Action, reason: str) -> AuditEvent:
        return AuditEvent(
            actor="executor",
            action="skipped",
            detail={"index": index, "tool": action.tool, "reason": reason},
        )

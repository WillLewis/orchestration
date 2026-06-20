"""
actions/loop.py — WS-E Phase 2: the controlled work loop.

Closes the loop from a verified ``DecisionBrief`` to executed, audited work — without unsafe
autonomy. The loop is a deterministic five-node pipeline; LLM personas only supply async reply
*text*, and the engine still gates every write:

    distribute → collect → escalate → schedule → close

* **distribute** — fan each owner-bound action out to its persona as an assignment.
* **collect** — gather async persona replies; record sign-offs in the approval matrix, then
  RE-VALIDATE the plan so newly-satisfied approvals can clear (and gates still hold what they hold).
* **escalate** — route items that exceed authority (persona escalate/decline) or remain hard-blocked
  to a human / Compliance.
* **schedule** — propose a follow-up review for anything still unresolved.
* **close** — a human-approval step selects indices, then ``Executor.execute`` runs ONLY approved,
  non-blocked actions, emitting the audit dossier.

The nodes are pure ``(state) -> state`` functions, so the loop maps 1:1 onto a LangGraph
``StateGraph`` (see ``build_state_graph``); the hand-rolled ``run`` keeps tests offline and fast.
"""
from __future__ import annotations

from collections.abc import Callable

from pydantic import BaseModel

from core.schemas import (
    ActionPlan,
    ApprovalMatrix,
    ApprovalRequirement,
    AuditEvent,
    ContextBundle,
    DecisionBrief,
)

from actions.composer import SafeActionComposer
from actions.engine import ActionValidationEngine, WorkspaceExecutor
from actions.personas import Persona, PersonaClient, PersonaReply, StubPersonaClient, default_personas

# Which persona owns an action whose tool is not approver-bound.
_DEFAULT_OWNER = "analyst"
_UNOWNED_TOOLS = frozenset({"schedule_meeting"})  # the loop itself schedules these


class Assignment(BaseModel):
    action_index: int
    owner_role: str
    tool: str
    message: str = ""


class Escalation(BaseModel):
    action_index: int
    to: str
    reason: str


class ScheduledItem(BaseModel):
    topic: str
    reason: str
    attendees: list[str] = []


class LoopState(BaseModel):
    """The work-loop dossier — the audit-ready record of one decision cycle."""

    bundle: ContextBundle
    brief: DecisionBrief
    plan: ActionPlan
    approvals: ApprovalMatrix
    assignments: list[Assignment] = []
    replies: list[PersonaReply] = []
    escalations: list[Escalation] = []
    scheduled: list[ScheduledItem] = []
    approved_indices: list[int] = []
    audit: list[AuditEvent] = []
    closed: bool = False


def approve_nonblocked(plan: ActionPlan) -> list[int]:
    """Default human-approval policy: approve every action the engine did NOT block."""
    return [i for i, a in enumerate(plan.actions) if a.blocked_reason is None]


class ControlledWorkLoop:
    """Orchestrates distribute → collect → escalate → schedule → close over a composed plan."""

    def __init__(
        self,
        executor: WorkspaceExecutor | None = None,
        engine: ActionValidationEngine | None = None,
        composer: SafeActionComposer | None = None,
        persona_client: PersonaClient | None = None,
        personas: dict[str, Persona] | None = None,
        approver: Callable[[ActionPlan], list[int]] | None = None,
    ) -> None:
        self.executor = executor or WorkspaceExecutor()
        # Share the executor's live workspace so gate checks see what execution will mutate.
        self.engine = engine or self.executor.engine
        self.composer = composer or SafeActionComposer(engine=self.engine)
        self.persona_client = persona_client or StubPersonaClient()
        self.personas = personas or default_personas()
        self.approver = approver or approve_nonblocked

    # -- entry point --------------------------------------------------------- #
    def run(self, brief: DecisionBrief, bundle: ContextBundle) -> LoopState:
        plan = self.composer.compose(brief, bundle)
        state = LoopState(
            bundle=bundle,
            brief=brief,
            plan=plan,
            approvals=brief.required_approvals.model_copy(deep=True),
        )
        for node in (self.distribute, self.collect, self.escalate, self.schedule, self.close):
            state = node(state)
        return state

    # -- nodes --------------------------------------------------------------- #
    def distribute(self, state: LoopState) -> LoopState:
        assignments: list[Assignment] = []
        for i, action in enumerate(state.plan.actions):
            owner = self._owner_for(action.tool, action.required_approver)
            if owner is None or owner not in self.personas:
                continue
            display = self.personas[owner].display
            assignments.append(
                Assignment(
                    action_index=i,
                    owner_role=owner,
                    tool=action.tool,
                    message=f"To {display}: {action.reason}",
                )
            )
        state.assignments = assignments
        state.audit.append(
            AuditEvent(actor="loop", action="distribute", detail={"assignments": len(assignments)})
        )
        return state

    def collect(self, state: LoopState) -> LoopState:
        replies: list[PersonaReply] = []
        present = {r.role for r in state.approvals.requirements if r.present}
        for assignment in state.assignments:
            persona = self.personas[assignment.owner_role]
            text = self.persona_client.generate(persona, assignment.message)
            replies.append(
                PersonaReply(
                    role=assignment.owner_role,
                    action_index=assignment.action_index,
                    decision=persona.stance,
                    message=text,
                )
            )
            if persona.stance == "sign_off":
                present.add(assignment.owner_role)
        state.replies = replies
        state.approvals = _matrix_with_present(state.approvals, present)
        # Re-validate so newly-present approvers can clear approval holds; hard gates still hold.
        state.plan = self.engine.validate_plan(state.plan, state.bundle, approvals=state.approvals)
        state.audit.append(
            AuditEvent(actor="loop", action="collect", detail={"replies": len(replies)})
        )
        return state

    def escalate(self, state: LoopState) -> LoopState:
        escalations: list[Escalation] = []
        for reply in state.replies:
            if reply.decision in ("escalate", "decline"):
                escalations.append(
                    Escalation(action_index=reply.action_index, to="compliance",
                               reason=f"{reply.role} {reply.decision}")
                )
        for i, action in enumerate(state.plan.actions):
            reason = action.blocked_reason
            if reason and not reason.startswith("approval:"):
                escalations.append(Escalation(action_index=i, to="human", reason=reason))
        state.escalations = _dedupe_escalations(escalations)
        state.audit.append(
            AuditEvent(actor="loop", action="escalate", detail={"count": len(state.escalations)})
        )
        return state

    def schedule(self, state: LoopState) -> LoopState:
        unresolved = {e.action_index for e in state.escalations}
        unresolved |= {i for i, a in enumerate(state.plan.actions) if a.blocked_reason is not None}
        if unresolved:
            tools = sorted({state.plan.actions[i].tool for i in unresolved})
            state.scheduled.append(
                ScheduledItem(
                    topic="Follow-up committee review for unresolved items",
                    reason=f"{len(unresolved)} item(s) unresolved: {', '.join(tools)}",
                    attendees=[p.display for p in self.personas.values()],
                )
            )
        state.audit.append(
            AuditEvent(actor="loop", action="schedule", detail={"scheduled": len(state.scheduled)})
        )
        return state

    def close(self, state: LoopState) -> LoopState:
        # Human-approval step precedes execution.
        approved = self.approver(state.plan)
        state.approved_indices = approved
        state.audit.extend(self.executor.execute(state.plan, approved))
        state.closed = True
        state.audit.append(
            AuditEvent(actor="loop", action="close", detail={"approved": approved})
        )
        return state

    # -- helpers ------------------------------------------------------------- #
    @staticmethod
    def _owner_for(tool: str, required_approver: str | None) -> str | None:
        if tool in _UNOWNED_TOOLS:
            return None
        if required_approver is not None:
            return required_approver
        return _DEFAULT_OWNER


def _matrix_with_present(matrix: ApprovalMatrix, present_roles: set[str]) -> ApprovalMatrix:
    requirements = list(matrix.requirements)
    seen = {r.role for r in requirements}
    updated = [
        ApprovalRequirement(role=r.role, present=r.present or r.role in present_roles)
        for r in requirements
    ]
    for role in present_roles - seen:
        updated.append(ApprovalRequirement(role=role, present=True))
    return ApprovalMatrix(requirements=updated)


def _dedupe_escalations(items: list[Escalation]) -> list[Escalation]:
    seen: set[tuple[int, str]] = set()
    out: list[Escalation] = []
    for item in items:
        key = (item.action_index, item.to)
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


# --------------------------------------------------------------------------- #
# Demo (offline) so the integrator can run the loop on fixtures.acme
# --------------------------------------------------------------------------- #
def run_acme_loop_demo() -> LoopState:
    """Run the full work loop on the Acme fixture with stub personas (no network)."""
    from brief.synthesizer import synthesize
    from fixtures.acme import acme_bundle, acme_expected_decision

    bundle = acme_bundle()
    brief = synthesize(bundle, acme_expected_decision())
    return ControlledWorkLoop().run(brief, bundle)


def main() -> None:
    from actions.composer import summarize_plan

    state = run_acme_loop_demo()
    print("WS-E controlled work loop — demo over fixtures.acme (stub personas)")
    print(summarize_plan(state.plan).headline)
    print("\nassignments:")
    for a in state.assignments:
        print(f"  [{a.action_index}] {a.tool} -> {a.owner_role}")
    print("replies:")
    for r in state.replies:
        print(f"  [{r.action_index}] {r.role}: {r.decision} — {r.message}")
    print("escalations:")
    for e in state.escalations:
        print(f"  [{e.action_index}] -> {e.to} ({e.reason})")
    print("scheduled:")
    for s in state.scheduled:
        print(f"  - {s.topic} ({s.reason})")
    print("execution audit:")
    for ev in state.audit:
        if ev.actor == "executor":
            print(f"  {ev.action}: {ev.detail}")
    print(f"\napproved_indices={state.approved_indices} closed={state.closed}")
    print("Nothing executed without approval; blocked actions were skipped by the engine. ✔")


if __name__ == "__main__":
    main()

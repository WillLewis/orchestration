"""
actions/tests/test_loop.py — WS-E Phase 2 (controlled work loop).

The loop runs end-to-end on the Acme fixture with stub personas: assignments fan out, replies
return, one item escalates, a follow-up is scheduled, and the plan closes. Execution only ever
touches approved, non-blocked actions — the human-approval step gates it. Offline, deterministic.
"""
from core.schemas import DecisionBrief
from fixtures.acme import acme_bundle, acme_expected_decision

from actions.loop import ControlledWorkLoop, LoopState, run_acme_loop_demo


def _acme_brief() -> DecisionBrief:
    from brief.synthesizer import synthesize

    return synthesize(acme_bundle(), acme_expected_decision())


def _run() -> LoopState:
    return run_acme_loop_demo()


def test_loop_runs_all_five_nodes_end_to_end():
    state = _run()
    assert state.closed is True
    assert len(state.assignments) >= 2     # distribute fanned out
    assert len(state.replies) >= 2         # collect gathered persona replies
    assert len(state.escalations) >= 1     # legal exceeded authority → escalate
    assert len(state.scheduled) >= 1       # a follow-up review was scheduled


def test_collect_records_signoff_and_escalation_without_blocking_routes():
    state = _run()
    by_tool_approver = {
        (a.tool, a.required_approver): a for a in state.plan.actions
    }
    credit_route = by_tool_approver[("route_approval", "credit_officer")]
    legal_route = by_tool_approver[("route_approval", "legal")]
    # A route is a READY request to send — never held on the approver it routes to.
    assert credit_route.blocked_reason is None
    assert legal_route.blocked_reason is None
    # Credit Officer signed off in collect → recorded present in the approval matrix.
    present = {r.role for r in state.approvals.requirements if r.present}
    assert "credit_officer" in present
    # Legal escalated (no sign-off) → captured as an escalation, and NOT marked approved.
    assert "legal" not in present
    legal_idx = next(
        i for i, a in enumerate(state.plan.actions)
        if a.tool == "route_approval" and a.required_approver == "legal"
    )
    assert any(e.action_index == legal_idx for e in state.escalations)


def test_execution_only_touches_approved_non_blocked_actions():
    state = _run()
    executed = [e for e in state.audit if e.action == "executed"]
    executed_indices = {e.detail["index"] for e in executed}
    # Everything executed was approved and non-blocked.
    assert executed_indices <= set(state.approved_indices)
    for i in executed_indices:
        assert state.plan.actions[i].blocked_reason is None
    # Genuinely gate-blocked actions are never executed, even though the rest were approved —
    # the human-approval step never overrides a gate.
    blocked_indices = {
        i for i, a in enumerate(state.plan.actions) if a.blocked_reason is not None
    }
    assert not (executed_indices & blocked_indices)


def test_human_approval_step_gates_execution():
    # A human who approves nothing → no executions, workspace untouched.
    loop = ControlledWorkLoop(approver=lambda plan: [])
    before = {oid: dict(o.metadata) for oid, o in loop.executor.workspace.items()}
    state = loop.run(_acme_brief(), acme_bundle())
    assert state.approved_indices == []
    assert not any(e.action == "executed" for e in state.audit)
    after = {oid: dict(o.metadata) for oid, o in loop.executor.workspace.items()}
    assert before == after


def test_loop_mutated_workspace_only_via_executed_actions():
    loop = ControlledWorkLoop()
    state = loop.run(_acme_brief(), acme_bundle())
    # The credit-officer routing executed → recorded on the approval workflow object.
    assert loop.executor.workspace["wf_approval"].metadata.get("credit_officer_routed") is True
    assert state.closed is True

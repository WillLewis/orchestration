"""
actions/tests/test_composer.py — WS-E Phase 2 (composer).

``compose()`` proposes via an (injected) LLM seam, then validates + diffs every candidate through
the deterministic engine. The draftable / needs-routing / blocked split must match what the engine
says, action by action. Offline — the proposer is stubbed / heuristic.
"""
from core.pipeline import ActionComposer
from core.schemas import Action, ActionDiff, ContextBundle, DecisionBrief, SourceRef
from fixtures.acme import acme_bundle, acme_expected_decision

from actions.composer import (
    HeuristicActionProposer,
    SafeActionComposer,
    summarize_plan,
)


def _acme_brief() -> DecisionBrief:
    from brief.synthesizer import synthesize

    return synthesize(acme_bundle(), acme_expected_decision())


def test_composer_satisfies_pipeline_protocol():
    assert isinstance(SafeActionComposer(), ActionComposer)


def test_compose_maps_next_steps_to_toolcards():
    plan = SafeActionComposer().compose(_acme_brief(), acme_bundle())
    tools = {a.tool for a in plan.actions}
    # Routing steps → route_approval; obtain-evidence → create_task; conflict → draft note.
    assert "route_approval" in tools
    assert "create_task" in tools
    assert "draft_internal_note" in tools


def test_route_actions_carry_their_required_approver():
    plan = SafeActionComposer().compose(_acme_brief(), acme_bundle())
    routes = [a for a in plan.actions if a.tool == "route_approval"]
    assert routes
    assert {a.required_approver for a in routes} <= {"credit_officer", "legal"}


def test_summary_split_is_consistent_with_engine_validation():
    plan = SafeActionComposer().compose(_acme_brief(), acme_bundle())
    summary = summarize_plan(plan)
    # Every bucket entry must match the action's actual kind + blocked_reason.
    for i in summary.draftable:
        assert plan.actions[i].blocked_reason is None
        assert plan.actions[i].tool != "route_approval"
    for i in summary.needs_routing:
        # Routes are READY (not approval-held): a route requests sign-off, it isn't blocked on it.
        assert plan.actions[i].tool == "route_approval"
        assert plan.actions[i].blocked_reason is None
    for i in summary.blocked:
        assert plan.actions[i].blocked_reason is not None
    # Buckets partition the plan.
    assert sorted(summary.draftable + summary.needs_routing + summary.blocked) == list(
        range(len(plan.actions))
    )


def test_acme_routes_are_ready_to_route():
    plan = SafeActionComposer().compose(_acme_brief(), acme_bundle())
    summary = summarize_plan(plan)
    # The credit-officer + legal routes are READY for the user to send — routing is HOW sign-off is
    # obtained, so a route is never blocked on the approver it routes to.
    assert len(summary.needs_routing) >= 2
    for i in summary.needs_routing:
        assert plan.actions[i].blocked_reason is None
    assert "to route" in summary.headline


def test_every_action_carries_a_diff_for_the_drawer():
    plan = SafeActionComposer().compose(_acme_brief(), acme_bundle())
    for a in plan.actions:
        assert a.diff is not None
        assert a.diff.target_object_id


class _FixedProposer:
    """Injected stand-in LLM proposer — returns canned candidates, no network."""

    def propose(self, brief: DecisionBrief, bundle: ContextBundle) -> list[Action]:
        return [
            Action(tool="create_task", reason="upload tracker",
                   diff=ActionDiff(target_object_id="task_x", after={"title": "Upload tracker"})),
            Action(tool="route_approval", reason="route", required_approver="credit_officer",
                   sources=[SourceRef(object_id="wf_approval")],
                   diff=ActionDiff(target_object_id="wf_approval",
                                   after={"credit_officer_routed": True})),
        ]


def test_injected_proposer_is_validated_offline():
    composer = SafeActionComposer(proposer=_FixedProposer())
    plan = composer.compose(_acme_brief(), acme_bundle())
    assert len(plan.actions) == 2
    # create_task is draftable; the route is READY to send — routing obtains the sign-off, so it is
    # not blocked on the credit_officer it routes to.
    assert plan.actions[0].blocked_reason is None
    assert plan.actions[1].tool == "route_approval"
    assert plan.actions[1].blocked_reason is None


def test_heuristic_proposer_is_the_default():
    assert isinstance(SafeActionComposer().proposer, HeuristicActionProposer)

"""
tests/test_pipeline.py — WS-0. Lock the stage interfaces.

Every `core.pipeline` Protocol is satisfied by a stub, and the stubs compose into
an end-to-end run that respects the deterministic boundary (the brief never
overrides a gate; blocked actions never execute).
"""
from core import demo
from core.pipeline import (
    ActionComposer,
    BriefSynthesizer,
    ContextAssembler,
    EvalRunner,
    Executor,
    RevalidationEngine,
    Verifier,
)
from core.schemas import ActionPlan, ContextBundle, DecisionBrief, DeterministicDecision


def test_stubs_satisfy_every_protocol():
    assert isinstance(demo.StubContextAssembler(), ContextAssembler)
    assert isinstance(demo.StubVerifier(), Verifier)
    assert isinstance(demo.StubBriefSynthesizer(), BriefSynthesizer)
    assert isinstance(demo.StubActionComposer(), ActionComposer)
    assert isinstance(demo.StubExecutor(), Executor)
    assert isinstance(demo.StubRevalidationEngine(), RevalidationEngine)
    assert isinstance(demo.StubEvalRunner(), EvalRunner)


def test_demo_runs_end_to_end_with_typed_outputs():
    r = demo.run_demo()
    assert isinstance(r["bundle"], ContextBundle)
    assert isinstance(r["decision"], DeterministicDecision)
    assert isinstance(r["brief"], DecisionBrief)
    assert isinstance(r["plan"], ActionPlan)


def test_brief_never_overrides_the_gate():
    r = demo.run_demo()
    assert r["decision"].approval_ready is False
    assert r["brief"].policy_gates.approval_ready is False


def test_blocked_actions_are_not_executed():
    r = demo.run_demo()
    executed = [e for e in r["audit"] if e.action == "executed"]
    skipped = [e for e in r["audit"] if e.action == "skipped"]
    assert skipped, "the missing-evidence action should be skipped"
    blocked_idx = {i for i, a in enumerate(r["plan"].actions) if a.blocked_reason}
    executed_idx = {e.detail["index"] for e in executed}
    assert blocked_idx.isdisjoint(executed_idx)


def test_revalidation_flags_stale_section():
    r = demo.run_demo()
    assert any(section.stale for section in r["stale"])

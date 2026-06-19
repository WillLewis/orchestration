"""
tests/test_roundtrip.py — WS-0. Lock the frozen contract.

One representative instance per model in `core.schemas.__all__`, round-tripped
through JSON. `test_samples_cover_every_model` fails if a model is added without a
sample, so the inventory can never silently drift after freeze.
"""
import pytest
from pydantic import BaseModel

from core import schemas as s
from fixtures.acme import acme_bundle, acme_expected_decision, acme_workspace

# Shared building blocks reused across samples.
_sref = s.SourceRef(object_id="o1", span="p1")
_edge = s.SourceEdge(from_id="a", to_id="b", relation="cites")
_diff = s.ActionDiff(target_object_id="o1", before={"x": 1}, after={"x": 2})
_firing = s.RuleFiring(rule_id="r1", passed=False, detail="nope")
_decision = acme_expected_decision()
_stale = s.StaleSectionState(section="s3", stale=True, reason="changed")
_audit = s.AuditEvent(actor="executor", action="executed", detail={"i": 0})
_evcase = s.EvalCase(id="e1", vertical="finance", prompt="prep brief")

SAMPLES: dict[str, BaseModel] = {
    # Permissions & workspace
    "ACL": s.ACL(readers=["u1"], sensitivity=s.Sensitivity.restricted, barrier_tags=["public-side"]),
    "WorkspaceObject": acme_workspace()[0],
    # Sources, claims, graph
    "SourceRef": _sref,
    "SourceEdge": _edge,
    "SourceGraph": s.SourceGraph(nodes=["a", "b"], edges=[_edge]),
    "Claim": s.Claim(id="c1", text="t", supported=True, sources=[_sref]),
    "ClaimMap": s.ClaimMap(claims=[s.Claim(id="c1", text="t")]),
    # Context states + bundle
    "MissingEvidenceState": s.MissingEvidenceState(code="m1", description="d", blocking=True),
    "ConflictState": s.ConflictState(description="d", sources=[_sref]),
    "PermissionBoundary": s.PermissionBoundary(excluded_object_ids=["o1"]),
    "ContextBundle": acme_bundle(),
    # Verification
    "Rule": s.Rule(id="r1", description="d", severity=s.RuleSeverity.block),
    "RulePack": s.RulePack(id="rp1", vertical="finance", rules=[s.Rule(id="r1", description="d")]),
    "RuleFiring": _firing,
    "ApprovalRequirement": s.ApprovalRequirement(role="credit_officer", present=False),
    "ApprovalMatrix": s.ApprovalMatrix(requirements=[s.ApprovalRequirement(role="rm", present=True)]),
    "CalculationCheck": s.CalculationCheck(name="dscr", expected=1.28, computed=1.28, matches=True),
    "PolicyNode": s.PolicyNode(id="p1", description="d", requires=["p0"]),
    "PolicyGraph": s.PolicyGraph(id="pg1", vertical="finance", nodes=[s.PolicyNode(id="p1")]),
    "SchemaValidation": s.SchemaValidation(schema_name="DecisionBrief", valid=True),
    "DeterministicDecision": _decision,
    "ComplianceTrace": s.ComplianceTrace(decision=_decision, rulepack_id="rp1", rulepack_version=1),
    # Decision brief
    "DecisionBrief": s.DecisionBrief(decision_needed="approve?", policy_gates=_decision),
    # Actions
    "ToolCard": s.ToolCard(
        name="create_task", description="d", side_effect=s.SideEffectClass.write, max_retries=2
    ),
    "ActionDiff": _diff,
    "Action": s.Action(
        tool="route_approval", reason="r", diff=_diff, required_approver="credit_officer", risk="medium"
    ),
    "ActionPlan": s.ActionPlan(actions=[s.Action(tool="t", reason="r")]),
    "AuditEvent": _audit,
    "RollbackPlan": s.RollbackPlan(action_index=0, inverse=_diff),
    "ApprovalPolicy": s.ApprovalPolicy(side_effect=s.SideEffectClass.write, required_approver="credit_officer"),
    "DryRunResult": s.DryRunResult(action_index=0, would_succeed=True, diff=_diff, audit_preview=_audit),
    # Lifecycle
    "StaleSectionState": _stale,
    "RevalidationRule": s.RevalidationRule(id="rv1", trigger_object_ids=["o1"], affected_sections=["s3"]),
    "EventTrigger": s.EventTrigger(object_id="o1", detail={"k": "v"}),
    "ReapprovalRoute": s.ReapprovalRoute(section="s3", required_approver="legal", reason="r"),
    "SourceDependencyGraph": s.SourceDependencyGraph(work_product_id="wp1", source_ids=["o1"], edges=[_edge]),
    "ChangeImpactMap": s.ChangeImpactMap(
        changed_object_id="o1",
        impacted_sections=[_stale],
        reapproval_routes=[s.ReapprovalRoute(section="s3", required_approver="legal")],
    ),
    "WorkProductContract": s.WorkProductContract(
        id="wp1", source_dependencies=["o1"], revalidation_rules=["rv1"], stale_sections=[_stale]
    ),
    # Evals & telemetry
    "EvalCase": _evcase,
    "EvalPack": s.EvalPack(id="ep1", vertical="finance", cases=[_evcase]),
    "EvalTrace": s.EvalTrace(case_id="e1", model="claude-sonnet-4-6", rule_firings=[_firing]),
    "EvalResult": s.EvalResult(case_id="e1", passed=True, scores={"x": 1.0}),
    "RegressionSuite": s.RegressionSuite(id="rs1", case_ids=["e1"], rulepack_id="rp1"),
    "FeedbackReasonCode": s.FeedbackReasonCode(code="wrong_approver", category="policy"),
    "RedactedFailurePacket": s.RedactedFailurePacket(
        case_id="e1", recipe_id="finance_credit_v1", failure_reason_code="rule_fail", rule_firings=[_firing]
    ),
    "TelemetryEvent": s.TelemetryEvent(intent_class="prepare_brief", recipe_id="finance_credit_v1"),
    "PrivacyBudget": s.PrivacyBudget(epsilon=1.0, delta=1e-6, spent=0.1),
    # Recipes
    "AgentRecipe": s.AgentRecipe(id="finance_credit_v1", vertical="finance", rulepack_id="rp1"),
    "VerticalScore": s.VerticalScore(vertical="finance", deterministic_rule_pass=1.0, cases_total=10, cases_passed=9),
    "RecipeScorecard": s.RecipeScorecard(pack_id="three_vertical", scores=[s.VerticalScore(vertical="legal")]),
}


def _model_names() -> set[str]:
    return {
        n
        for n in s.__all__
        if isinstance(getattr(s, n), type)
        and issubclass(getattr(s, n), BaseModel)
        and getattr(s, n) is not BaseModel
    }


def test_samples_cover_every_model():
    """Adding a model to the frozen contract must come with a round-trip sample here."""
    names = _model_names()
    assert set(SAMPLES) == names, (
        f"missing samples: {sorted(names - set(SAMPLES))} | "
        f"unknown samples: {sorted(set(SAMPLES) - names)}"
    )


@pytest.mark.parametrize("name", sorted(SAMPLES))
def test_model_roundtrips_through_json(name):
    obj = SAMPLES[name]
    assert type(obj).model_validate_json(obj.model_dump_json()) == obj

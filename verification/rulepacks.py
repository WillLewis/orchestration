from __future__ import annotations

from core.schemas import PolicyGraph, PolicyNode, Rule, RulePack, RuleSeverity

FINANCE_CREDIT_RULE_IDS = (
    "missing_approver",
    "approval_threshold",
    "calculation_validation",
    "required_document_checklist",
    "permission_gate",
    "output_schema_validation",
    "stale_document",
)

_RULEPACKS: dict[str, RulePack] = {
    "finance_credit_v1": RulePack(
        id="finance_credit_v1",
        vertical="finance",
        version=1,
        rules=[
            Rule(
                id="missing_approver",
                description="Required approval is absent from the approval workflow.",
                severity=RuleSeverity.block,
            ),
            Rule(
                id="approval_threshold",
                description="Requested exception exceeds delegated authority.",
                severity=RuleSeverity.block,
            ),
            Rule(
                id="calculation_validation",
                description="Structured financial calculations must match recomputed values.",
                severity=RuleSeverity.block,
            ),
            Rule(
                id="required_document_checklist",
                description="Required source documents must be present in assembled context.",
                severity=RuleSeverity.block,
            ),
            Rule(
                id="permission_gate",
                description="Decision output must not require permission-restricted sources.",
                severity=RuleSeverity.block,
            ),
            Rule(
                id="output_schema_validation",
                description="Generated work products must validate against locked schemas.",
                severity=RuleSeverity.block,
            ),
            Rule(
                id="stale_document",
                description="Known-stale source documents block approval readiness.",
                severity=RuleSeverity.block,
            ),
        ],
    )
}

_POLICY_GRAPHS: dict[str, PolicyGraph] = {
    "finance_credit_v1": PolicyGraph(
        id="finance_credit_v1_policy",
        vertical="finance",
        nodes=[
            PolicyNode(
                id="missing_approver",
                description="All blocking approval roles must be present.",
            ),
            PolicyNode(
                id="approval_threshold",
                description="Delegated authority must cover the requested exception.",
                requires=["missing_approver"],
            ),
            PolicyNode(
                id="approval_ready",
                description="Approval readiness only passes after all blocking gates pass.",
                requires=list(FINANCE_CREDIT_RULE_IDS),
            ),
        ],
    )
}


def get_rulepack(rulepack_id: str) -> RulePack:
    try:
        return _RULEPACKS[rulepack_id]
    except KeyError as exc:
        raise ValueError(f"Unknown rulepack: {rulepack_id}") from exc


def get_policy_graph(rulepack_id: str) -> PolicyGraph:
    try:
        return _POLICY_GRAPHS[rulepack_id]
    except KeyError as exc:
        raise ValueError(f"Unknown policy graph for rulepack: {rulepack_id}") from exc


def rule_is_blocking(rulepack: RulePack, rule_id: str) -> bool:
    return any(
        rule.id == rule_id and rule.severity == RuleSeverity.block for rule in rulepack.rules
    )

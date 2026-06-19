from __future__ import annotations

from collections.abc import Mapping, Sequence

from core.schemas import ApprovalMatrix, ApprovalRequirement, RuleFiring


def resolve_approval_matrix(
    approvals: Mapping[str, bool],
    required_roles: Sequence[str] | None = None,
) -> ApprovalMatrix:
    roles = list(required_roles) if required_roles is not None else list(approvals)
    return ApprovalMatrix(
        requirements=[
            ApprovalRequirement(role=role, present=bool(approvals.get(role, False)))
            for role in roles
        ]
    )


def evaluate_missing_approver(
    approvals: ApprovalMatrix,
    blocking_roles: Sequence[str] | None = None,
) -> RuleFiring | None:
    if not approvals.requirements:
        return None

    blocking = set(blocking_roles) if blocking_roles is not None else {
        requirement.role for requirement in approvals.requirements
    }
    missing = [
        requirement.role
        for requirement in approvals.requirements
        if requirement.role in blocking and not requirement.present
    ]
    if not missing:
        return RuleFiring(
            rule_id="missing_approver",
            passed=True,
            detail="Required approvals present.",
        )

    if len(missing) == 1:
        detail = f"{_display_role(missing[0])} approval missing."
    else:
        detail = "Missing required approvals: " + ", ".join(_display_role(role) for role in missing)
    return RuleFiring(rule_id="missing_approver", passed=False, detail=detail)


def _display_role(role: str) -> str:
    return " ".join(part.capitalize() for part in role.split("_"))

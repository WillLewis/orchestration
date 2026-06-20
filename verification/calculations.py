from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from core.schemas import CalculationCheck, RuleFiring

DEFAULT_TOLERANCE = 0.005


class CalculationChecker:
    def check_many(self, specs: Sequence[Mapping[str, Any]]) -> list[CalculationCheck]:
        return [self.check(spec) for spec in specs]

    def check(self, spec: Mapping[str, Any]) -> CalculationCheck:
        name = str(spec["name"])
        expected = float(spec["expected"])
        tolerance = float(spec.get("tolerance", DEFAULT_TOLERANCE))
        computed = self._compute(name, spec)
        return CalculationCheck(
            name=name,
            expected=expected,
            computed=computed,
            matches=abs(computed - expected) <= tolerance,
        )

    def _compute(self, name: str, spec: Mapping[str, Any]) -> float:
        if "computed" in spec:
            return round(float(spec["computed"]), 4)

        inputs = spec.get("inputs", {})
        if not isinstance(inputs, Mapping):
            raise ValueError(f"Calculation {name} inputs must be a mapping.")

        if name == "dscr":
            return _ratio(inputs, "cash_flow", "debt_service")
        if name == "leverage_ratio":
            return _ratio(inputs, "debt", "ebitda")
        if name == "current_ratio":
            return _ratio(inputs, "current_assets", "current_liabilities")
        if {"numerator", "denominator"}.issubset(inputs):
            return _ratio(inputs, "numerator", "denominator")

        raise ValueError(f"Unsupported calculation: {name}")


def evaluate_calculation_validation(calculations: Sequence[CalculationCheck]) -> RuleFiring | None:
    if not calculations:
        return None

    mismatches = [check for check in calculations if not check.matches]
    if not mismatches:
        return RuleFiring(
            rule_id="calculation_validation",
            passed=True,
            detail="All calculations matched.",
        )

    detail = "; ".join(
        f"{check.name} expected {check.expected:g} computed {check.computed:g}"
        for check in mismatches
    )
    return RuleFiring(
        rule_id="calculation_validation",
        passed=False,
        detail=f"Calculation mismatch: {detail}.",
    )


def _ratio(inputs: Mapping[str, Any], numerator_key: str, denominator_key: str) -> float:
    numerator = float(inputs[numerator_key])
    denominator = float(inputs[denominator_key])
    if denominator == 0:
        raise ValueError(f"Calculation denominator {denominator_key} cannot be zero.")
    return round(numerator / denominator, 4)

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from core.schemas import (
    ApprovalMatrix,
    ComplianceTrace,
    ContextBundle,
    DeterministicDecision,
    RuleFiring,
    SchemaValidation,
)
from verification.approvals import evaluate_missing_approver, resolve_approval_matrix
from verification.calculations import CalculationChecker, evaluate_calculation_validation
from verification.facts import extract_facts, source_ids
from verification.rulepacks import get_rulepack, rule_is_blocking
from verification.schema_validation import SchemaValidator


class DeterministicVerifier:
    def __init__(
        self,
        calculation_checker: CalculationChecker | None = None,
        schema_validator: SchemaValidator | None = None,
    ) -> None:
        self._calculation_checker = calculation_checker or CalculationChecker()
        self._schema_validator = schema_validator or SchemaValidator()

    def verify(self, bundle: ContextBundle, rulepack_id: str) -> DeterministicDecision:
        rulepack = get_rulepack(rulepack_id)
        facts = extract_facts(bundle)
        firings: list[RuleFiring] = []

        approvals = _evaluate_approvals(facts, firings)
        firings.extend(_evaluate_approval_threshold(facts))

        calculations = self._calculation_checker.check_many(_calculation_specs(facts))
        calculation_firing = evaluate_calculation_validation(calculations)
        if calculation_firing is not None:
            firings.append(calculation_firing)

        required_document_firing = _evaluate_required_documents(bundle, facts)
        if required_document_firing is not None:
            firings.append(required_document_firing)

        permission_firing = _evaluate_permission_gate(bundle, facts)
        if permission_firing is not None:
            firings.append(permission_firing)

        schema_validation = self._evaluate_schema_validation(facts, firings)

        stale_firing = _evaluate_stale_document(facts)
        if stale_firing is not None:
            firings.append(stale_firing)

        approval_ready = not any(
            not firing.passed and rule_is_blocking(rulepack, firing.rule_id) for firing in firings
        )
        return DeterministicDecision(
            approval_ready=approval_ready,
            firings=firings,
            approvals=approvals,
            calculations=calculations,
            schema_validation=schema_validation,
        )

    def verify_with_trace(self, bundle: ContextBundle, rulepack_id: str) -> ComplianceTrace:
        rulepack = get_rulepack(rulepack_id)
        return ComplianceTrace(
            decision=self.verify(bundle, rulepack_id),
            rulepack_id=rulepack.id,
            rulepack_version=rulepack.version,
        )

    def _evaluate_schema_validation(
        self,
        facts: Mapping[str, Any],
        firings: list[RuleFiring],
    ) -> SchemaValidation | None:
        schema_config = facts.get("output_schema")
        if not isinstance(schema_config, Mapping):
            return None

        schema_name = str(schema_config.get("schema_name", "DecisionBrief"))
        payload = schema_config.get("payload", {})
        if not isinstance(payload, Mapping):
            validation = SchemaValidation(
                schema_name=schema_name,
                valid=False,
                errors=["payload: Input should be a mapping"],
            )
        else:
            validation = self._schema_validator.validate(schema_name, payload)

        if validation.valid:
            detail = f"{schema_name} payload validates."
        else:
            detail = f"{schema_name} schema validation failed: {'; '.join(validation.errors)}"
        firings.append(
            RuleFiring(
                rule_id="output_schema_validation",
                passed=validation.valid,
                detail=detail,
            )
        )
        return validation


def verify(bundle: ContextBundle, rulepack_id: str) -> DeterministicDecision:
    return DeterministicVerifier().verify(bundle, rulepack_id)


def verify_with_trace(bundle: ContextBundle, rulepack_id: str) -> ComplianceTrace:
    return DeterministicVerifier().verify_with_trace(bundle, rulepack_id)


def _evaluate_approvals(
    facts: Mapping[str, Any],
    firings: list[RuleFiring],
) -> ApprovalMatrix:
    approvals_config = facts.get("approvals")
    if not isinstance(approvals_config, Mapping):
        return ApprovalMatrix()

    approvals = {str(role): bool(present) for role, present in approvals_config.items()}
    required_roles = _string_sequence(facts.get("required_roles"))
    approval_matrix = resolve_approval_matrix(approvals, required_roles)
    missing_firing = evaluate_missing_approver(
        approval_matrix,
        _string_sequence(facts.get("blocking_required_roles")),
    )
    if missing_firing is not None:
        firings.append(missing_firing)
    return approval_matrix


def _evaluate_approval_threshold(facts: Mapping[str, Any]) -> list[RuleFiring]:
    threshold = facts.get("approval_threshold")
    if not isinstance(threshold, Mapping):
        return []

    requested = float(threshold["requested_discount"])
    authority = float(threshold["delegated_authority"])
    passed = requested <= authority
    detail = (
        "Discount within delegated authority."
        if passed
        else "Discount exceeds delegated authority."
    )
    return [
        RuleFiring(
            rule_id="approval_threshold",
            passed=passed,
            detail=detail,
            threshold={"requested_discount": requested, "delegated_authority": authority},
        )
    ]


def _calculation_specs(facts: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    calculations = facts.get("calculations")
    if not isinstance(calculations, Sequence) or isinstance(calculations, str):
        return []
    return [item for item in calculations if isinstance(item, Mapping)]


def _evaluate_required_documents(
    bundle: ContextBundle,
    facts: Mapping[str, Any],
) -> RuleFiring | None:
    required = facts.get("required_documents")
    if not isinstance(required, Sequence) or isinstance(required, str):
        return None

    present_source_ids = source_ids(bundle)
    missing: list[str] = []
    for item in required:
        if not isinstance(item, Mapping):
            continue
        object_id = str(item["object_id"])
        label = str(item.get("label", object_id))
        present = bool(item.get("present", object_id in present_source_ids))
        if not present:
            missing.append(label)

    if not missing:
        return RuleFiring(
            rule_id="required_document_checklist",
            passed=True,
            detail="Required documents present.",
        )
    return RuleFiring(
        rule_id="required_document_checklist",
        passed=False,
        detail="Missing required documents: " + ", ".join(missing) + ".",
    )


def _evaluate_permission_gate(
    bundle: ContextBundle,
    facts: Mapping[str, Any],
) -> RuleFiring | None:
    permission_gate = facts.get("permission_gate")
    if not isinstance(permission_gate, Mapping):
        return None

    required_ids = set(_string_sequence(permission_gate.get("required_object_ids")) or [])
    excluded_ids = set(bundle.permission_boundary.excluded_object_ids)
    blocked = sorted(required_ids & excluded_ids)

    if not blocked:
        return RuleFiring(
            rule_id="permission_gate",
            passed=True,
            detail="No required sources were permission-restricted.",
        )
    return RuleFiring(
        rule_id="permission_gate",
        passed=False,
        detail=(
            "Required sources are permission-restricted: "
            + ", ".join(blocked)
            + f" ({bundle.permission_boundary.reason})."
        ),
    )


def _evaluate_stale_document(facts: Mapping[str, Any]) -> RuleFiring | None:
    stale_documents = facts.get("stale_documents")
    if not isinstance(stale_documents, Sequence) or isinstance(stale_documents, str):
        return None

    stale = [item for item in stale_documents if isinstance(item, Mapping)]
    if not stale:
        return RuleFiring(
            rule_id="stale_document",
            passed=True,
            detail="No stale source documents.",
        )

    detail = "; ".join(
        f"{item.get('object_id', 'unknown')}: {item.get('reason', 'stale')}" for item in stale
    )
    return RuleFiring(rule_id="stale_document", passed=False, detail=detail)


def _string_sequence(value: Any) -> list[str] | None:
    if not isinstance(value, Sequence) or isinstance(value, str):
        return None
    return [str(item) for item in value]

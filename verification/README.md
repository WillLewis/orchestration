# verification/ — WS-C (Codex)
Deterministic layer: RulePack engine, PolicyGraph, ApprovalMatrix, CalculationChecker,
SchemaValidator, ComplianceTrace. Pure functions over typed inputs — no LLM calls.
Implements `core.pipeline.Verifier`. DoD: `verify(bundle, rulepack_id)` -> `DeterministicDecision`;
calculation + threshold + missing-approver + permission + schema rules covered by tests.

## Status
Implemented for `finance_credit_v1`:
- `DeterministicVerifier.verify(bundle, rulepack_id)` satisfies `core.pipeline.Verifier`.
- RulePack engine returns locked `DeterministicDecision` objects with rule firings, approval matrix,
  calculation checks, schema validation, and final `approval_ready` gate.
- Finance hero rules cover `missing_approver`, `approval_threshold`,
  `calculation_validation`, `required_document_checklist`, `permission_gate`,
  `output_schema_validation`, and `stale_document`.
- `verify(fixtures.acme.acme_bundle(), "finance_credit_v1")` reproduces
  `fixtures.acme.acme_expected_decision()` exactly: not approval-ready, Credit Officer absent,
  missing-approver and threshold gates failed.
- `verify_with_trace()` wraps the decision in `ComplianceTrace` with rulepack id/version.

Structured verification facts can be carried in `ContextBundle.sources[*].span` as JSON:

```json
{"verification": {"approval_threshold": {"requested_discount": 0.175, "delegated_authority": 0.1}}}
```

## How to run
```bash
python -m pytest verification/tests -q
make test
make lint
```

# verification/ — WS-C (Codex)
Deterministic layer: RulePack engine, PolicyGraph, ApprovalMatrix, CalculationChecker,
SchemaValidator, ComplianceTrace. Pure functions over typed inputs — no LLM calls.
Implements `core.pipeline.Verifier`. DoD: `verify(bundle, rulepack_id)` -> `DeterministicDecision`;
calculation + threshold + missing-approver + permission + schema rules covered by tests.

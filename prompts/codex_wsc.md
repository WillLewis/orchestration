# Codex — starter prompt template (example: WS-C Deterministic Verification)

Use this as the template for any Codex-owned stream (WS-A, WS-C, WS-E engine, WS-F, WS-G
telemetry, WS-I). Swap the branch, directory, Protocol, and DoD. Run only after WS-0 is on `main`.

---

You are the WS-C (Deterministic Verification) owner for the ConnectWork Command Agent prototype.
Read `AGENTS.md`, `WORKSTREAMS.md`, and `verification/README.md` first. Work only on branch
`wsc-verification`, and edit only the `verification/` directory. Do NOT touch `core/`.

**Goal:** implement the deterministic layer that owns every pass/fail decision — the component
that makes the agent trustworthy and is our answer to financial-client churn. Pure functions
over typed inputs; no LLM calls anywhere in this stream.

**Implement** (against the locked `core.schemas` contracts):
- A `RulePack` engine that evaluates a `ContextBundle` and returns a `DeterministicDecision`
  (`firings`, `approvals`, `calculations`, `approval_ready`).
- Rules for the finance hero: approval threshold, missing required approver, calculation
  validation (recompute financial ratios from structured values, flag mismatch), required-document
  checklist, permission gate, output-schema validation, stale-document flag.
- `ApprovalMatrix` resolution against an authority matrix; `CalculationChecker`; `SchemaValidator`;
  a `ComplianceTrace` wrapping the decision with rulepack id/version.
- Implement the `core.pipeline.Verifier` Protocol: `verify(bundle, rulepack_id) -> DeterministicDecision`.

**Acceptance (write these tests first):**
- `verify(fixtures.acme.acme_bundle(), "finance_credit_v1")` reproduces
  `fixtures.acme.acme_expected_decision()`: NOT approval-ready, with `missing_approver` and
  `approval_threshold` firings failing and the Credit Officer approval absent.
- Each rule has an isolated unit test named after its rule id.
- A calculation-mismatch case flags a failing `CalculationCheck`.

**Constraints:** Python 3.11+, Pydantic v2, full type hints, deterministic only. `make test` green
and `make lint` clean before PR. Update `verification/README.md` with status + how to run.

**Done when:** the Verifier Protocol is satisfied, the acme expectation reproduces exactly, every
rule is independently tested, and CI is green. Open a PR `WS-C: deterministic verification`.

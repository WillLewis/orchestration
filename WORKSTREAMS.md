# WORKSTREAMS.md — canonical build plan (LOCKED)

Contract-first parallelization. WS-0 locks `core/schemas.py`, `core/pipeline.py`, and
`fixtures/acme.py`, then merges to `main`. Everything else fans out against those contracts.

## Tiers
- **Tier 0 (sequential, critical path):** WS-0.
- **Tier 1 (parallel after WS-0):** WS-A, WS-B, WS-C, WS-G, WS-H.
- **Tier 2 (parallel, against fixtures):** WS-D, WS-E, WS-F.
- **Tier 3 (integration):** WS-I, then final integration + demo.

## Workstreams
| WS | Branch | Owns | Agent | Depends | Implements | Done when |
|---|---|---|---|---|---|---|
| WS-0 | `ws0-foundation` | `core/` `fixtures/` root | Claude | — | (defines all) | contracts locked, `make test` green, CI up |
| WS-A | `wsa-corpus` | `corpus/` | Codex | WS-0 | `corpus.load(vertical)->list[WorkspaceObject]` | finance corpus + legal/health stubs + ACLs/barriers; tests green |
| WS-B | `wsb-context` | `context/` | Claude | WS-0(+A) | `ContextAssembler` | permission-filtered ContextBundle w/ claims, missing-evidence, conflicts |
| WS-C | `wsc-verification` | `verification/` | Codex | WS-0 | `Verifier` | rule/calc/approval/schema checks; `DeterministicDecision` matches `acme_expected_decision()` |
| WS-D | `wsd-brief` | `brief/` | Claude | WS-0,B,C | `BriefSynthesizer` | valid `DecisionBrief`; never overrides a gate |
| WS-E | `wse-actions` | `actions/` | Codex+Claude | WS-0,C | `ActionComposer`,`Executor` | diffs + dry-run + rollback + audit; loop + personas; mosaic/injection gates |
| WS-F | `wsf-lifecycle` | `lifecycle/` | Codex | WS-0,B | `RevalidationEngine` | source-change flags stale section + reapproval route |
| WS-G | `wsg-evals` | `evals/` `telemetry/` | Claude+Codex | WS-0 | `EvalRunner` | EvalPack runner + replay + privacy telemetry (no raw content) |
| WS-H | `wsh-frontend` | `frontend/` | Claude/Lovable | WS-0 | (UI) | 4 surfaces against `frontend/schemas.json` + mocks |
| WS-I | `wsi-recipes` | `recipes/` | Codex+Claude | WS-0,A,C,D,G | (recipes) | 3 recipes + 3-vertical scorecard passes |

## Agent split
- **Claude:** WS-0, WS-B, WS-D, WS-E(loop+personas), WS-G(harness), WS-H. *Orchestration, ambiguity, design.*
- **Codex:** WS-A, WS-C, WS-E(engine), WS-F, WS-G(telemetry), WS-I(recipes). *Deterministic, test-driven, structured.*

## Cadence
- Daily PRs into `main` behind the contract; keep `make test` green on `main` at all times.
- The ONLY cross-cutting edits are contract changes → must be a WS-0 PR, announced before merge.
- Each WS keeps its own `tests/` and updates its dir `README.md` as the source of truth for status.

## Integration milestones
1. **M1 — Verified context:** WS-0 + A + B + C → grounded, permission-safe, gated context (Phase 0–1).
2. **M2 — Controlled loop:** + D + E → brief → action diffs → approve → execute → audit (Phase 2).
3. **M3 — Platform proof:** + F + G + I → revalidation + three-vertical eval scorecard (Phase 3).
4. **M4 — Demo:** + H → the 4 surfaces wired to the live pipeline; dry-runs.

---

## WS-0 frozen contract — v1 ✅ (LOCKED)

The `core/` contracts below are **frozen** as of the `WS-0: foundation & contracts (locked)` PR.
Any change after this is a `contract:` PR (WS-0 only) and must be announced here before merge.
`make install && make lint && make test && make schemas-json && make run` all pass from a clean
clone; CI (`.github/workflows/ci.yml`) enforces this on every push/PR. JSON Schema for all 50
models exports to `frontend/schemas.json` for WS-H.

### Pipeline stage interfaces (`core/pipeline.py`)
`ContextAssembler` (WS-B) · `Verifier` (WS-C) · `BriefSynthesizer` (WS-D) ·
`ActionComposer` (WS-E) · `Executor` (WS-E) · `RevalidationEngine` (WS-F) · `EvalRunner` (WS-G).
Each is `runtime_checkable` and exercised by a stub in `core/demo.py`.

### Primitive inventory (plan §5/§7 → model in `core.schemas`)
Every primitive in plan §5 (per-feature) and §7 (the 10) maps to a model. Data primitives are
schemas in `core.schemas`; *engine* primitives are owned by their workstream (a Protocol or impl),
with their typed **result** in `core.schemas`:

| Plan primitive | Status | Notes |
|---|---|---|
| WorkspaceObject, ContextBundle, ClaimMap, RulePack, ToolCard, ActionDiff, WorkProductContract, EvalTrace, EvalPack | ✅ existing | the §7 ten (SourceGraph added below) |
| SourceGraph | ➕ added | §7 dependency map; also on `ContextBundle.source_graph` (optional) |
| PermissionBoundary, MissingEvidenceState, ConflictState | ✅ existing | F1 |
| DecisionBriefSchema | ✅ = `DecisionBrief` | model name kept; "Schema" is prose |
| PolicyGraph (+`PolicyNode`) | ➕ added | F2 |
| ApprovalMatrix, DeterministicDecision, RuleFiring, ComplianceTrace | ✅ existing | F2 |
| CalculationChecker | ✅ engine → `CalculationCheck` | checker = WS-C logic; result is the schema |
| SchemaValidator | ✅ engine → `SchemaValidation` | new result model; on `DeterministicDecision.schema_validation` |
| RegressionSuite | ➕ added | F2/F5 |
| ActionPlan, SideEffectClass, AuditEvent, RollbackPlan | ✅ existing | F3 |
| ApprovalPolicy | ➕ added | F3 |
| DryRunExecutor | ✅ engine → `DryRunResult` | dry-run = `Executor` mode; result is the schema |
| SourceDependencyGraph, RevalidationRule, EventTrigger, ReapprovalRoute, ChangeImpactMap | ➕ added | F4 |
| StaleSectionState | ✅ existing | F4 |
| RedactedFailurePacket, PrivacyBudget, FeedbackReasonCode | ➕ added | F5 (privacy-preserving) |
| TenantLocalEvalRunner, AggregateMetricEmitter, SyntheticEvalGenerator | ⚙️ WS-G engines | logic, not core schemas |
| RecipeScorecard (+`VerticalScore`) | ➕ added | §14/§17 three-vertical proof |

### Contract changes made in this PR (note for rebases)
- **Added 15 models** (+3 helpers `SourceEdge`/`PolicyNode`/`VerticalScore`): SourceGraph,
  SourceDependencyGraph, PolicyGraph, SchemaValidation, RegressionSuite, ApprovalPolicy,
  DryRunResult, RevalidationRule, EventTrigger, ReapprovalRoute, ChangeImpactMap,
  RedactedFailurePacket, PrivacyBudget, FeedbackReasonCode, RecipeScorecard.
- **Added fields (backward-compatible, all defaulted):** `ContextBundle.source_graph`,
  `DeterministicDecision.schema_validation`, `ToolCard.max_retries`.
- **`__all__`** now robustly exports only this module's `BaseModel`/`Enum` subclasses
  (deterministic JSON-Schema export; no leaked imports).
- **Tooling:** `make install` fixed (setuptools package discovery in `pyproject.toml`);
  `make schemas-json` → `python -m core.export_schemas`; `make run` → `python -m core.demo`;
  CI added; test suite expanded (`make test` = 76 tests: round-trip every model + inventory
  guard, privacy guards, pipeline-protocol satisfaction, schema export).
- No breaking changes to existing field names/types; `fixtures/acme.py` unchanged.

---

## WS-0 contract addendum — demo-fidelity fields (additive, backward-compatible)

Adds optional/defaulted fields so the prototype UI can show *computed* values instead of assertions.
No field renamed or removed; existing payloads still validate; JSON Schema re-exported.

- **`CalculationCheck`** `+inputs` `+formula` `+tolerance` — recomputation provenance.
- **`RuleFiring`** `+threshold` — typed numbers behind a threshold rule (e.g. the approval-threshold
  firing's requested vs delegated discount).

**Codex hand-off (lanes touched outside `core/`):**
- `verification/` populates the fields (`calculations.py` formula/inputs/tolerance; `engine.py`
  approval-threshold `threshold`). `_acme_fixture_facts()` now also emits a DSCR `calculations` spec,
  and `approval_threshold` is the canonical **22% requested vs 15% delegated authority**.
- `recipes/catalog.py` `EvalRow` gains content-free `input_class`/`expected_signal`/`observed_signal`
  for the Agent Ops failed-row trace (typed signals only — no raw content).
- Golden `fixtures/acme.py::acme_expected_decision()` updated to reproduce the richer decision.

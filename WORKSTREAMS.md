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

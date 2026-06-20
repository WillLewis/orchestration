# evals/ — WS-G eval harness (Claude lane)

**Status: ✅ implemented.** Offline-by-default, privacy-preserving eval loop over the WS-0
stub pipeline. Implements `core.pipeline.EvalRunner` and produces the §14 three-vertical
`RecipeScorecard`. `make test` (132 tests) and `make lint` green; `make eval` runs with **no
network and no API keys**.

## What this is

The eval loop from Feature 5 / §10 of the plan: run `EvalPack`s through the pipeline, score
trust/quality **deterministically and offline**, and emit **privacy-preserving telemetry**
(no raw content). It proves platform generalization by scoring finance, legal, and health on
the *same substrate* and aggregating into one scorecard.

Two hard lines, by construction:
- **The harness MEASURES; it never owns a pass/fail policy decision.** That authority is
  WS-C's `DeterministicDecision`. `deterministic_rule_pass` scores whether WS-C *produced the
  expected decision* — it does not re-implement the gate.
- **No raw content in telemetry.** Events map to typed signals + buckets + counts
  (`latency_bucket`, `cost_bucket`, `source_type_counts`) via the frozen, `extra="forbid"`
  `TelemetryEvent` / `RedactedFailurePacket`. Never prompts/responses/documents/transcripts.

## How to run

```bash
make eval                                   # three-vertical RecipeScorecard (finance/legal/health)
python -m evals.run --pack three_vertical   # same, directly
python -m evals.run --pack finance_hero_v1  # one pack's per-case results
python -m evals.run --pack finance_hero_v1 --emit-telemetry --record runs/finance.json
python -m evals.run --pack three_vertical --json
make test                                   # offline test suite (no keys)
```

Sample `make eval` output:

```
RecipeScorecard — three_vertical  (the same substrate, three verticals)
vertical    det_rule  citation  perm_deny  miss_evid   passed
-------------------------------------------------------------
finance         1.00      1.00       1.00       1.00    5/5
legal           1.00      1.00       1.00       1.00    4/4
health          1.00      1.00       1.00       1.00    4/4
```

## Layout

| File | Role |
|---|---|
| `packs/` | EvalPacks as data: `finance_hero_v1` (5 cases over `fixtures.acme`), thin `legal_thin_v1` + `health_thin_v1` (synthetic, embedded scenarios). |
| `harness.py` | **Instrumentation seam.** `StubHarness` runs cases through the `core.demo` stubs over `fixtures.acme`, or over a per-case embedded scenario. The seam IS the `core.pipeline` Protocols — swap in real WS-B/C/D/E stages later with no scorer changes. |
| `models.py` | `ScoringView` (the single, content-free projection every scorer reads), `CaseRun`, `ScoredCase`, `ReplayRecord`. |
| `scorers.py` | 7 deterministic/heuristic scorers: `citation_correctness`, `claim_support`, `missing_evidence_honesty`, `conflict_detection`, `permission_denial_pass`, `deterministic_rule_pass`, `schema_validity`. `score_view()` is shared by live + replay. |
| `taxonomy.py` | Maps failing scorers → typed `FeedbackReasonCode` (feeds the `RegressionSuite`). |
| `runner.py` | `EvalHarnessRunner` — satisfies `core.pipeline.EvalRunner` (`run(pack_id) -> list[EvalResult]`). |
| `replay.py` | Persist `ReplayRecord`s (JSON) and recompute scores **without re-running the pipeline** — the regression/replay path. |
| `scorecard.py` | Aggregates the three packs into one `RecipeScorecard` (§14). |
| `telemetry_emit.py` | Privacy-safe emitter + `TelemetrySink` seam (Codex's `telemetry/` redaction/DP aggregator drops in behind it). |
| `integrations.py` | Optional Braintrust / W&B export — env-gated, key-checked, no-op offline. |
| `judge.py` | Optional LLM-judge seam (`JUDGE_MODEL` + provider key). Off by default; never runs in tests. |
| `run.py` | CLI (`python -m evals.run`). |
| `tests/` | All offline, no keys. |

## How a case is scored

An `EvalCase.expected` dict declares the dimensions it probes (e.g. `excluded_object_ids`,
`missing_evidence_codes`, `approval_ready` + `failing_rule_ids`, `min_citation_coverage`). A
scorer applies iff its key is present; the case `passed` iff every applicable scorer clears
its threshold. `expected.intent_class` is a **controlled label** (never the prompt) and is the
only intent signal allowed into telemetry.

Finance cases run through the **live WS-0 stub pipeline over `fixtures.acme`** (no embedded
scenario). Thin legal/health cases carry a serialized `ContextBundle` + `DeterministicDecision`
in `expected["scenario"]`; the harness replays them through the same downstream stub stages.
When the real upstream stages land, inject them and delete the embedded scenarios.

## Replay = regression guarantee

Live and replayed runs both score through `scorers.score_view(view, case)`, and `ScoringView`
is content-free, so persisted records reproduce live scores exactly. This is the substrate for
the §5 F2/F5 `RegressionSuite` (accept/edit/reject + scorer failures → reason codes → cases).

## Boundary with `telemetry/` (Codex)

This stream defines the **emitter interface** (`TelemetrySink`) and the privacy-safe mapping.
The hardened deterministic internals — client-side redaction, k-anonymity thresholds,
differential-privacy noise on aggregates — are Codex's lane in `telemetry/`, dropped in behind
`TelemetrySink` (e.g. a `RedactingDPSink`). **Not implemented here by design.**

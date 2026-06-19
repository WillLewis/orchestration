# AGENTS.md — operating guide for Codex

You are working in the **ConnectWork Command Agent** prototype. Read `WORKSTREAMS.md` and the
dir `README.md` for your active branch before writing code.

## Your lanes (Codex-owned)
WS-A `corpus/` · WS-C `verification/` · WS-E (action engine) `actions/` · WS-F `lifecycle/` ·
WS-G (telemetry) `telemetry/` · WS-I (recipes/rulepacks) `recipes/`.
These are the deterministic, test-driven, data-heavy lanes. Claude owns the orchestration/LLM/
design lanes (`context/`, `brief/`, the WS-E loop, `evals/` harness, `frontend/`).

## Non-negotiable rules
1. **Contracts are locked.** Do NOT edit `core/schemas.py` or `core/pipeline.py`. Build against
   them. If you believe a contract must change, leave a note in your PR and in `WORKSTREAMS.md`
   for the WS-0 owner (Claude) to make the change — do not edit `core/` yourself.
2. **Stay in your directory.** One owner per dir (see `WORKSTREAMS.md`).
3. **Build against `fixtures/acme.py`.** For WS-C, your `verify()` on `fixtures.acme.acme_bundle()`
   should reproduce `fixtures.acme.acme_expected_decision()` (not approval-ready: missing Credit
   Officer + threshold breach). For WS-A, keep `corpus.load("finance")` shape-compatible with
   `acme_workspace()`.
4. **Deterministic only in your lanes.** `verification/`, `lifecycle/`, and telemetry logic must be
   pure/deterministic — no LLM calls. These are the components that make the agent trustworthy.
5. **No raw content in telemetry.** `TelemetryEvent` forbids extra fields by construction; never
   add raw prompt/response/document/transcript fields. Redact client-side; aggregate with
   k-anonymity thresholds; add differential-privacy noise to aggregates.
6. **Secrets** from `.env`; never hardcode or commit keys.

## Conventions
- Python 3.11+, Pydantic v2, full type hints, pure functions, exhaustive unit tests.
- Each rule/check is independently testable; name tests after the rule id.
- `make test` green and `make lint` (ruff) clean before PR. Line length 100.
- Implement the relevant `core.pipeline` Protocol so your stage is swappable.

## Definition of Done (per workstream)
Implements its Protocol · unit tests green (incl. the `fixtures.acme` expectations above) ·
exposes a demo fixture · updates its dir `README.md`.

## Useful commands
`make install` · `make test` · `make lint` · `make eval`

# Prompt: WS-L6 Privacy-Safe Observability

You are working on WS-L6 from `LLM_UPGRADE_WORKSTREAMS.md`.

## First Read

- `AGENTS.md`
- `README.md`
- `LLM_UPGRADE_PLAN.md`
- `LLM_UPGRADE_WORKSTREAMS.md`
- `DEMO_RUNBOOK.md`
- `telemetry/README.md`
- `tests/test_privacy.py`
- `api/docs_chat.py`

## Mission

Add aggregate observability for docs-chat LLM behavior without raw content.

## Scope

- Track aggregate counts for:
  - requested mode
  - effective mode
  - fallback reason
  - response status
  - model configured yes/no
  - citation count buckets
  - guard category counts, if WS-L3 exposes them
- Keep telemetry aggregate-only and privacy-safe.

## Out Of Scope

- No raw prompts.
- No raw responses.
- No raw document text.
- No transcript fields.
- No changes to `TelemetryEvent` that violate existing no-extra-fields constraints.
- Do not edit `core/schemas.py` or `core/pipeline.py`.

## Required Constraints

- `TelemetryEvent` forbids extra fields by construction; do not work around that.
- Redact client-side where applicable.
- Aggregate with k-anonymity thresholds.
- Add differential-privacy noise to aggregates.
- Do not log secrets or raw environment dumps.

## Tasks

1. Inspect the current repo state with `git status --short`.
2. Identify the existing telemetry aggregation pattern.
3. Add docs-chat aggregate counters without raw content fields.
4. Add tests proving raw prompt/response/document/transcript fields are not emitted.
5. Update `telemetry/README.md` with the privacy boundary and how to inspect aggregates.
6. Coordinate with WS-L3 for guard-category names if available.

## Acceptance Criteria

- It is possible to answer "how often did `grounding_guard` fire?" without exposing content.
- Tests prove no raw prompt/response/document fields are emitted.
- README explains privacy boundary.

## Verification

Run:

```bash
python -m pytest tests/test_privacy.py -q
python -m pytest telemetry tests -q
make test
make lint
```

If any command is skipped, explain why in the final handoff.

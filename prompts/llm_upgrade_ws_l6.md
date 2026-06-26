# Prompt: WS-L6 Privacy-Safe Observability

You are working on WS-L6 from `LLM_UPGRADE_WORKSTREAMS.md`.

## First Read

- `AGENTS.md`
- `README.md`
- `api/README.md` if present
- `LLM_UPGRADE_PLAN.md`
- `LLM_UPGRADE_WORKSTREAMS.md`
- Existing telemetry code and tests
- `api/docs_chat.py`

If a referenced file is missing, note it in your final handoff and continue with the available context.

## Mission

Add privacy-safe observability for docs-chat LLM behavior so the team can measure availability,
fallback rates, and demo readiness without recording raw content.

## Scope

- Add or extend telemetry counters, aggregates, or local debug summaries for docs-chat LLM mode.
- Track mode and fallback outcomes without raw text.
- Add tests proving raw prompt, raw response, raw documents, and raw user messages are not emitted.
- Preserve existing telemetry contracts.

## Out Of Scope

- Do not add raw content fields to telemetry.
- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not modify `.env`.
- Do not call a live LLM.
- Do not change retrieval, guard, prompt, or frontend behavior except for minimal instrumentation hooks.

## Allowed Telemetry Shape

Use aggregate or categorical fields only, such as:

- Surface name
- Requested mode
- Effective mode
- Fallback reason
- Model configured yes/no
- Provider family if already non-sensitive
- Latency bucket
- Citation count
- Status category

Do not include raw prompt, raw response, raw retrieved documents, raw user question, secrets, or
per-user trace content.

## Acceptance Criteria

- Telemetry can answer how often LLM mode is requested, accepted, and falls back by reason.
- Telemetry can count no-results outcomes.
- Tests fail if raw content fields are added.
- Existing telemetry tests remain green.
- Documentation explains what is and is not captured.

## Suggested Verification

Inspect available commands first, then run focused telemetry/docs-chat tests, for example:

```bash
python -m pytest api/tests/test_docs_chat*.py -q
make lint
```

Adjust commands to match the repo layout and report exactly what was run.

## Handoff

Include metrics added, privacy guarantees tested, summaries enabled, and remaining observability
blind spots.

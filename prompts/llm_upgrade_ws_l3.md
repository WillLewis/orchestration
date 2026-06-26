# Prompt: WS-L3 Grounding Guard And Fallback Diagnostics

You are working on WS-L3 from `LLM_UPGRADE_WORKSTREAMS.md`.

## First Read

- `AGENTS.md`
- `README.md`
- `api/README.md` if present
- `LLM_UPGRADE_PLAN.md`
- `LLM_UPGRADE_WORKSTREAMS.md`
- `api/docs_chat.py`
- Existing docs-chat tests under `api/tests/`

If a referenced file is missing, note it in your final handoff and continue with the available context.

## Mission

Make grounding guard behavior explainable, testable, and appropriately strict. The guard should
block real drift while allowing safe grounded paraphrase.

## Scope

- Refactor or extend grounding guard internals inside docs-chat code.
- Add structured, local-only fallback diagnostics such as category, reason code, or summary metadata.
- Add tests for accepted paraphrases, rejected drift, citation mismatches, missing required facts, and no-results behavior.
- Preserve deterministic governed fields on every fallback path.

## Out Of Scope

- Do not log raw prompt, raw model response, raw documents, or raw rejected drafts to normal telemetry.
- Do not add external services.
- Do not call a live LLM.
- Do not modify `.env`.
- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not make the guard permissive just to improve demo phrasing.

## Required Behavior

- If model prose drifts from grounded facts, fallback to deterministic prose.
- If fallback reason is `grounding_guard`, governed fields must match the deterministic twin.
- If model prose is a safe paraphrase over the same facts, it should be accepted.
- `client_error` and `not_configured` must remain distinguishable from `grounding_guard`.

## Acceptance Criteria

- Tests show at least one safe paraphrase accepted.
- Tests show at least one factual drift rejected.
- Tests show citation or order drift rejected or normalized safely.
- Tests show no-results questions do not invite hallucinated answers.
- Fallback diagnostics are useful for demo debugging without exposing raw content.

## Suggested Verification

Inspect available commands first, then run:

```bash
python -m pytest api/tests/test_docs_chat*.py -q
make lint
```

Coordinate with WS-L2 and WS-L4 because this work likely touches `api/docs_chat.py`.

## Handoff

Include guard changes, diagnostics added, accepted versus rejected fake LLM examples, and any known
overblocking risk for live demo questions.

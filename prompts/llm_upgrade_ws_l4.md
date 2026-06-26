# Prompt: WS-L4 Prompt And Runtime Reliability

You are working on WS-L4 from `LLM_UPGRADE_WORKSTREAMS.md`.

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

Improve the LLM prompt and runtime failure handling so accepted live prose is useful, grounded, and
demo-safe.

## Scope

- Tune the docs-chat LLM prompt so the model writes concise grounded prose while preserving deterministic governed fields.
- Improve timeout, retry, error classification, and redacted diagnostics around the LLM client.
- Add fake-client tests for prompt assembly and failure handling.
- Keep live-mode behavior honest: unavailable means `not_configured`; provider failure means `client_error`.

## Out Of Scope

- Do not run a live LLM smoke test unless the user gives explicit approval in this thread.
- Do not hardcode API keys, model names, or provider-specific secrets.
- Do not modify `.env`.
- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not change retrieval ranking except by coordinating with WS-L2.
- Do not weaken WS-L3 guard semantics.

## Required Behavior

- `.phrasing.effective_mode` tells the truth.
- `.phrasing.llm_available` tells the truth.
- `.phrasing.model` is present when configured and safe to display.
- `.phrasing.fallback_reason` distinguishes `not_configured`, `client_error`, and `grounding_guard`.
- Provider errors never mutate governed fields.

## Acceptance Criteria

- Fake-client tests cover successful LLM prose, timeout/error fallback, and prompt content boundaries.
- Prompt includes grounded context and states that governed fields are not model-controlled.
- Runtime diagnostics are compact and redacted.
- No raw API keys, raw env dumps, or verbose provider logs are printed.

## Suggested Verification

Inspect available commands first, then run:

```bash
python -m pytest api/tests/test_docs_chat*.py -q
make lint
```

Only with explicit user approval, run the live LLM smoke checks described in `LLM_UPGRADE_PLAN.md`.

## Handoff

Include prompt/runtime changes, failure modes covered by tests, whether live smoke was run, and if
not, state that explicitly.

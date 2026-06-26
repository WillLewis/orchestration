# Prompt: WS-L4 Prompt And Runtime Reliability

You are working on WS-L4 from `LLM_UPGRADE_WORKSTREAMS.md`.

## First Read

- `AGENTS.md`
- `README.md`
- `LLM_UPGRADE_PLAN.md`
- `LLM_UPGRADE_WORKSTREAMS.md`
- `DEMO_RUNBOOK.md`
- `api/docs_chat.py`
- `api/tests/test_docs_chat.py`

## Mission

Make the live LLM draft more likely to pass the guard and make model failures deterministic and
boring.

## Scope

- Tune prompt instructions for concise, source-close prose.
- Ensure prompt tells the model not to invent examples, identifiers, numbers, citations, hidden
  scoring details, or retrieval internals.
- Add timeout and one safe retry for transient provider failures if appropriate.
- Preserve deterministic fallback on client errors.
- Use fake clients/tests for runtime behavior.

## Out Of Scope

- No model-generated citations.
- No model-generated confidence.
- No model-generated missing fields.
- No hardcoded provider secrets.
- No live smoke without explicit approval.
- Do not edit `core/schemas.py` or `core/pipeline.py`.

## Required Constraints

- The prompt may request prose only.
- ACL-safe context is the only content sent to the model.
- Raw locked bodies and raw sealed spans must never enter the model view.
- No model output may become an authority for governed fields.

## Tasks

1. Inspect the current repo state with `git status --short`.
2. Review existing prompt and fake-client tests.
3. Tighten prompt/runtime behavior with minimal changes.
4. Add tests for timeout/error/retry behavior if implementation changes.
5. Update demo docs only if user-visible fallback behavior changes.

## Acceptance Criteria

- Fake Anthropic/client tests cover timeout/error/retry behavior.
- `client_error` fallback preserves governed fields.
- Prompt tests verify model receives prose-only instructions and ACL-safe context.
- Live smoke remains gated by explicit approval.

## Verification

Run:

```bash
python -m pytest api/tests/test_docs_chat.py -q
python -m pytest api/tests/test_docs_chat*.py -q
make test
make lint
```

Do not run live LLM smoke without explicit user approval.

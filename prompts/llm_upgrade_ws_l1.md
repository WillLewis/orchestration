# Prompt: WS-L1 Docs-Chat Evaluation Harness

You are working on WS-L1 from `LLM_UPGRADE_WORKSTREAMS.md`.

## First Read

- `AGENTS.md`
- `README.md`
- `api/README.md` if present
- `LLM_UPGRADE_PLAN.md`
- `LLM_UPGRADE_WORKSTREAMS.md`
- Existing docs-chat tests under `api/tests/`
- `api/docs_chat.py`

If a referenced file is missing, note it in your final handoff and continue with the available context.

## Mission

Build the deterministic evaluation harness that lets other workstreams improve LLM behavior safely.
This workstream should make expected behavior explicit before retrieval, guard, prompt, or frontend
work is merged.

## Scope

- Add or extend docs-chat tests in `api/tests/`.
- Cover deterministic mode, LLM-mode fallback with fake clients, governed-field invariants, and demo question expectations.
- Prefer offline tests with fake/stub LLM clients.
- Create reusable test helpers only if they reduce duplication across docs-chat tests.

## Out Of Scope

- Do not call a live LLM.
- Do not require real API keys.
- Do not modify `.env`.
- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not implement retrieval or prompt-quality changes beyond what is needed to express current behavior in tests.

## Required Test Questions

Use these exact questions:

1. `When does the agent refuse to act?`
2. `What happens after a record is sealed?`
3. `How does the agent handle restricted source material?`
4. `What is the cafeteria menu for next Tuesday?`

## Required Invariants

For deterministic and LLM-mode responses, these governed fields must stay byte-identical when sorted:

- `status`
- `citations`
- `confidence`
- `missing`

When fake LLM prose is accepted, prose may differ. When guard fallback occurs, governed fields must
still match the deterministic twin.

## Acceptance Criteria

- Tests prove live-mode phrasing cannot mutate governed fields.
- Tests cover `not_configured`, `client_error`, and `grounding_guard` fallback paths with fake clients.
- Tests cover the four required demo questions.
- Test output makes it obvious which question or invariant failed.

## Suggested Verification

Inspect available commands first, then run focused checks such as:

```bash
python -m pytest api/tests/test_docs_chat*.py -q
make lint
```

If a command is unavailable or too broad, report exactly what you ran and what remains unverified.

## Handoff

Include files changed, new test cases, which demo questions are covered, and any behavior still
needing WS-L2, WS-L3, or WS-L4.

# Prompt: WS-L1 Docs-Chat Eval Harness

You are working on WS-L1 from `LLM_UPGRADE_WORKSTREAMS.md`.

## First Read

- `AGENTS.md`
- `README.md`
- `LLM_UPGRADE_PLAN.md`
- `LLM_UPGRADE_WORKSTREAMS.md`
- `DEMO_RUNBOOK.md`
- `api/tests/test_docs_chat.py`
- `api/docs_chat.py`

## Mission

Create offline, deterministic eval coverage for `/docs/chat` so retrieval and guard behavior can be
tuned safely.

## Scope

- Add eval cases for:
  - refusal / fail-closed
  - sealed records
  - restricted source handling
  - policy gate / `blocks_commit`
  - private-first permissions
  - RAG / ContextBundle
  - no-results
- Check expected `status`, citation doc ids, access classes, and governed-field stability.
- Use fake clients only; no live provider calls.

## Out Of Scope

- No live LLM calls.
- No frontend changes.
- No production telemetry.
- Do not edit `core/schemas.py` or `core/pipeline.py`.

## Required Constraints

- Keep governed fields deterministic: `status`, `citations`, `confidence`, and `missing`.
- Do not hardcode secrets or model names.
- Do not commit `.env` changes.
- No model output may become an authority for governed fields.

## Tasks

1. Inspect the current repo state with `git status --short`.
2. Add a focused offline eval test file, preferably `api/tests/test_docs_chat_eval.py`.
3. Cover the demo questions from `DEMO_RUNBOOK.md`.
4. Prove no-results remains citation-free.
5. Prove governed fields stay stable between deterministic and fake LLM-mode clients.
6. Update relevant docs only if observed behavior changes.

## Acceptance Criteria

- Eval fails when generic `vision` chunks outrank expected governance docs for key questions.
- Eval fails when no-results questions return citations.
- Eval proves governed fields are stable under fake LLM clients.
- `python -m pytest api/tests/test_docs_chat*.py -q` passes.

## Verification

Run:

```bash
python -m pytest api/tests/test_docs_chat*.py -q
make test
make lint
```

If `make test` or `make lint` is skipped, explain why in the final handoff.

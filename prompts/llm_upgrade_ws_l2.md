# Prompt: WS-L2 Retrieval Quality

You are working on WS-L2 from `LLM_UPGRADE_WORKSTREAMS.md`.

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

Improve deterministic docs-chat retrieval so the LLM receives the right grounded context for
demo-critical questions. The goal is better source selection before model phrasing happens.

## Scope

- Improve retrieval, query normalization, aliases, synonyms, section matching, or reranking inside the docs-chat path.
- Add or update tests for retrieval behavior.
- Ensure the four demo questions route to the intended grounded material.
- Keep no-results behavior honest for unrelated questions.

## Out Of Scope

- Do not add embeddings, vector databases, external search services, or network dependencies.
- Do not call a live LLM.
- Do not modify `.env`.
- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not change frontend UI.
- Do not weaken the grounding guard just to let prose through.

## Demo Questions

1. `When does the agent refuse to act?`
2. `What happens after a record is sealed?`
3. `How does the agent handle restricted source material?`
4. `What is the cafeteria menu for next Tuesday?`

The fourth question should remain unrelated/no-results and should not accidentally match docs content.

## Acceptance Criteria

- Retrieval produces stable, deterministic results.
- Citations are deterministic and ordered.
- `status`, `citations`, `confidence`, and `missing` remain governed by deterministic code.
- The first three questions retrieve relevant source material.
- The unrelated cafeteria question returns honest no-results behavior.
- Existing docs-chat tests remain green.

## Suggested Verification

Inspect available commands first, then run:

```bash
python -m pytest api/tests/test_docs_chat*.py -q
make lint
```

If WS-L1 tests are not present yet, add focused retrieval tests in the existing style and note that
WS-L1 should absorb or extend them later.

## Handoff

Include retrieval changes, which question each change helps, remaining weak matches, and whether
your branch touches `api/docs_chat.py` since WS-L3 and WS-L4 may conflict there.

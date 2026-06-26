# Prompt: WS-L2 Retrieval Quality

You are working on WS-L2 from `LLM_UPGRADE_WORKSTREAMS.md`.

## First Read

- `AGENTS.md`
- `README.md`
- `LLM_UPGRADE_PLAN.md`
- `LLM_UPGRADE_WORKSTREAMS.md`
- `DEMO_RUNBOOK.md`
- `api/docs_chat.py`
- `api/tests/test_docs_chat.py`

## Mission

Improve deterministic retrieval so natural governance questions retrieve the right docs before the
LLM drafts prose.

## Scope

- Refine lexical scoring and aliases in `api/docs_chat.py`.
- Add domain aliases for:
  - refusal / refuse to act
  - fail closed
  - blocked action
  - sealed record
  - permission boundary
  - restricted source
  - missing evidence
  - stale record / revalidation
- Down-weight generic terms that over-select broad docs.
- Keep unrelated questions below the relevance threshold.

## Out Of Scope

- No embeddings.
- No external reranking services.
- No LLM query rewriting.
- No schema changes.
- Do not edit `core/schemas.py` or `core/pipeline.py`.

## Required Constraints

- Retrieval determines citations; model prose must not.
- Keep governed fields deterministic: `status`, `citations`, `confidence`, and `missing`.
- Do not loosen locked or sealed protections to improve retrieval.

## Tasks

1. Inspect the current repo state with `git status --short`.
2. Add or refine retrieval tests for refusal, sealed records, restricted sources, and no-results.
3. Update deterministic scoring/aliases with narrowly scoped changes.
4. Coordinate with WS-L3 if changing shared guard/retrieval helpers in `api/docs_chat.py`.
5. Update docs only if demo-safe behavior changes.

## Acceptance Criteria

- Refusal queries retrieve policy/gating/action support, not only `vision`.
- Sealed-record queries retrieve sealed-record support.
- Restricted-source queries retrieve permission/restricted-source support.
- Unrelated/no-results queries remain `no_results`.
- Existing sealed/locked permission tests still pass.

## Verification

Run:

```bash
python -m pytest api/tests/test_docs_chat.py -q
python -m pytest api/tests/test_docs_chat*.py -q
make test
make lint
```

If any command is skipped, explain why in the final handoff.

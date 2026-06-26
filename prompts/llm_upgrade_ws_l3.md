# Prompt: WS-L3 Grounding Guard And Debuggability

You are working on WS-L3 from `LLM_UPGRADE_WORKSTREAMS.md`.

## First Read

- `AGENTS.md`
- `README.md`
- `LLM_UPGRADE_PLAN.md`
- `LLM_UPGRADE_WORKSTREAMS.md`
- `DEMO_RUNBOOK.md`
- `api/docs_chat.py`
- `api/tests/test_docs_chat.py`

## Mission

Reduce false `grounding_guard` fallbacks while keeping hard safety behavior intact and making
rejected drafts diagnosable without exposing raw content.

## Scope

- Refine `grounding_guard` support checks.
- Preserve hard rejects for raw locked/sealed content and forbidden control claims.
- Add local-only structured guard categories.
- Add fake-client tests for safe paraphrases and hostile drift.

Target categories:

- `forbidden_control_claim`
- `raw_locked_marker`
- `raw_sealed_marker`
- `unsupported_number`
- `unsupported_identifier`
- `low_source_overlap`
- `empty_draft`

## Out Of Scope

- No raw rejected drafts in normal API responses.
- No raw rejected drafts in default logs.
- No public response schema change unless WS-L0 explicitly coordinates it.
- Do not edit `core/schemas.py` or `core/pipeline.py`.

## Required Constraints

- Public API may continue to expose only `fallback_reason`.
- Guard diagnostics must not leak raw prompts, raw model responses, raw documents, transcripts, or
  restricted content.
- No model output may become an authority for governed fields.

## Tasks

1. Inspect the current repo state with `git status --short`.
2. Add focused tests for safe paraphrases and hostile drift.
3. Add structured guard-category logic that can be tested without exposing raw content.
4. Preserve hard rejects for raw locked/sealed markers and forbidden control claims.
5. Coordinate with WS-L2 if changing retrieval-dependent support thresholds.
6. Update docs only if demo readiness changes.

## Acceptance Criteria

- Hostile raw sealed/locked drafts still fall back.
- Unsupported outside claims still fall back.
- Safe paraphrases pass when source support is adequate.
- Debug category logic explains rejection causes without exposing raw content by default.

## Verification

Run:

```bash
python -m pytest api/tests/test_docs_chat.py -q
python -m pytest api/tests/test_docs_chat*.py -q
make test
make lint
```

Do not run live LLM smoke without explicit user approval.

# Prompt: WS-L5 Frontend Demo Controls

You are working on WS-L5 from `LLM_UPGRADE_WORKSTREAMS.md`.

## First Read

- `AGENTS.md`
- `README.md`
- `LLM_UPGRADE_PLAN.md`
- `LLM_UPGRADE_WORKSTREAMS.md`
- `DEMO_RUNBOOK.md`
- `frontend/README.md`
- `frontend/src/components/docs/DocsChatInset/DocsChatInset.tsx`
- `frontend/tests/docs-chat-inset.test.tsx`

## Mission

Make the existing frontend LLM/deterministic toggle obvious and demo-safe.

## Scope

- Verify `/developers/ui-chat`, `/developers/ui-meetings`, and `/developers/ui-decision-brief`.
- Improve labels/tooltips only if needed.
- Ensure fallback states are clear:
  - LLM phrasing
  - deterministic
  - grounding fallback
  - LLM not configured
  - backend unreachable
- Keep `DEMO_RUNBOOK.md` aligned.

## Out Of Scope

- No backend logic.
- No changes to main interview mock flow unless explicitly coordinated.
- Do not edit `core/schemas.py` or `core/pipeline.py`.

## Required Constraints

- UI must distinguish requested mode from effective mode.
- UI must not imply the model controls governed fields.
- Do not expose raw locked or raw sealed content in snippets, panels, logs, or mocks.

## Tasks

1. Inspect the current repo state with `git status --short`.
2. Review current docs-chat mocks, labels, and tests.
3. Make narrowly scoped UI/test changes only if fallback states are unclear.
4. Browser-check the three docs-chat surfaces when possible.
5. Update `DEMO_RUNBOOK.md` if demo behavior changes.

## Acceptance Criteria

- Restricted-source question visibly toggles between deterministic and LLM prose when backend is
  configured.
- Refusal/sealed-record fallback is labeled as safety fallback, not a broken toggle.
- Offline fallback is explicit.
- Frontend tests cover button labels and fallback-state copy.

## Verification

Run the relevant frontend test command from `frontend/README.md`, then:

```bash
make test
make lint
```

If local browser verification or broader checks are skipped, explain why in the final handoff.

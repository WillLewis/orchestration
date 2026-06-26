# Prompt: WS-L0 Coordination And Demo Readiness

You are working on WS-L0 from `LLM_UPGRADE_WORKSTREAMS.md`.

## First Read

- `AGENTS.md`
- `README.md`
- `LLM_UPGRADE_PLAN.md`
- `LLM_UPGRADE_WORKSTREAMS.md`
- `DEMO_RUNBOOK.md`

If a referenced file is missing, note it in your final handoff and continue with the available context.

## Mission

Coordinate the LLM upgrade effort. Keep the plan, workstream boundaries, demo runbook, and final
integration checklist current as other threads finish work.

## Scope

- Own planning and coordination docs:
  - `LLM_UPGRADE_PLAN.md`
  - `LLM_UPGRADE_WORKSTREAMS.md`
  - `DEMO_RUNBOOK.md`
  - `prompts/llm_upgrade_ws_l*.md`
- Track which demo questions are safe for live presentation.
- Track known failures, smoke-test outcomes, and unresolved cross-workstream dependencies.

## Out Of Scope

- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not implement retrieval, guard, prompt/runtime, telemetry, or frontend changes unless the user redirects this thread.
- Do not run live LLM smoke tests unless the user gives explicit approval in this thread.

## Required Constraints

- Do not commit secrets or modify `.env`.
- Do not print API keys or raw env dumps.
- Keep governed fields deterministic: `status`, `citations`, `confidence`, and `missing`.
- No model output may become an authority for governed fields.

## Tasks

1. Inspect the current repo state with `git status --short`.
2. Read the docs listed above.
3. Update coordination docs only when a workstream completion or user request changes the plan.
4. Maintain demo readiness for the refusal, sealed-record, restricted-source, unrelated/no-results, toggle, and unavailable-path cases.
5. Keep the integration order current.

## Acceptance Criteria

- The plan and workstreams docs are internally consistent.
- Every workstream has a clear owner, scope, out-of-scope list, acceptance criteria, and verification guidance.
- Demo readiness distinguishes safe for stage, works but not preferred, blocked, and needs live approval.
- Final handoff lists what changed and what still needs implementation by other workstreams.

## Verification

For docs-only changes, run:

```bash
git diff --check
```

Do not run networked smoke tests without explicit user approval.

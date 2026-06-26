# Prompt: WS-L5 Frontend Demo Controls

You are working on WS-L5 from `LLM_UPGRADE_WORKSTREAMS.md`.

## First Read

- `AGENTS.md`
- `README.md`
- `frontend/README.md` if present
- `LLM_UPGRADE_PLAN.md`
- `LLM_UPGRADE_WORKSTREAMS.md`
- `DEMO_RUNBOOK.md`
- `frontend/src/components/docs/DocsChatInset/DocsChatInset.tsx`
- Existing frontend tests related to docs chat

If a referenced file is missing, note it in your final handoff and continue with the available context.

## Mission

Make the live/off LLM toggle and fallback state clear enough for a stage demo without changing
backend authority or the main demo narrative.

## Scope

- Improve docs-chat frontend controls and status labels.
- Ensure deterministic versus LLM mode is obvious to the presenter.
- Surface backend phrasing metadata in a concise, non-alarming way.
- Add or update frontend tests where the repo already has a matching test pattern.
- Update `DEMO_RUNBOOK.md` with presenter instructions if UI behavior changes.

## Out Of Scope

- Do not edit backend contracts unless the user redirects this thread.
- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not change retrieval, guard, prompt, or telemetry behavior.
- Do not add marketing-style UI or a new landing page.
- Do not print raw prompts, raw LLM responses, raw documents, or secrets in the UI.

## Required UI States

The presenter should be able to distinguish:

- Deterministic mode selected.
- LLM mode selected and accepted.
- LLM mode requested but `not_configured`.
- LLM mode requested but `client_error`.
- LLM mode requested but `grounding_guard` fallback.

## Acceptance Criteria

- The live/off toggle is visible and understandable in the docs-chat demo surfaces.
- Fallback state is visible without disrupting the main workflow.
- Labels are accurate and driven by backend response metadata.
- The UI does not imply the LLM controls governed fields.
- Tests or manual verification cover the required UI states.

## Suggested Verification

Inspect `frontend/package.json` and available scripts first. Then run the narrowest useful checks,
for example:

```bash
npm run build
```

If there are focused frontend tests for docs chat, run those too and report the exact command.

## Handoff

Include UI files changed, how to toggle live/off, fallback states tested, and any backend response
shape assumption you relied on.

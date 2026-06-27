# Workstream A prompt - Product narrative and walkthrough

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Update the Action Lifecycle demo narrative and walkthrough copy so the Acme flow has one clear
causal story:

- home screen = Dana's screen-shared credit memo draft
- Decision Brief stages remediations
- Agent Actions executes validated diffs
- customer success plan conflict appears only after Credit Officer approval returns
- Credit Officer response is a visible simulated counterparty beat, not a hidden timer

## Required context

Read before writing:

- `AGENTS.md`
- `README.md`
- `docs/ACTION_LIFECYCLE.md`
- `docs/ACTION_LIFECYCLE_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/ACTION_LIFECYCLE_ASYNC_WORKSTREAMS.md`
- `demo-walkthrough.html`

`WORKSTREAMS.md` may be absent on this branch. If absent, use
`docs/ACTION_LIFECYCLE_ASYNC_WORKSTREAMS.md` as the boundary source.

## Scope

In scope:

- `demo-walkthrough.html`
- Action Lifecycle docs if you find a narrative inconsistency

Out of scope:

- frontend implementation
- backend/action composition
- lifecycle engine implementation
- `core/schemas.py`
- `core/pipeline.py`

## Tasks

1. Make the walkthrough describe the center screen as Dana's credit memo draft.
2. Remove or rewrite any copy that implies the CS-plan conflict appears before CO approval.
3. Remove or rewrite any copy that implies the CO response happens automatically.
4. Ensure the canonical flow is:
   - `@Agent apply the 22% discount`
   - refusal
   - generate/open brief
   - stage CO route
   - execute route
   - visible simulated CO response
   - post-CO revalidation
   - `Changes` / CS-plan reconciliation
5. Keep Legal and covenant tracker unresolved after CO approval.

## Acceptance

- No walkthrough copy says or implies the CS-plan conflict appears before CO approval returns.
- No walkthrough copy says or implies the CO response is automatic.
- A presenter can read the walkthrough while running the target flow without contradiction.
- `rg "can also appear immediately|immediately after the 22%|customer success plan references an 18% discount" demo-walkthrough.html` finds no stale narrative use. If a phrase is present only in a guard/test context, call that out.

## Final response

Report:

- files changed
- stale narrative removed
- canonical beats updated
- checks run
- any implementation dependencies on other workstreams

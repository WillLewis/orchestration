# Workstream D prompt - Simulated counterparty and revalidation state

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Replace the hidden Credit Officer auto-sign timer with a visible simulated counterparty response and
use that response to trigger the post-CO revalidation state.

## Required context

Read before writing:

- `AGENTS.md`
- `README.md`
- `frontend/README.md`
- `docs/ACTION_LIFECYCLE.md`
- `docs/ACTION_LIFECYCLE_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/ACTION_LIFECYCLE_ASYNC_WORKSTREAMS.md`
- frontend revalidation state/store
- Agent Panel / Decision Brief / Agent Actions integration points
- persona/stub counterparty code if live or backend path is touched

Use `rg` to locate `routeToCreditOfficer`, `setTimeout`, `creditOfficerSignsOff`, and
`approval_ready` before editing.

## Scope

In scope:

- CO route pending/approved state
- visible simulated CO response control
- post-CO revalidation state transition
- `approval_ready=false` invariant
- post-CO-only CS-plan conflict trigger

Out of scope:

- row taxonomy styling
- staged card provenance internals
- full backend event dispatcher
- walkthrough copy except parity checking
- `core/schemas.py`
- `core/pipeline.py`

## Tasks

1. Remove or disable hidden CO auto-sign timer in the demo path.
2. Add visible `Simulate Credit Officer response` affordance.
3. Keep CO route pending after execution until that affordance is used.
4. Move CO row to approved only after visible simulation.
5. Trigger post-CO revalidation from that action.
6. Ensure CS-plan conflict appears only after the visible CO response.
7. Keep Legal and covenant tracker unresolved.
8. Keep `approval_ready=false`.

## Acceptance

- CO approval cannot appear without a visible presenter action.
- Executing route does not auto-sign CO.
- Visible CO simulation transitions only the CO gate.
- CS-plan conflict is absent before CO response and present after.
- `approval_ready` remains false after CO response.
- Focused tests cover no hidden timer behavior if the frontend test setup supports it.

## Final response

Report:

- files changed
- hidden timer removed/disabled
- visible response control location
- state transitions
- tests/checks run
- dependencies on Workstream E for badge behavior

# Workstream E prompt - Notifications and cascade review

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Make Agent Actions distinguish staged work from returned changes, then surface the post-CO
customer-success-plan reconciliation as a reviewable change/action.

## Required context

Read before writing:

- `AGENTS.md`
- `README.md`
- `frontend/README.md`
- `docs/ACTION_LIFECYCLE.md`
- `docs/ACTION_LIFECYCLE_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/ACTION_LIFECYCLE_ASYNC_WORKSTREAMS.md`
- Agent Actions drawer state/store
- top-nav Agent Actions badge logic
- cascade/reconciliation action data/rendering

Use `rg` to locate `Next actions`, `Changes`, `cascade_action`, `openDrawer`, and badge state.

## Scope

In scope:

- `Next actions` count for staged remediations
- `Changes` count for returned approvals/dependent-source changes
- cascade/reconciliation review UI
- badge clearing semantics

Out of scope:

- initial home memo copy
- composer validation internals
- hidden CO timer removal except integration with Workstream D
- `core/schemas.py`
- `core/pipeline.py`

## Tasks

1. Count the staged Credit Officer route under `Next actions`.
2. Clear the next-action count when the route is executed.
3. After visible CO response, show `Changes 1` or equivalent returned-change affordance.
4. Show CS-plan 18% vs approved 22% reconciliation only after CO response.
5. Allow accepting the reconciliation.
6. Clear the conflict after acceptance.
7. Do not make the packet approval-ready after reconciliation; Legal and covenant remain unresolved.
8. Ensure per-chip badges clear when the relevant chip is opened, not merely when the drawer opens.

## Acceptance

- Credit Officer route starts as `Next actions 1`.
- Executing the route clears `Next actions`.
- CO response produces `Changes 1`.
- CS-plan reconciliation is not visible before CO response.
- Accepting reconciliation clears the conflict.
- `approval_ready` stays false after reconciliation.

## Final response

Report:

- files changed
- badge/count behavior
- cascade review behavior
- tests/checks run
- dependencies on Workstreams C and D

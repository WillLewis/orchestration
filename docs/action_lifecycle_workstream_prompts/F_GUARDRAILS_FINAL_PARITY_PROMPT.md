# Workstream F prompt - Guardrails and final parity

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Add guardrails and run final parity checks so the Action Lifecycle walkthrough cannot regress into
early conflict reveal, hidden CO approval, drawer/brief drift, or false approval readiness.

## Required context

Read before writing:

- `AGENTS.md`
- `README.md`
- `frontend/README.md`
- `docs/ACTION_LIFECYCLE.md`
- `docs/ACTION_LIFECYCLE_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/ACTION_LIFECYCLE_ASYNC_WORKSTREAMS.md`
- relevant tests already added by Workstreams B-E
- `demo-walkthrough.html`

Use `rg` to locate the frontend test runner and existing content guard patterns.

## Scope

In scope:

- frontend tests
- content guards
- API tests only if Workstream C/D touched live API paths
- final mock/live parity notes

Out of scope:

- product copy decisions
- UI design implementation
- action engine rule changes
- `core/schemas.py`
- `core/pipeline.py`

## Tasks

1. Add or update guards for:
   - initial memo has no early CS-plan conflict
   - initial brief has no CS-plan conflict
   - staged drawer cards require provenance
   - route execution does not auto-sign CO
   - CS-plan conflict appears only after visible CO response
   - `approval_ready` remains false after CO response and reconciliation
2. Add stale-copy searches for:
   - `can also appear immediately`
   - `immediately after the 22%`
   - early user-facing `customer success plan references an 18% discount`
3. Run frontend checks.
4. Run backend checks if API/action code changed.
5. Verify `demo-walkthrough.html` matches the final UI behavior.

## Acceptance

- A reintroduced early CS-plan conflict fails a guard.
- A hidden CO auto-sign path fails a guard.
- A drawer card without row provenance fails a guard.
- A false `approval_ready=true` partial state fails a guard.
- Final walkthrough parity is documented.

## Final response

Report:

- guard/test files changed
- commands run and results
- mock/live parity status
- remaining unguarded assumptions

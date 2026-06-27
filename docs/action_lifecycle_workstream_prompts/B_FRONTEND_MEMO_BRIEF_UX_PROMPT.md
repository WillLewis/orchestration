# Workstream B prompt - Frontend memo and brief UX

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Make the meeting home memo and Decision Brief UX match the Action Lifecycle walkthrough:

- home memo reads as Dana's authored credit memo draft
- initial brief has no CS-plan conflict
- approval, missing artifact, and source conflict rows look distinct
- post-CO state can show the CS-plan conflict as a revalidation result

## Required context

Read before writing:

- `AGENTS.md`
- `README.md`
- `frontend/README.md`
- `docs/ACTION_LIFECYCLE.md`
- `docs/ACTION_LIFECYCLE_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/ACTION_LIFECYCLE_ASYNC_WORKSTREAMS.md`
- current meeting memo component
- current brief preview/full brief components
- current frontend brief/mock data

Use `rg` to locate the exact component/data files before editing.

## Scope

In scope:

- meeting home memo copy/rendering
- brief preview/full brief readiness rendering
- frontend brief/mock data needed for initial and post-CO states

Out of scope:

- backend action composition
- staged drawer card provenance
- hidden CO timer removal
- `core/schemas.py`
- `core/pipeline.py`

## Tasks

1. Clean the home memo:
   - keep request, financials, prior/current DSCR, RM approval, CO outstanding, covenant tracker missing
   - remove `(standard threshold 15%)`
   - remove home-memo Legal approval status
   - remove restricted legal memo mention
   - remove customer success plan conflict
2. Add prior/current DSCR display, for example `1.42x -> 1.28x`.
3. Ensure initial brief state does not render the CS-plan conflict.
4. Add visually distinct readiness row treatments:
   - person approval rows
   - missing artifact rows
   - source conflict rows
5. Ensure the conflict row/treatment is available only for the post-CO state.
6. Keep `approval_ready=false` in all partial states.

## Acceptance

- Home memo reads as an authored credit memo draft, not a system-generated readiness report.
- Initial home memo does not include CS-plan conflict, restricted legal memo, Legal pending, or threshold copy.
- Initial brief does not include CS-plan conflict.
- Post-CO brief can show CS-plan conflict as revalidation.
- Approval, artifact, and conflict rows are visually distinguishable.
- Frontend check agreed by the repo passes, at minimum `cd frontend && bun run build` if no narrower test exists.

## Final response

Report:

- files changed
- initial home memo changes
- row taxonomy treatment
- initial vs post-CO conflict behavior
- checks run
- dependencies on Workstreams C, D, or E

# Final integrator prompt - Beats 7 & 8 parity pass

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Run the final parity pass after Workstreams A-E land. Verify Beats 7 and 8 match across live API,
frontend mock mode, frontend live mode, and `demo-walkthrough.html`.

The target behavior is documented in:

- `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md`

## Required context

Read these files before starting:

- `AGENTS.md`
- `README.md`
- `frontend/README.md`
- `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md`
- changed files from Workstreams A-E

`WORKSTREAMS.md` may be absent on this branch. If it is absent, use
`docs/BEATS_7_8_ASYNC_WORKSTREAMS.md` as the temporary boundary reference.

## Scope

In scope:

- Verification only.
- Small docs/checklist updates if needed.
- Small fixes only if they are clearly within the owning workstream's already-landed changes.

Out of scope:

- Reworking product decisions.
- Changing action engine behavior.
- Editing `core/`.
- Large implementation fixes. Send those back to the relevant workstream.

## Tasks

1. Confirm Workstream A product/cold-open decision is recorded.
2. Run API tests and lint.
3. Run frontend checks agreed by Workstream C.
4. Start backend and frontend in live mode if needed.
5. Verify `/api/actions` baseline:
   - 2 ready
   - 2 route
   - 2 blocked
6. Verify `/api/loop` baseline:
   - 5 assignments
   - 5 replies
   - 3 escalations
   - 3 unresolved
7. Verify frontend mock mode renders the same story.
8. Verify frontend live mode renders the same story.
9. Verify `demo-walkthrough.html` says the same story.
10. Confirm no stale `1 item open` story remains in generated docs or docs corpus.

## Acceptance

- Beat 7: presenter says and UI shows 2 ready / 2 route / 2 blocked.
- Beat 8: presenter says and UI shows 5 replies / 3 escalations / 3 unresolved.
- Mock and live modes agree.
- Deterministic persona text is used for the demo path.
- Cold-open decision is named.
- All relevant checks pass, or failures are assigned back to a specific workstream.

## Final response

Report:

- checks run and results
- mock/live parity result
- walkthrough parity result
- cold-open status
- any blockers assigned back to a workstream

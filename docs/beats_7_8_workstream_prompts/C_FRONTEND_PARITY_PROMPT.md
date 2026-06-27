# Workstream C prompt - Frontend mock/live parity

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Make the frontend mock data and Batch rendering match the live Beats 7 and 8 API baseline.

The target behavior is documented in:

- `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md`

## Required context

Read these files before writing:

- `AGENTS.md`
- `README.md`
- `frontend/README.md`
- `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md`
- `frontend/src/data/actions.ts`
- `frontend/src/data/loop.ts`
- `frontend/src/hooks/queries.ts`
- `frontend/src/routes/loop.tsx`

If Workstream B has landed, also read its API baseline fixture or exact assertions.

`WORKSTREAMS.md` may be absent on this branch. If it is absent, use
`docs/BEATS_7_8_ASYNC_WORKSTREAMS.md` as the temporary boundary reference.

## Canonical baseline

Action mock must match live order:

1. `create_task`
2. ready `draft_internal_note`
3. Credit Officer `route_approval`
4. Legal `route_approval`
5. blocked `schedule_meeting`
6. blocked mosaic `draft_internal_note`

Loop mock/rendering must match live:

- 5 assignments
- 5 replies
- 3 escalations
- escalation targets include `compliance` and `human`
- scheduled reason includes `3 item(s) unresolved`

## Scope

In scope:

- `frontend/src/data/actions.ts`
- `frontend/src/data/loop.ts`
- `frontend/src/hooks/queries.ts`
- `frontend/src/routes/loop.tsx`
- `frontend/src/components/docs/DeveloperDocPage.tsx`, only if it contains stale Beat 8 copy
- generated docs corpus only if docs source is changed and regeneration is required

Out of scope:

- backend plan generation
- `actions/engine.py`
- `core/`
- presenter walkthrough copy, except for verifying parity

## Tasks

1. Update `action_plan` mock to the canonical six-action order.
2. Update `loop_state` mock to the canonical loop dossier.
3. Remove `loop_ui.open_summary`.
4. Add one derived open-status helper and use it wherever the Batch status appears.
5. Derive unresolved count from unique escalation action indices plus blocked action indices.
6. Add persona/rendering support for `human`.
7. Remove hardcoded Legal/Sam L. escalation rendering in `buildEvents()`, `TimelineRow`, and
   `EscalationBody`.
8. Confirm live/mock merge behavior does not hide missing live fields.
9. Remove user-facing stale `1 item open` copy for this flow.

## Acceptance

- Mock mode shows 2 ready / 2 route / 2 blocked on Actions.
- Mock mode shows 5 assignments/replies and 3 escalations on Batch.
- Live mode renders the same owners, decisions, escalation targets, and unresolved count.
- No frontend source still contains user-facing `1 item open` copy for this flow.
- Run the agreed frontend check. If no test runner exists, run at least `bun run build` or explain
  why it could not be run.

## Final response

Report:

- files changed
- derived open-status helper name/location
- mock/live parity result
- frontend check command and result
- any remaining dependency on Workstream B or E

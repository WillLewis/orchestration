# Beats 7 & 8 async workstreams

Use this document to split the walkthrough upgrade into independent threads. Each workstream should
stay inside its file boundaries and hand off only the named artifacts.

Shared target: Beats 7 and 8 must match the deterministic live Acme plan:

- actions: 2 ready / 2 route / 2 blocked
- execution: ready task + ready draft run, two approvals route, two blocked actions skip
- loop: 5 assignments, 5 replies, 3 escalations, 1 scheduled follow-up with 3 unresolved items

## Coordination rules

- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not change `actions/engine.py` to make the demo numbers fit. The gates are the point.
- Use this file as the workstream boundary document for this walkthrough upgrade.
- Keep unrelated dirty files untouched.
- All threads should cite the same baseline from `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`.

## Phase map

1. Phase 0: lock product decision and normalized live baseline.
2. Phase 1: make frontend mocks/rendering match live.
3. Phase 2: update presenter walkthrough and cold-open artifacts.
4. Phase 3: add anti-drift guards.
5. Phase 4: final parity pass in mock and live modes.

## Workstream A - Product and narrative lock

Primary owner: demo/story owner.

Status: Complete as of 2026-06-27.

Decision record:

- Product decision: embrace the live Acme counts.
- Beat 7: 6 actions = 2 ready, 2 approval routes, 2 blocked.
- Beat 8: 5 assignments, 5 replies, 3 escalations, 3 unresolved items.
- Money line: "honest about what is still open."
- Cold-open decision: `HTML-only`.

Cold-open note: the workspace contains the HTML storyboard/source material and no video asset, so
downstream work should update the HTML and regenerate any rendered recording from that source if
needed.

Files in scope:

- `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md`
- notes or PR description only

Out of scope:

- frontend implementation
- gateway behavior
- action engine behavior

Tasks:

1. Confirm the product decision: embrace live counts, remove "1 open" as a named money moment.
2. Approve the new money line: "honest about what is still open."
3. Decide whether the cold open is HTML-generated or a pre-recorded asset that needs re-cutting.
4. Broadcast the canonical baseline to every implementation thread.

Acceptance:

- All workstreams are working toward 2 ready / 2 route / 2 blocked and 3 unresolved loop items.
- No thread is trying to reduce the live dossier back to one open item.

Handoff artifact:

- A short note in the PR or thread confirming the product decision and cold-open handling.

## Workstream B - API baseline and deterministic personas

Primary owner: API / loop integration owner.

Files in scope:

- `api/orchestrator.py`
- `api/tests/test_loop_endpoint.py`
- `.env.example` or demo environment docs, if needed
- optional normalized fixture under `api/tests/fixtures/` or `tests/fixtures/`

Out of scope:

- `core/`
- `actions/engine.py`
- frontend rendering
- presenter HTML

Tasks:

1. Capture normalized `/api/actions` and `/api/loop` outputs under stub personas.
2. Make demo determinism explicit:
   - preferred: `DEMO_DETERMINISTIC=1` forces `StubPersonaClient`
   - otherwise document that `PERSONA_MODEL` must be blank for the walkthrough runtime
3. Tighten API tests from semantic `>=` assertions to exact baseline checks:
   - 6 actions in order
   - 2 ready / 2 route / 2 blocked
   - 5 assignments
   - 5 replies
   - 3 escalations
   - escalation targets include `compliance` and `human`
   - scheduled reason includes `3 item(s) unresolved`
4. Keep determinism checks normalized for timestamps unless an injected clock is added.

Acceptance:

- `python -m pytest api/tests/test_loop_endpoint.py -q` passes.
- Repeated loop calls match after timestamp normalization.
- No LLM-generated persona paragraphs appear in the deterministic demo path.

Handoff artifact:

- Normalized baseline JSON or test assertions that Workstream C can mirror in frontend mocks.

## Workstream C - Frontend mock/live parity

Primary owner: frontend owner.

Files in scope:

- `frontend/src/data/actions.ts`
- `frontend/src/data/loop.ts`
- `frontend/src/hooks/queries.ts`
- `frontend/src/routes/loop.tsx`
- `frontend/src/components/docs/DeveloperDocPage.tsx`, only if stale Batch docs copy lives there
- `api/docs_corpus/generated/pages.json`, only if regenerated from docs source changes

Out of scope:

- backend plan generation
- action engine gates
- presenter walkthrough copy, except to verify text parity

Tasks:

1. Update `action_plan` mock to the live six-action order:
   - `create_task`
   - ready `draft_internal_note`
   - Credit Officer `route_approval`
   - Legal `route_approval`
   - blocked `schedule_meeting`
   - blocked mosaic `draft_internal_note`
2. Update `loop_state` mock to the live dossier:
   - 5 assignments
   - 5 replies
   - 3 escalations
   - scheduled reason with 3 unresolved items
3. Delete `loop_ui.open_summary` and replace it with one derived helper.
4. Derive unresolved count from unique escalation action indices plus blocked action indices.
5. Add persona/rendering support for `human` escalation targets.
6. Remove hardcoded Legal/Sam L. escalation rendering in `buildEvents()`, `TimelineRow`, and
   `EscalationBody`.
7. Confirm shallow live/mock merge does not hide missing live fields.

Acceptance:

- With `VITE_USE_MOCKS=true`, the Batch page shows 5 assignments/replies and 3 escalations.
- With `VITE_USE_MOCKS=false`, the same owners, decisions, escalation targets, and unresolved
  count render.
- No frontend source still contains user-facing `1 item open` copy for this flow.
- Frontend lint/build command agreed by the frontend owner passes.

Handoff artifact:

- Screenshots or notes for mock and live Batch pages showing matching counts and banner copy.

## Workstream D - Presenter walkthrough and cold open

Primary owner: walkthrough / demo owner.

Files in scope:

- `demo-walkthrough.html`
- cold-open recording/storyboard assets, if any

Out of scope:

- gateway and frontend implementation
- generated docs corpus

Tasks:

1. Update Beat 7 script:
   - two safe actions, not three safe drafts
   - two routes
   - two hard-blocked actions
   - server skips both with reasons
2. Update Beat 7 inline JS fixture:
   - action list mirrors canonical six-action order
   - audit rows show two skips and two distinct reasons
3. Update Beat 8 script:
   - 5 replies
   - 3 escalations
   - 3 unresolved items
   - "honest about what is still open"
4. Update Beat 8 inline JS fixture:
   - assignments/replies/escalations/scheduled summary mirror live
5. Update stale references outside the beats:
   - opening money-moment line
   - cold-open shot list
   - storyboard frames at `00:46` and `00:58`
   - deep-dive orchestration answer
6. Re-cut the cold open if it is a pre-recorded video rather than generated from the HTML.

Acceptance:

- `rg "1 item open|the blocked one|Three are safe drafts|executes three" demo-walkthrough.html`
  returns no stale Beat 7/8 copy.
- The walkthrough can be read verbatim against live mode.
- Cold-open decision is recorded as `re-cut`, `HTML-only`, or `N/A`.

Handoff artifact:

- Updated walkthrough file plus a short note listing changed beats and cold-open status.

## Workstream E - Anti-drift guardrail suite

Primary owner: test/quality owner.

Files in scope:

- `api/tests/`
- `tests/`
- optional frontend test files if a runner is defined
- lightweight scripts under `scripts/`, if the repo prefers script-based content guards

Out of scope:

- product copy decisions
- engine behavior changes

Tasks:

1. Add exact API guards for action order/counts/blocked reasons.
2. Add exact loop guards for assignment/reply/escalation/scheduled counts and targets.
3. Add normalized determinism checks for `/api/loop`.
4. Add content guards for stale strings:
   - `1 item open`
   - `the blocked one`
   - `Three are safe drafts`
   - `executes three`
5. Add frontend mock-vs-baseline guards only after Workstream B provides a baseline and Workstream C
   updates mocks.
6. If adding frontend tests, first add or document the runner because `frontend/package.json` has no
   `test` script today.

Acceptance:

- A stale walkthrough or frontend open-count string fails a guard.
- A changed live action count/order fails a guard.
- A changed loop unresolved count fails a guard.
- `make test` and `make lint` pass for Python guard changes.

Handoff artifact:

- Test names and commands posted back to Workstreams B-D.

## Phase 4 - Final parity pass

Primary owner: release/demo integrator.

Inputs:

- Workstream B deterministic API baseline
- Workstream C mock/live screenshots
- Workstream D walkthrough update
- Workstream E guard commands

Tasks:

1. Run backend tests and lint.
2. Run frontend build/lint or the agreed frontend checks.
3. Start backend and frontend in live mode.
4. Compare Beat 7 and Beat 8 live rendering against `demo-walkthrough.html`.
5. Repeat in mock mode.
6. Confirm no generated docs or docs-chat corpus still advertises the stale `1 item open` story.

Acceptance:

- Beat 7: presenter says and UI shows 2 ready / 2 route / 2 blocked.
- Beat 8: presenter says and UI shows 5 replies / 3 escalations / 3 unresolved.
- Both modes use deterministic persona text for the demo path.
- The final PR description names the cold-open decision and any intentionally deferred work.

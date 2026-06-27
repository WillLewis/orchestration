# Beats 7 & 8 walkthrough upgrade plan

Align the Agent Actions and Agent Batch demo beats to the live Acme action plan, then add
anti-drift checks so the presenter script, mocks, and gateway cannot silently diverge again.

## Product decision

Embrace the live behavior.

The deterministic Acme follow-up plan is stronger than the stale script because it shows two
independent refusal modes:

- a missing-evidence gate blocks the final committee meeting
- an information-barrier / mosaic gate blocks a public-plus-private internal note

Beat 8 should stop promising "1 item open" and instead sell the honest orchestration moment:
the cycle closed, but the dossier is explicit about what is still unresolved.

Rejected alternative: collapse the demo back to one open item by neutering the mosaic action. That
would weaken Beat 7, hide an important safety gate, and make Beat 10's MNPI / information-barrier
proof feel disconnected from the hero flow.

## Canonical live baseline

Use this as the reconciliation target for mocks, presenter copy, and tests.

### `/api/actions`

The canonical six-action plan is ordered:

1. `create_task` - ready. Upload final covenant tracker.
2. `draft_internal_note` - ready. Committee pre-read / open risks.
3. `route_approval` - route to `credit_officer`.
4. `route_approval` - route to `legal`.
5. `schedule_meeting` - blocked by `missing_evidence`.
6. `draft_internal_note` - blocked by information-barrier / mosaic.

Presenter-category counts:

- 2 ready actions execute
- 2 approval routes are sent
- 2 hard-blocked actions are skipped

Important wording: Beat 7 should not say "three safe drafts." The two ready actions are one task
and one draft.

### `/actions/execute` with indices `0..5`

The server recomposes and re-gates the plan. Human approval of all six still cannot override gates:

- execute ready task
- execute ready draft
- route Credit Officer approval
- route Legal approval
- skip scheduled meeting, with missing-evidence reason
- skip mosaic internal note, with information-barrier reason

### `/api/loop`

The canonical loop dossier has:

- 5 assignments: analyst x3, credit officer, legal
- 5 replies: analyst x3 acknowledgements, Credit Officer sign-off, Legal escalation
- 3 escalations: Legal -> Compliance, missing-evidence action -> human, mosaic action -> human
- 1 scheduled item whose reason says `3 item(s) unresolved`
- `closed: true`, meaning cycle completed, not fully resolved

Acceptance checks should compare normalized output because audit timestamps are regenerated on each
run. Do not require byte-identical JSON unless the implementation also freezes/injects the audit
clock.

## Phase 0 - Pin the demo contract

1. Confirm the product decision above.
2. Capture normalized `/api/actions` and `/api/loop` baselines under deterministic personas.
3. Keep the engine/composer behavior unchanged. The engine is already correct.
4. Make persona determinism intentional:
   - preferred: add or document a `DEMO_DETERMINISTIC=1` override that forces `StubPersonaClient`
   - acceptable short-term: blank `PERSONA_MODEL` in the demo runtime environment

Notes:

- `.env.example` currently includes `PERSONA_MODEL=gpt-4o-mini`; if a provider key is also present,
  `_persona_client()` can promote to generated replies.
- Stub replies are deterministic but currently role-labeled, for example `Credit Officer: reviewed
  and signed off - proceed.` If the presenter needs names such as `Chris O.`, map that in the UI or
  update seeded persona display names deliberately.

Phase 0 acceptance:

- `/api/actions` returns the exact six actions and blocked reasons above.
- `/api/loop` returns the exact assignment/reply/escalation/scheduled counts above after timestamp
  normalization.
- No edits to `core/schemas.py`, `core/pipeline.py`, `actions/engine.py`, or the deterministic
  Acme proposer are needed.

## Phase 1 - Frontend mock/live parity

Update frontend mock data to mirror the live contract exactly.

Required changes:

- Replace the stale `update_project_status` mock action with the ready `draft_internal_note`.
- Add the blocked mosaic `draft_internal_note` as action 6.
- Preserve live action order: task, ready draft, Credit route, Legal route, meeting block, mosaic block.
- Ensure `derive_status()` still partitions the plan into 2 ready / 2 routed / 2 blocked.
- Regenerate `loop_state` mock from the deterministic `/api/loop` baseline:
  - 5 assignments
  - 5 replies
  - 3 escalations
  - scheduled reason with 3 unresolved items
- Remove the hardcoded `loop_ui.open_summary`.
- Add one derived helper for the open banner and use it everywhere.

The open-banner helper should derive unresolved action indices, not merely display
`state.escalations.length`. Today those happen to match, but the durable rule is:

- escalation action indices
- plus any remaining blocked action indices
- de-duplicated

Frontend rendering caveats:

- The persona map must cover live escalation targets, including `human`.
- `buildEvents()` and `EscalationBody` currently hardcode Legal / Sam L. as the source of every
  escalation. That is wrong once blocked actions escalate to human review. Derive labels per
  escalation or use a neutral `ConnectAgent escalated to Human Review` treatment for engine-refused
  actions.
- `TimelineRow` hover/highlight logic also assumes Legal for escalations; align it with the same
  derived actor.
- Live mode currently shallow-merges `mockLoop` and `live`; confirm no mock-only fields survive in
  a way that masks missing live fields.

Phase 1 acceptance:

- Mock mode and live mode show the same action order, counts, owners, reply decisions, escalation
  count, and scheduled unresolved count.
- The Batch page uses the same derived banner in the main status block and dossier rail.
- No visible `1 item open` copy remains in the frontend unless it is in historical docs unrelated to
  this demo.

## Phase 2 - Walkthrough and presenter copy

Update `demo-walkthrough.html` so the script matches live behavior.

Beat 7 copy should become:

- "Six follow-ups."
- "Two are safe actions: one task and one draft."
- "Two need approvers: Credit Officer and Legal."
- "Two are hard-blocked: one missing-evidence gate and one information-barrier / mosaic gate."
- "Approve all six; the server recomposes the plan, sends the two ready actions, routes two
  approvals, and skips both blocked actions with reasons."

Beat 7 visual state should show two skipped rows in the audit trail:

- schedule final committee decision - missing covenant tracker / unresolved evidence
- draft internal note - information-barrier / mosaic

Beat 8 copy should become:

- five replies, not three
- three escalations, not one
- committee queued behind unresolved prerequisites
- "honest about what is still open" instead of "honest about 1 open item"

Update every stale walkthrough reference:

- opening thesis / money-moment line
- cold-open shot list
- storyboard frame at `00:46`
- storyboard frame at `00:58`
- Beat 7 say block and audit JS fixture
- Beat 8 say block and assignment/escalation JS fixture
- deep-dive answer about real orchestration

Cold-open decision:

- If the 75-second cold open is generated from the HTML storyboard, the HTML edits are enough.
- If the cold open is a pre-recorded Screen Studio video, it must be re-cut or the live demo will
  contradict the recording.

Phase 2 acceptance:

- A presenter can read the walkthrough verbatim while running live mode without contradicting the
  gateway.
- No singular "the blocked one" remains for Beat 7.
- No "1 item open" money moment remains for Beat 8.

## Phase 3 - Anti-drift guards

Add exact guards around the pieces that drifted.

Backend/API guards:

- `/api/actions` exact normalized baseline:
  - six tools in order
  - two ready, two route, two blocked
  - blocked reasons include `missing_evidence` and `mosaic` / `information-barrier`
- `/api/loop` exact normalized baseline:
  - five assignments
  - five replies
  - three escalations
  - escalation targets include `compliance` and `human`
  - scheduled reason includes `3 item(s) unresolved`
- `/api/loop` determinism after timestamp normalization.

Frontend/content guards:

- mock action data equals the `/api/actions` baseline on tool/order/approver/blocked_reason.
- mock loop data equals the `/api/loop` baseline on owners/decisions/escalation targets/scheduled
  reason.
- grep-style guard fails on stale strings:
  - `1 item open`
  - `the blocked one`
  - `Three are safe drafts`
  - `executes three`
- If frontend tests are added, define the runner explicitly; `frontend/package.json` currently has
  no test script.

Docs guard:

- If `DeveloperDocPage` or generated docs corpus contain the stale open-summary copy, update the
  source and regenerate derived corpus files in the same workstream.

Phase 3 acceptance:

- A future change that adds/removes a blocked action turns at least one guard red.
- A future hardcoded open-count string turns at least one guard red.
- `make test` and `make lint` are green for Python lanes; frontend build/lint are green for
  frontend-owned changes.

## Definition of done

- Beat 7 and Beat 8 mocks, live API output, and `demo-walkthrough.html` all tell the same story.
- The hero moment is "approve everything, gates still hold" with two distinct skipped actions.
- The batch moment is "cycle closed, unresolved work explicit" with three escalations and three
  unresolved items.
- Persona replies are deterministic for the demo path.
- Open-item copy is derived once and reused everywhere.
- Anti-drift guards cover action count/order, loop count/targets, and stale presenter strings.
- Cold-open video or storyboard decision is recorded.

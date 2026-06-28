# Action Lifecycle async workstreams

Use this document to split the Action Lifecycle walkthrough upgrade into independent threads.
Each workstream should stay inside its boundaries and hand off only the named artifacts.

Status note: this is a historical workstream split. For the current canonical demo sequence, use
`docs/ACTION_LIFECYCLE_WALKTHROUGH_UPGRADE_PLAN.md` and
`docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md`.

Shared target:

- home memo is a credit memo draft, not the system brief
- Decision Brief stages remediations
- Agent Actions executes validated diffs
- staged drawer cards derive from staged brief-row remediations
- customer success plan conflict appears only after Credit Officer approval returns
- Credit Officer response is visible, not timer-driven
- `approval_ready` stays false until Credit, Legal, covenant tracker, and CS-plan reconciliation all
  clear

Primary references:

- `docs/ACTION_LIFECYCLE.md`
- `docs/ACTION_LIFECYCLE_WALKTHROUGH_UPGRADE_PLAN.md`

## Coordination rules

- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not create independent staged drawer actions.
- Do not show the customer success plan conflict before Credit Officer approval returns.
- Do not summarize restricted legal source contents.
- Do not use hidden timers for counterparty approvals.
- Keep unrelated dirty files untouched.
- Use this file as the workstream boundary document for this walkthrough upgrade.

## Phase map

1. Phase 0: lock walkthrough and causal story.
2. Phase 1: clean home memo and brief row UX.
3. Phase 2: add staged remediation provenance and no-drift drawer behavior.
4. Phase 3: replace hidden CO timer with visible simulated response.
5. Phase 4: wire `Next actions`, `Changes`, and cascade review.
6. Phase 5: add guardrails and complete final parity.

## Workstream A - Product narrative and walkthrough

Primary owner: demo / story owner.

Files in scope:

- `docs/ACTION_LIFECYCLE_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/ACTION_LIFECYCLE_ASYNC_WORKSTREAMS.md`
- `demo-walkthrough.html`

Out of scope:

- frontend implementation
- backend composer/action behavior
- lifecycle engine implementation

Tasks:

1. Keep the walkthrough anchored to the canonical Acme flow.
2. Update presenter copy so the center object is described as Dana's credit memo draft.
3. Remove early references to CS-plan conflict, Legal pending on the home memo, and restricted legal
   memo content.
4. Add the visible simulated Credit Officer response beat.
5. Describe the CS-plan conflict as post-CO revalidation only.

Acceptance:

- The walkthrough can be read verbatim against the target demo.
- No walkthrough copy says or implies that the CS-plan conflict appears before CO approval.
- No walkthrough copy implies the CO response happens automatically.

Handoff artifact:

- Updated walkthrough copy and a short note listing the locked causal beats.

## Workstream B - Frontend memo and brief UX

Primary owner: frontend UX owner.

Files likely in scope:

- meeting home memo component
- brief preview/full brief components
- frontend brief data mocks

Out of scope:

- backend action composition
- API event dispatch
- presenter copy except parity checking

Tasks:

1. Clean home memo copy:
   - keep request, financials, prior/current DSCR, RM approval, CO outstanding, covenant tracker
     missing
   - remove early threshold, Legal, restricted legal memo, and CS-plan conflict copy
2. Add distinct treatments for:
   - person approval rows
   - missing artifact rows
   - source conflict rows
3. Ensure initial brief state does not render the CS-plan conflict.
4. Ensure conflict row/style exists for the post-CO state.

Acceptance:

- Home memo reads as an authored credit memo, not system analysis.
- Initial brief has no CS-plan conflict.
- Approval, artifact, and conflict rows are visually distinct.
- `approval_ready` remains false in all partial states.

Handoff artifact:

- Mock screenshots or notes for initial home memo, initial brief, and post-CO brief.

## Workstream C - Staged remediation and no-drift drawer seam

Primary owner: action/frontend integration owner.

Files likely in scope:

- frontend action state/store
- brief readiness action handling
- drawer card rendering
- API/action composer seam if live mode is included

Out of scope:

- home memo copy
- row visual design beyond required provenance display
- full event-log dispatcher

Tasks:

1. Make brief row `Stage` store remediation provenance, not a hand-authored drawer action.
2. Require staged cards to carry:
   - `surface`
   - `row_id`
   - `remediation_tool`
   - `target_object_id`
   - optional `required_approver`
3. Render one drawer card from composer/validator output for the staged remediation.
4. Include `22% pricing exception` in the Credit Officer route card.
5. Reject or visibly block any staged card that cannot be traced to a staged row or explicit batch
   proposal.

Acceptance:

- Staging the Credit Officer row creates exactly one `Next actions` card.
- The card has row provenance.
- Changing the row remediation changes the drawer card.
- If validation blocks the remediation, the drawer shows a blocked card.
- No orphan staged action appears in the drawer.

Handoff artifact:

- Test names or screenshots proving row-to-card provenance.

## Workstream D - Simulated counterparty and revalidation state

Primary owner: lifecycle/demo state owner.

Files likely in scope:

- frontend revalidation state
- CO route pending/approved state
- persona/simulated response integration

Out of scope:

- row taxonomy styling
- full backend event dispatcher unless separately assigned
- walkthrough copy except parity checking

Tasks:

1. Remove or disable hidden Credit Officer auto-sign timer in the demo path.
2. Add a visible `Simulate Credit Officer response` affordance.
3. Move CO route from pending to approved only after that visible action.
4. Trigger post-CO revalidation state from the simulated response.
5. Keep `approval_ready=false` after CO sign-off.
6. Ensure CS-plan conflict appears only after this response.

Acceptance:

- CO approval cannot appear without a visible presenter action.
- The post-CO state clears only the Credit Officer gate.
- Legal and covenant tracker remain unresolved.
- CS-plan conflict is absent before CO response and present after.

Handoff artifact:

- Notes or screenshots showing pre-route, routed/pending, and post-CO revalidation states.

## Workstream E - Notifications and cascade review

Primary owner: Agent Actions drawer owner.

Files likely in scope:

- Agent Actions top-nav badge logic
- drawer tab/chip state
- cascade/reconciliation review UI

Out of scope:

- initial memo copy
- composer validation internals
- hidden timer removal except integration with Workstream D

Tasks:

1. Count staged remediations under `Next actions`.
2. Count returned approvals and dependent-source changes under `Changes`.
3. Clear chip badges only when the relevant chip is opened.
4. After CO response, show `Changes 1` or equivalent returned-change affordance.
5. Show the CS-plan 18% vs approved 22% reconciliation as a reviewable change/action.

Acceptance:

- Credit Officer route starts as `Next actions 1`.
- Executing the route clears the next-action count.
- CO response produces `Changes 1`.
- CS-plan reconciliation is not visible before CO response.
- Accepting the reconciliation clears the conflict but does not make the packet approval-ready.

Handoff artifact:

- Notes or screenshots for `Next actions`, post-CO `Changes`, and accepted cascade states.

## Workstream F - Guardrails and final parity

Primary owner: test/quality owner.

Files likely in scope:

- frontend tests
- API tests if live seam is touched
- lightweight content guard scripts if useful

Out of scope:

- product copy decisions
- UI design implementation
- action engine rule changes

Tasks:

1. Add tests or guards for:
   - initial memo has no early CS-plan conflict
   - initial brief has no CS-plan conflict
   - staged drawer cards require provenance
   - route execution does not auto-sign CO
   - CS-plan conflict appears only after visible CO response
   - `approval_ready` remains false after CO response
2. Add stale-copy searches for ambiguous language:
   - `can also appear immediately`
   - `immediately after the 22%`
   - early `customer success plan references an 18% discount`
3. Run agreed frontend checks.
4. Run backend checks only if API/action paths changed.

Acceptance:

- A reintroduced early CS-plan conflict fails a guard.
- A hidden CO auto-sign path fails a guard.
- A drawer card without row provenance fails a guard.
- Final mock walkthrough matches `docs/ACTION_LIFECYCLE_WALKTHROUGH_UPGRADE_PLAN.md`.

Handoff artifact:

- Commands run, test names, and any remaining unguarded assumptions.

## Final parity checklist

The release/demo integrator should verify:

- Home memo is clean and credit-memo-like.
- `@Agent apply the 22% discount` refuses direct mutation.
- Initial brief has no CS-plan conflict.
- Stage route creates one provenance-backed drawer card.
- Route execution does not auto-sign CO.
- Visible CO simulation triggers post-CO revalidation.
- CS-plan conflict appears only post-CO.
- `Changes` carries the returned/revalidation beat.
- `approval_ready` remains false until all three dependencies clear.
- `demo-walkthrough.html` matches the final behavior.

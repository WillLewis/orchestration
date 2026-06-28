# Action Lifecycle walkthrough upgrade plan

Use this plan to turn the Action Lifecycle architecture into a coherent Acme meeting
walkthrough. The source architecture spec is `docs/ACTION_LIFECYCLE.md`; this document is the
demo plan that should guide presenter copy, frontend behavior, and parity checks.

For the current presenter run from `@Agent apply the 22% discount` through sealing the governed
record, use `docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md`.

## Product decision

The demo should make three surface roles clear:

- The center screen is Dana's screen-shared credit memo draft. It is not meeting notes and not the
  Decision Brief.
- The Decision Brief is the readiness surface. It stages remediations but does not execute them.
- Agent Actions is the execution chokepoint. It runs validated action diffs, records audit, and
  shows returned changes.

The walkthrough should also lock one causal story:

- The customer success plan conflict is not initial analysis.
- It appears only after the Credit Officer approval returns.
- That beat proves revalidation: `approval_returned` triggers a dependent-source check, which finds
  approved 22% pricing vs customer success plan 18%.

The no-drift rule is non-negotiable: a staged drawer card must be produced from the staged brief-row
remediation through the composer / validation path. Do not create a parallel hand-authored drawer
action for a staged row.

## Canonical walkthrough

### Step 0 - Meeting home

The shared work product is Dana's credit memo draft.

Show:

- Acme requests a 22% pricing exception and covenant modification.
- Revenue forecast changed from $42M to $38M.
- DSCR should show prior/current, for example `1.42x -> 1.28x`.
- Relationship Manager approval is recorded.
- Credit Officer approval is outstanding.
- Final covenant tracker is missing.

Do not show on the home memo:

- `(standard threshold 15%)`
- Legal approval status
- restricted legal memo copy
- customer success plan conflict
- any implication that the system has already run the full downstream workflow

### Step 1 - Dana asks for the discount change

Dana types:

```text
@Agent apply the 22% discount
```

The agent refuses direct mutation. The raw ask stays in chat because it is blocked until the
approval route is staged and executed.

### Step 2 - Generate the Decision Brief

The brief shows the readiness surface with distinct row types:

- `ApprovalRequirement`: Credit Officer and Legal.
- `MissingEvidenceState`: final covenant tracker.
- `CalculationCheck`: DSCR passes or remains close to threshold.
- Permission limitation: legal memo is restricted and not used.

The initial brief must not show the customer success plan conflict. That conflict is reserved for
post-Credit-Officer revalidation.

### Step 3 - Stage Credit Officer route

The Credit Officer row has a staging affordance:

```text
Stage: route 22% to Credit Officer
```

Clicking it records staged-row provenance and lights:

```text
Agent Actions -> Next actions 1
```

The staged reference should include:

```ts
origin: {
  surface: "decision_readiness";
  row_id: "credit_officer_approval";
  remediation_tool: "route_approval";
  target_object_id: "doc_pricing_exception";
  required_approver: "credit_officer";
}
```

The drawer card must be the composer / validator result for that remediation.

### Step 4 - Execute the route

The drawer card says `Route to Credit Officer` and includes `22% pricing exception`.

Executing it:

- emits an audit event
- moves the route to pending
- clears `Next actions 1`
- does not auto-sign the approval

### Step 5 - Simulate the Credit Officer response

The presenter uses a visible control, for example:

```text
Simulate Credit Officer response
```

This replaces the hidden timer. The deterministic persona signs off, and the walkthrough can
describe it as a simulated counterparty response.

### Step 6 - Revalidate

The Credit Officer approval return triggers revalidation.

Now the brief and drawer update:

- Credit Officer row passes.
- `approval_threshold` and missing-Credit-Officer gates clear.
- `approval_ready` remains false because Legal and covenant tracker remain unresolved.
- Only now does the customer success plan 18% vs approved 22% conflict appear.
- Agent Actions points to `Changes 1` or a reconciliation review.

### Step 7 - Review the cascade

Opening `Changes` shows the approved change and/or a reconciliation diff for the customer success
plan.

Accepting the reconciliation clears the conflict. Legal and the covenant tracker remain open until
their own remediations are staged and executed.

## Phase plan

### Phase 0 - Lock the demo contract

- Treat this plan and `docs/ACTION_LIFECYCLE.md` as the source of truth.
- Lock post-CO-only conflict reveal.
- Confirm the home memo is a credit memo draft.
- Confirm brief stages and drawer executes.

Acceptance:

- No implementation thread is planning to show the CS-plan conflict before CO approval returns.
- No implementation thread is planning independent staged drawer cards.

### Phase 1 - Memo and brief coherence

- Clean the home memo copy.
- Add prior/current DSCR.
- Remove early threshold, Legal, restricted memo, and CS-plan conflict copy.
- Render approval, artifact, and conflict rows distinctly in the brief.

Acceptance:

- Home memo reads as an authored credit memo.
- Initial brief has no CS-plan conflict.
- Row types are visually distinguishable.

### Phase 2 - Staged remediation / no-drift seam

- Add staged-row provenance.
- Make the drawer render one validated card from the staged remediation.
- Prevent orphan staged actions.
- Include `22% pricing exception` in the route card.

Acceptance:

- Staging the Credit Officer row creates exactly one `Next actions` card.
- Changing row remediation changes the drawer card.
- If validation blocks the remediation, the drawer shows the blocked result.

### Phase 3 - Simulated counterparty and revalidation

- Remove hidden Credit Officer auto-sign timer.
- Add visible simulated response control.
- Update revalidation state after that response.
- Keep `approval_ready=false`.

Acceptance:

- CO approval cannot appear without a visible presenter action.
- CO approval does not make the packet approval-ready.

### Phase 4 - Changes and cascade review

- Route returned approvals and dependent-source changes to `Changes`.
- Surface the CS-plan conflict only after CO response.
- Show reconciliation as reviewable diff/action.

Acceptance:

- Route begins as `Next actions`.
- CO response returns as `Changes`.
- CS-plan reconciliation is not visible before CO response.

### Phase 5 - Walkthrough parity pass

- Update `demo-walkthrough.html` to match the flow.
- Run content guards for stale early conflict/legal/restricted-source copy.
- Verify the demo in mock mode, and live mode if available.

Acceptance:

- The walkthrough can be read verbatim while running the demo.
- No visible screen contradicts the post-CO revalidation story.

## Test scenarios

- Bare public chat does not call the agent.
- `@Agent apply the 22% discount` refuses direct mutation.
- Initial home memo does not include CS-plan conflict, restricted legal memo, Legal pending, or
  threshold copy.
- Initial brief does not include CS-plan conflict.
- Brief row `Stage: route 22% to Credit Officer` creates exactly one drawer card.
- Drawer card includes row provenance and `22% pricing exception`.
- Executing the route does not auto-sign the Credit Officer approval.
- Visible simulated CO response transitions the CO row to approved.
- Only after CO response does the CS-plan 18% vs 22% conflict appear.
- `Changes 1` appears for the post-CO revalidation/cascade beat.
- `approval_ready` remains false until Legal and covenant tracker clear.

## Non-goals

- Do not change `core/schemas.py` or `core/pipeline.py`.
- Do not build the full event-log dispatcher before the walkthrough is coherent.
- Do not make the home memo carry the full Decision Brief analysis.
- Do not hide the Credit Officer response behind a timer.

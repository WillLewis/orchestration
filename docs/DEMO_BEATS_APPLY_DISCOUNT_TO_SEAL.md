# Demo beats - apply discount to sealed governed record

Use these beats for the Acme demo path from Dana's first discount request through the sealed
governed record. This is presenter copy and product choreography, not a new backend contract.

## Demo contract

- The user asks for the 22% discount in chat, but the agent does not mutate the source directly.
- The Decision Brief is the readiness surface. It stages remediations.
- Agent Actions is the execution surface. It routes approvals, accepts diffs, and records audit.
- Counterparty responses are visible simulated beats, not hidden timers.
- The customer success plan conflict appears only after Credit Officer approval returns.
- The governed record is sealed after all demo dependencies clear.

API note:

- In the active meeting run, revalidation is event-derived: lifecycle events are recorded, then
  `/api/brief` recomputes readiness from the current lifecycle state.
- `/revalidate` remains the pinned-record/source-change endpoint for sealed governed records. It is
  not the endpoint driving the live meeting walkthrough.

## Preconditions

- Start from a clean demo state.
- The center document is Dana's Acme renewal credit memo draft.
- The initial Decision Brief is not approval-ready:
  - Credit Officer approval is missing.
  - Legal approval is missing.
  - Final covenant tracker is missing.
  - Customer success plan conflict is not visible yet.
- For live mode, remember that governed records are stored in the API process memory. Restarting the
  API invalidates old record URLs.

## Beat 1 - Ask for the discount

User action:

```text
@Agent apply the 22% discount
```

Screen result:

- The agent refuses direct application.
- The response explains that the 22% discount needs governed approval before a write can happen.
- No drawer action applies the discount directly.

Presenter line:

> The agent is useful, but it is not allowed to silently rewrite regulated work. It has to turn the
> request into a governed decision path.

Proof to point at:

- The request remains in the agent thread.
- No source is changed.
- The next useful move is to generate or open the Decision Brief.

## Beat 2 - Open the Decision Brief

User action:

- Open `Decision Brief — Acme renewal`.

Screen result:

- The header says `Decision Brief — Acme renewal`.
- The brief shows readiness rows:
  - Credit Officer approval needed.
  - Legal approval needed.
  - Final covenant tracker missing.
  - DSCR calculation passes.
- The approval banner remains not approval-ready.
- Source counts and footnotes point to the actual source rail rows.
- The restricted legal source stays in provenance as restricted, not used.

Presenter line:

> This is not chat output. It is a typed readiness view over the evidence, policy gates, approvals,
> missing evidence, and source provenance.

Proof to point at:

- `Approval-ready: No`.
- `Restricted - not used` remains visible in the source rail.
- Customer success plan conflict is still absent at this point.

## Beat 3 - Stage the Credit Officer route

User action:

- In the Credit Officer approval row, click the stage action for routing the 22% exception.

Expected label:

```text
Stage: route 22% to Credit Officer
```

Screen result:

- `Agent Actions` lights up with `Next actions 1`.
- The staged card is created from the row remediation provenance.
- The drawer card says `Route to Credit Officer` and references the 22% pricing exception.

Presenter line:

> The brief does not execute. It stages a specific remediation with row provenance, and the drawer
> validates the action before anything is sent.

Proof to point at:

- The drawer is under `Next actions`.
- The card is ready to route, not marked sent yet.
- No risk or side-effect chips distract from the required decision/status chips.

## Beat 4 - Execute the Credit Officer route

User action:

- Click the drawer card's send/route action.

Screen result:

- The drawer records the audit event.
- The Credit Officer route moves to pending.
- `Next actions 1` clears.
- The drawer shows the pending-response strip:

```text
Credit Officer pending.
Simulate Credit Officer response
```

Presenter line:

> Routing the approval is a governed write. The system can prove what it sent and why, but it still
> waits for the approver.

Proof to point at:

- Audit log has an executed route.
- The Credit Officer row is pending, not approved.
- Nothing auto-signs.

## Beat 5 - Simulate Credit Officer response

User action:

- Click `Simulate Credit Officer response`.

Screen result:

- The Credit Officer row turns approved.
- The threshold / missing Credit Officer gate clears.
- Approval-ready is still false because Legal, covenant evidence, and source reconciliation remain.
- `Agent Actions` moves to `Changes`.
- The customer success plan conflict appears now:
  - Approved pricing exception is 22%.
  - Customer success plan still assumes 18%.

Presenter line:

> This is the lifecycle beat. An approval returned, so the work product revalidates its dependencies
> by recomputing the brief from lifecycle state, and finds a downstream source that now disagrees.

Proof to point at:

- The conflict appears only after the Credit Officer response.
- The change source is the returned approval, not a new user prompt.
- The Decision Brief is still honest that more work remains.

## Beat 6 - Accept the CS plan reconciliation

User action:

- Open `Agent Actions -> Changes`.
- Review the customer success plan diff.
- Click `Accept edit`.

Screen result:

- The CS plan now reflects the approved 22% discount.
- The conflict clears.
- Approval-ready remains false because Legal approval and final covenant tracker are still open.

Presenter line:

> The agent can propose the downstream edit, but the human still accepts the diff. That acceptance
> becomes another lifecycle event.

Proof to point at:

- The conflict row disappears from the brief.
- The source status returns to used instead of conflicting.
- Legal and covenant tracker still block.

## Beat 7 - Route Legal approval

User action:

- Stage the Legal approval row from the Decision Brief.
- Open `Agent Actions -> Next actions`.
- Send the Legal route.

Screen result:

- Legal moves to pending.
- The drawer shows:

```text
Legal pending.
Simulate Legal response
```

Presenter line:

> The same pattern repeats for another owner: row, remediation, validated drawer card, executed
> route, then a visible simulated response.

Proof to point at:

- The Legal card is a route/review action for the covenant modification.
- It is not bundled into an unreviewed automatic approval.

## Beat 8 - Simulate Legal response

User action:

- Click `Simulate Legal response`.

Screen result:

- Legal turns approved.
- The brief recomputes.
- Approval-ready is still false if the final covenant tracker has not been uploaded.

Presenter line:

> The system advances only the dependency that actually changed. Legal is cleared, but missing
> evidence is still missing.

Proof to point at:

- Required approvals show Credit Officer and Legal approved.
- The final covenant tracker still appears as the remaining blocker.

## Beat 9 - Request the covenant tracker

User action:

- Stage the covenant tracker row.
- Open `Agent Actions -> Next actions`.
- Send/create the analyst task.

Screen result:

- The covenant tracker row moves to requested or pending.
- The drawer shows:

```text
Covenant tracker pending.
Simulate Priya upload
```

Presenter line:

> Missing evidence is not hallucinated or waived. The agent creates a concrete request for the
> analyst who owns that artifact.

Proof to point at:

- The missing evidence row is tied to `doc_covenant_tracker`.
- The task/request is visible in Agent Actions before it is considered complete.

## Beat 10 - Simulate Priya upload

User action:

- Click `Simulate Priya upload`.

Screen result:

- The final covenant tracker becomes attached/used.
- Missing evidence clears.
- The brief recomputes to approval-ready.
- The path-to-ready checklist is empty or fully cleared.

Presenter line:

> Now all prerequisites are satisfied: Credit, Legal, covenant evidence, and source reconciliation.
> The brief can become approval-ready without pretending any earlier step was complete.

Proof to point at:

- `Approval-ready` turns yes/approved.
- Required approvals are approved.
- Missing evidence and conflicting evidence sections are absent.

## Beat 11 - Seal as governed record

User action:

- Click `Seal as governed record` from the Decision Brief.

Screen result:

- The app mints a governed record and navigates to `/record/:recordId`.
- The record title is `Acme renewal — Decision Brief`.
- The governance header shows:
  - Integrity: valid.
  - Freshness: current.
  - Approval: approval-ready.
- The record contains the final Decision Brief state, not the stale initial state.

Presenter line:

> Sealing turns the live brief into a durable governed work product: decision, evidence, approvals,
> source versions, permission omissions, dependency map, and an integrity seal.

Proof to point at:

- No stale `Credit Officer approval missing` copy.
- No stale risk-rating missing-evidence row.
- No path-to-ready section when all prerequisites are complete.
- The provenance table includes source versions and status metadata.
- The seal shows payload hash, seal value, and algorithm.

## Beat 12 - Optional verification after seal

User action:

- On the record page, pick a simulated source change.
- Click `Verify record`.

Screen result:

- Integrity remains valid.
- Freshness can become stale.
- Affected sections and reapproval routes are called out.

Presenter line:

> The sealed record is not just a PDF. It knows what sources it depended on, so later source changes
> can mark only the affected sections stale through the pinned-record revalidation path.

Proof to point at:

- Dependency map highlights the affected sections.
- Reapproval routes are targeted, not a blanket rerun.

## One-line close

> The demo starts with a blocked write request and ends with a sealed, approval-ready governed
> record. Every step in between is explicit: stage, validate, execute, wait for owner response,
> revalidate, and then seal.

## Failure guards

- Do not say the agent "applied the discount" before Credit Officer approval and CS plan
  reconciliation.
- Do not reveal the CS plan 18% conflict before the Credit Officer response.
- Do not imply Legal or Priya respond automatically.
- Do not seal the record as the final demo payoff until approval-ready is true.
- Do not describe the sealed record as a legal signature; it is tamper-evident governance evidence.

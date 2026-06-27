# Action Lifecycle - Decision Brief, Agent Actions, and revalidation

## Scope

This document is the build spec for how the Decision Brief and Agent Actions drawer should be
populated, staged, executed, and revalidated.

It is intentionally split into:

- **Target architecture:** the invariant we want the product to satisfy.
- **Current implementation:** what exists in this repo today.
- **Build gaps:** the smallest changes needed to make the visible demo match the architecture.

The goal is to make the Acme meeting demo coherent without overclaiming what is wired today.
Do not edit `core/schemas.py` or `core/pipeline.py` for this work.

## Current repo reality

The lifecycle primitives mostly exist, and the Acme live demo now has an API-local anti-drift seam.
The remaining gap is a general `EventTrigger` dispatcher and persistent event log.

| Claim | Current state |
|---|---|
| Typed lifecycle primitives | Present in `core/schemas.py`, including `EventTrigger`, `PolicyGraph`, `WorkProductContract`, revalidation types, action types. |
| Safe action validation | Present in `actions/composer.py` and `actions/engine.py`. The composer validates every proposed action through the deterministic engine. |
| Rollback | Present on `WorkspaceExecutor.rollback()` in `actions/engine.py`. It is not the main capability of `actions/loop.py`. |
| Brief and drawer share one source | Live staged rows are verified server-side against the current readiness row before composition; `/api/actions` derives row actions from `DecisionReadiness.rows[*].action` plus explicitly labeled batch fixtures. |
| Event log / dispatcher | API-local in-memory lifecycle events exist for the Acme demo. `EventTrigger` is still only a type; no general backend dispatcher fans events into one recompute loop yet. |
| Demo revalidation | Live mode derives routed/signed/reconciled state from API lifecycle events. Mock mode keeps the deterministic frontend store for offline demo parity. |

The strongest lifecycle claims below are therefore **design invariants to enforce**, not statements
that the current repo already satisfies end to end.

## Load-bearing invariants

### 1. The Decision Brief stages. Agent Actions executes.

The Decision Brief is a read-and-stage surface. It shows what a decision needs and lets a human
queue a remediation. It must not run side effects.

The Agent Actions drawer is the execution chokepoint. It is where dry-run, edit, approval, audit,
and execution happen.

If a brief-row button appears to run the action directly, the boundary has leaked.

### 2. No drift: the drawer card must be derived from the staged brief row.

This is the most important build guardrail.

Clicking **Stage** on a brief readiness row must not independently create a drawer action. It should
record a reference to that row's remediation, then ask the action composer / validation layer to
produce the drawer card from that exact remediation.

Required provenance for every staged drawer card:

```ts
origin: {
  surface: "decision_readiness";
  row_id: string;
  remediation_tool: string;
  target_object_id: string;
  required_approver?: string | null;
}
```

Acceptance test:

1. A readiness row carries a remediation descriptor: tool, target, approver, sources, and business
   parameters such as the 22% amount.
2. Clicking `Stage` stores the row/remediation identity, not a parallel hand-authored action.
3. The drawer card is produced by composer validation of that remediation.
4. If the row remediation changes, the staged drawer card changes.
5. If the composer or gate blocks the remediation, the drawer shows the blocked card.
6. The drawer must not render an orphan action without `origin`, except for a deliberately labeled
   batch proposal path.

This is the direct fix for the old `AcmeFollowupProposer` drift problem: the drawer cannot be
another source of truth. The server also rejects stale or forged staged descriptors before
composition.

### 3. The home memo is not the Decision Brief.

The center surface in the meeting is Dana's screen-shared credit memo draft. It is an authored work
product with governed highlights.

The Decision Brief is the system-generated readiness projection.

The Agent Actions drawer is the execution surface.

Keep those roles visually and narratively separate:

- The home memo can show the business request, financial changes, and obvious open facts.
- The brief should explain policy gates, delegated authority, missing approvals, conflicts, and
  restricted-source limitations.
- The drawer should show executable remediations and changes requiring review.

Do not overload the home memo with future workflow state.

### 4. `approval_ready` is recomputed and must not flicker true.

`approval_ready` is never carried over from a prior stage. It must be recomputed from the current
facts and gates.

For the Acme arc, it must stay `false` after Credit Officer approval because Legal sign-off and the
final covenant tracker remain unresolved.

### 5. Visible simulation beats hidden timers.

Counterparty responses in the demo should use a visible simulated counterparty affordance, not a
hidden timer.

For example:

1. Execute `Route to Credit Officer`.
2. Show route pending.
3. Presenter clicks `Simulate Credit Officer response`.
4. The simulated persona signs off.
5. Revalidation runs.

This preserves determinism without making the panel wonder whether the system pre-knew the answer.

## Target loop

This is the target architecture. Parts of it are not wired yet.

```text
EventTrigger
  -> revalidate(WorkProductContract)
  -> Decision Brief read model
       readiness rows
       status
       next_steps / remediations
       Stage affordances
  -> human stages a row
  -> staged remediation reference
  -> composer validates remediation into one drawer card
  -> Agent Actions / Next actions
  -> human executes
  -> AuditEvent
  -> side effect / approval route
  -> EventTrigger
  -> Agent Actions / Changes
```

The loop closes because execution, source changes, and approval returns are all new events.

Until an event dispatcher exists, the demo can use explicit frontend/API transitions, but the
surface behavior should still respect the same state boundaries.

## Trigger classes

A Decision Brief should eventually respond to any event that affects a source dependency in its
`WorkProductContract`.

| Event class | Example | Drawer implication |
|---|---|---|
| `decision_request` | Dana frames the Acme renewal decision or asks for 22%. | Generates or refreshes the brief. No drawer action until a row is staged. |
| `source_changed` | Customer success plan remains at 18% after a 22% approval. | Creates a Changes notification or a stageable reconciliation remediation. |
| `approval_returned` | Credit Officer signs the 22% exception. | Creates a Changes notification and revalidates readiness. |

Important: a brief is not chat-only. Approval returns and source changes can update the brief even
when nobody typed `@Agent`.

## Staging versus execution

Use two verbs because the surfaces do different work.

| Surface | Verb | Meaning |
|---|---|---|
| Brief readiness row | `Stage` | Queue a remediation for review. No side effect. |
| Agent Actions drawer | `Execute`, `Route`, `Create`, `Accept edit` | Run the validated action through the execution chokepoint. |

Preferred labels:

- Brief: `Stage: route 22% to Credit Officer`
- Drawer: `Route to Credit Officer`

The drawer card should include the amount by default: `22% pricing exception`.

The drawer should allow edit where the user can safely change meaningful fields before execution.
For approval routing, editable fields should be explicit and limited, for example approver, route
note, and requested amount if changing it triggers revalidation.

## Notification model

Use two counters with opposite meanings.

| Chip | Counts | Increments when | Default drawer tab |
|---|---|---|---|
| `Next actions` | Staged remediations awaiting execution. | A row is staged or a batch proposal is accepted. | `Next actions` |
| `Changes` | Committed or external mutations awaiting review. | An `AuditEvent`, `source_changed`, or `approval_returned` lands. | `Changes` |

Top-nav `Agent Actions` badge should count unseen items across both chips. Per-chip badges should
clear when the user opens that chip, not merely when the drawer opens.

Rule of thumb:

- "The agent should do something" -> Next actions.
- "Something happened you should inspect" -> Changes.

## Row taxonomy

Do not render every readiness issue as the same red row. These are different schema objects and
different user jobs.

| Meaning | Schema object | Acme example | UI treatment | Stage remediation |
|---|---|---|---|---|
| Needs a person | `ApprovalRequirement` | Credit Officer, Legal | person/role icon, approver identity, route state | `route_approval` |
| Needs an artifact | `MissingEvidenceState(blocking=true)` | final covenant tracker | document/task icon, owner, due date, upload/request affordance | `create_task` |
| Two sources disagree | `ConflictState` | approved 22% vs CS plan 18% | compare/diff treatment, source chips, before/after values | `edit_document` |

This distinction is product-critical. If all three look identical, viewers conflate "waiting on a
human" with "missing a file" with "contradictory evidence."

## Appearances versus transitions

This rule prevents the demo from looking like it knows the ending.

- A row may appear mid-flow only if a new input created it.
- Otherwise prerequisites should be present from generation and only change status.

Examples:

- Credit Officer, Legal, and covenant tracker are standing prerequisites for the Acme decision
  class. They can be present in the brief from generation.
- The home memo should not show all of those as system analysis before the brief is opened.
- For this walkthrough, the customer success plan conflict appears only after Credit Officer
  approval returns. The causal beat is `approval_returned` -> revalidate dependent sources ->
  detect approved 22% vs customer success plan 18%. Do not surface that conflict immediately
  after the 22% request.

## Recompute target

On any qualifying event, the target backend recompute should:

1. Re-assemble context under the permission boundary.
2. Re-run deterministic gates: rule firings, calculations, approval matrix, and missing evidence.
3. Recompute readiness rows by taxonomy.
4. Compute change impact for source changes.
5. Produce ordered `next_steps` / remediations from the policy graph.
6. Let the user stage a row.
7. Convert the staged remediation into a drawer card through composer validation.

The no-drift invariant is only true if steps 5 and 7 use the same remediation identity. A separate
hardcoded drawer plan violates the invariant even if the UI looks correct.

## Corrected Acme walkthrough

### Step 0 - meeting home

The center object is Dana's screen-shared credit memo draft, not meeting notes and not the system
brief.

Recommended home memo behavior:

- Show the request: Acme is requesting a 22% pricing exception and covenant modification.
- Show financial changes: revenue forecast revised from $42M to $38M, and show prior/current DSCR.
- Show only simple open facts, such as Credit Officer outstanding and final covenant tracker
  missing.
- Do not show `(standard threshold 15%)`, Legal pending, restricted legal memo, or CS-plan conflict
  on the home memo before the brief/revalidation has context for them.

### Step 1 - Dana asks the agent

Dana types:

```text
@Agent apply the 22% discount
```

The agent refuses direct application. The raw discount change is a hard-blocked ask and does not
enter the drawer.

### Step 2 - generate/open the Decision Brief

The brief shows readiness by row type:

- Credit Officer approval needed.
- Legal approval needed for the covenant modification.
- Final covenant tracker missing.
- DSCR calculation passed or close to threshold.
- Restricted legal source acknowledged only as a permission limitation, not summarized.

The brief can explain that 15% is the Relationship Manager's delegated authority and 22% requires
Credit Officer approval.

For this walkthrough, the initial brief does not show the customer success plan conflict. That
source disagreement is reserved for the post-Credit-Officer revalidation beat.

### Step 3 - stage Credit Officer route

The Credit Officer row button says:

```text
Stage: route 22% to Credit Officer
```

Clicking it records the row remediation identity and lights `Agent Actions -> Next actions 1`.

The drawer card must be produced by composer validation of that staged remediation. It must not be
a parallel hardcoded action.

### Step 4 - execute the route

The drawer card says `Route to Credit Officer`, includes `22% pricing exception`, and can show the
target workflow/doc.

Clicking Execute/Route emits an audit event and moves the route to pending.

### Step 5 - visible simulated counterparty

The presenter clicks a visible affordance such as:

```text
Simulate Credit Officer response
```

The `StubPersonaClient` / persona path returns a deterministic sign-off.

This emits an `approval_returned` event in the target architecture. In the current demo it can be a
frontend/API transition, but it should be visible and intentional.

### Step 6 - revalidate

The brief updates:

- Credit Officer row transitions to passed/approved.
- `approval_threshold` and missing-CO gates clear.
- `approval_ready` remains false because Legal and covenant tracker remain unresolved.
- Only now does the customer success plan 18% vs approved 22% conflict appear, as a revalidation
  change or stageable reconciliation.

The top-nav badge should now point to `Changes 1`, not another generic action count.

### Step 7 - reconcile cascade and continue

Opening `Changes` shows the approved change and/or a reconciliation diff for the customer success
plan.

Accepting the reconciliation clears the conflict. Legal and covenant remain open until their own
remediations are staged and executed.

The same loop repeats:

```text
event -> recompute -> row status/remediation -> stage -> composer validates -> drawer executes
```

## Configurability answer

This should be explainable as primitives, not an Acme script.

| Primitive | Panel question | Configuration knob |
|---|---|---|
| `AgentRecipe` | Does this only work for credit? | Swap recipe id and allowed sources/actions. |
| `RulePack` / `Rule` | Who decided the 15% threshold? | Rule parameters and versioned policy artifact. |
| `ApprovalMatrix` / approval policy | Why Credit Officer? | Required approver by rule or side-effect class. |
| `PolicyGraph` | Why this order? | Dependency edges and prerequisite ordering. |
| `WorkProductContract` | What makes a brief stale? | Source dependencies and revalidation rules. |
| `RevalidationRule` | How does it know the CS plan is affected? | Trigger object ids mapped to affected sections. |
| `Action` / `ActionDiff` | What exactly will run? | ToolCard, side effect, before/after diff, gate result. |

One-line answer:

> A Decision Brief is not chat-only. It recomputes when a decision is requested, a source changes,
> or an approval returns. The brief stages remediations; Agent Actions executes validated diffs.

## Build plan

### Phase 1 - demo coherence, no core changes

1. Clean the home memo copy so policy analysis is not shown before the brief and the customer
   success plan conflict is not shown before Credit Officer approval returns.
2. Add row taxonomy styling in the brief for approval, missing evidence, and conflict rows.
3. Replace hidden CO auto-sign timer with a visible simulated counterparty control.
4. Keep `approval_ready=false` until Legal and covenant tracker clear.
5. Add stage provenance for readiness-row actions.
6. Make the drawer render staged cards from composer validation of the row remediation.
7. Add tests proving no orphan drawer actions are rendered for staged rows.

Acceptance tests for Phase 1:

- Bare public chat does not call the agent.
- `@Agent apply the 22% discount` refuses direct mutation.
- `@Agent generate decision brief` shows the brief.
- Brief row `Stage: route 22% to Credit Officer` creates exactly one `Next actions` card.
- That card includes the 22% amount and row provenance.
- Changing the row remediation changes the drawer card.
- The drawer card is blocked if validation blocks the remediation.
- CO response requires a visible simulated action, not a hidden timer.
- The initial brief does not show the customer success plan conflict.
- The customer success plan conflict appears only after the visible Credit Officer response.
- `approval_ready` never flips true after CO sign-off while Legal/tracker remain unresolved.

### Phase 2 - backend anti-drift seam

1. Replace the API demo path's fixed `AcmeFollowupProposer` for staged-row flows. **Done.**
2. Add a composer entrypoint that accepts one staged remediation and returns one validated
   `Action`. **Done.**
3. Route brief-row staging through that entrypoint. **Done.**
4. Execute staged rows by verified origin instead of ActionPlan index. **Done for
   `/actions/staged-remediation/execute`.**
5. Keep batch proposals labeled separately and traceable to their proposal origin. **Done for the
   Acme batch fixtures.**
6. Add API tests that prove row remediations and drawer actions cannot drift. **Done.**

### Phase 3 - event dispatch and live parity

1. Wire a general `EventTrigger` dispatcher.
2. Replace the API-local in-memory Acme event store with the eventual lifecycle store.
3. Revalidate work products from `WorkProductContract.source_dependencies`.
4. Emit `Changes` notifications from source-change and approval-return events.
5. Move the remaining mock-mode cascade presentation from special-cased frontend data to
   lifecycle/action primitives.

## Known current gaps to avoid overclaiming

| Gap | Current location |
|---|---|
| General event dispatcher for `EventTrigger` is not wired. | Lifecycle/API gap. |
| Persistent lifecycle event storage is not wired. | `api/lifecycle_events.py` is intentionally in-memory for the prototype. |
| Mock mode still uses the deterministic frontend revalidation store. | `frontend/src/lib/revalidation-store.ts`. |
| Changes counter is not fully first-class. | `frontend/src/lib/actions-store.ts` and drawer wiring. |
| Cascade presentation still has a mock fixture. | `frontend/src/data/actions.ts`; live readiness row carries the edit descriptor. |

## Demo-safety rules

- Do not imply the home memo is the system's complete readiness analysis.
- Do not show restricted source contents. Permission limitations can be acknowledged.
- Do not show Legal approval status on the home memo before the brief.
- Do not show the customer success plan conflict before Credit Officer approval returns.
- Do not use hidden timers for counterparty approvals.
- Do not let the drawer run actions that are not traceable to a staged row or explicit batch
  proposal.
- Do not let `approval_ready` flicker true during the Acme arc until Credit, Legal, and covenant
  tracker are all clear.

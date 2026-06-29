# Revalidation demo - live parity hand-off

This note is the current boundary between the active Acme meeting walkthrough and sealed-record
revalidation. Use it as reviewer context for FAQ answers; do not treat it as a new backend
contract.

## Current status

The active Acme walkthrough is no longer a mock-first revalidation hand-off. In live mode, the
Decision Brief path uses API-local lifecycle events and recomputes readiness through `/api/brief`.

Current live path:

1. Direct 22% write request is refused by the agent.
2. Decision Brief shows typed readiness rows.
3. A readiness row stages one remediation.
4. Agent Actions rebuilds and validates the drawer card from that row.
5. The user executes the reviewed action.
6. A visible simulated counterparty response or artifact upload appends a lifecycle event.
7. `/api/brief` recomputes from the derived lifecycle state.
8. Approval-ready remains false until Credit Officer, Legal, final covenant tracker, and CS-plan
   reconciliation all clear.
9. The approval-ready brief can be sealed as a governed record.

## Active meeting revalidation

The active meeting loop is lifecycle-event-derived:

```text
POST /actions/staged-remediation/execute
  -> audit event and/or lifecycle event
POST /api/lifecycle/events
  -> append content-free event
GET /api/lifecycle
  -> derive routed/signed/uploaded/reconciled state
GET /api/brief
  -> rebuild DecisionReadiness from current lifecycle state
```

This is the live Acme walkthrough path. It is not driven by `/revalidate`.

The demo still uses deterministic simulated people and timing so one presenter can run the path
without live email or another operator. The state changes are still computed from lifecycle state;
they are not prewritten UI outcomes.

## CS-plan conflict timing

The customer success plan conflict must not appear in the initial brief.

It appears only after the Credit Officer approval returns:

```text
approval_returned
  -> derive lifecycle state
  -> recompute /api/brief
  -> detect approved 22% vs CS plan 18%
  -> expose a reviewed reconciliation diff in Agent Actions
```

Accepting the reconciliation appends `revalidation_applied` for `doc_cs_plan`. Approval-ready still
remains false until Legal and the final covenant tracker also clear.

## Sealed-record revalidation

`/revalidate` is the pinned governed-record/source-change path. It is for records that have already
been minted and later need freshness verification.

Use `/revalidate` or `/workproducts/{record_id}/verify` when:

- A sealed record has a source dependency change.
- The system needs to mark affected sections stale.
- The system needs targeted reapproval routes from the sealed dependency map.
- Integrity and freshness need to be checked independently.

Do not describe `/revalidate` as the active meeting walkthrough loop.

## Remaining platform work

The Acme path has API-local lifecycle events and explicit Acme reducers. The future platform work is
broader:

- Wire a general `EventTrigger` dispatcher.
- Replace the in-memory prototype lifecycle store with persistent lifecycle storage.
- Connect all relevant read models to policy-configured lifecycle events.
- Keep `/revalidate` as the sealed-record/source-change seam and connect it to the general
  dispatcher where appropriate.

## Reviewer-safe summary

The live Acme demo proves the causal loop: event, derived state, `/api/brief` recompute, row
staging, validated drawer execution, visible simulated response, and final seal. `/revalidate` is
real and tested, but it belongs to sealed governed-record freshness, not the active meeting path.

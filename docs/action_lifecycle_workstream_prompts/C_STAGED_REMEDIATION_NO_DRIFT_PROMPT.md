# Workstream C prompt - Staged remediation and no-drift drawer seam

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Make the Decision Brief `Stage` action create a provenance-backed remediation reference, then make
Agent Actions render the drawer card from composer/validator output for that exact remediation.

This workstream fixes the drift class where the brief and drawer are independent sources.

## Required context

Read before writing:

- `AGENTS.md`
- `README.md`
- `frontend/README.md`
- `actions/README.md`
- `docs/ACTION_LIFECYCLE.md`
- `docs/ACTION_LIFECYCLE_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/ACTION_LIFECYCLE_ASYNC_WORKSTREAMS.md`
- current brief readiness action handling
- current Agent Actions drawer state/store
- current action composer/API seam if live mode is touched

Use `rg` to locate the exact files before editing.

## Scope

In scope:

- brief-row stage handling
- staged action provenance shape
- drawer rendering of staged remediation cards
- API/action composer seam only if needed for live parity
- tests for no orphan staged cards

Out of scope:

- home memo copy
- row visual styling beyond provenance behavior
- full event-log dispatcher
- hidden CO timer removal
- `core/schemas.py`
- `core/pipeline.py`

## Required invariant

`Stage` must not create an independent drawer action.

It must store a reference to the brief-row remediation, with provenance like:

```ts
origin: {
  surface: "decision_readiness";
  row_id: string;
  remediation_tool: string;
  target_object_id: string;
  required_approver?: string | null;
}
```

The drawer card must be generated from validation/composition of that remediation.

## Tasks

1. Add or formalize staged-row provenance.
2. Make `Stage: route 22% to Credit Officer` create exactly one staged remediation reference.
3. Render exactly one drawer card from that reference.
4. Include `22% pricing exception` on the route card.
5. Ensure invalid/blocked remediation renders as blocked, not silently dropped or rewritten.
6. Keep batch proposals explicitly labeled as batch-origin, not row-origin.
7. Add focused tests for provenance and no orphan staged cards.

## Acceptance

- Staging the Credit Officer row creates exactly one `Next actions` card.
- The card carries row provenance.
- The card includes the 22% amount.
- Changing row remediation changes the drawer card.
- If validation blocks the remediation, the drawer shows the blocked result.
- No staged drawer card can render without row provenance or explicit batch origin.

## Final response

Report:

- files changed
- provenance shape/location
- how the drawer derives the card
- tests added/run
- any API/live-mode follow-up

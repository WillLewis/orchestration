# Workstream A prompt - Product and narrative lock

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Lock the product/narrative decision for Beats 7 and 8 so every implementation thread aligns to the
same story.

The target behavior is documented in:

- `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md`

## Required context

Read these files before writing:

- `AGENTS.md`
- `README.md`
- `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md`
- `demo-walkthrough.html`

Use `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md` as the workstream boundary reference.

## Product decision to confirm

Embrace the live Acme behavior:

- Beat 7: 6 actions = 2 ready, 2 routes, 2 blocked.
- Beat 8: 5 assignments, 5 replies, 3 escalations, 3 unresolved items.
- Replace the old money moment "honest about 1 open item" with "honest about what is still open."

Do not propose reducing the live dossier back to one open item. The mosaic gate is part of the
trust story.

## Scope

In scope:

- Refining or annotating the two Beats 7/8 planning docs.
- Adding a short narrative decision note if useful.
- Recording the cold-open decision: `HTML-only`, `re-cut`, or `N/A`.

Out of scope:

- Frontend implementation.
- API/test implementation.
- Action engine changes.
- Edits to `core/schemas.py` or `core/pipeline.py`.

## Tasks

1. Confirm the product decision in writing.
2. Confirm the new money-line framing.
3. Decide whether the 75-second cold open is generated from the HTML storyboard or requires a video
   re-cut.
4. Check that the two planning docs still state the same canonical baseline.
5. If you edit docs, keep changes scoped and ASCII-only.

## Acceptance

- The final note states the approved Beat 7 and Beat 8 numbers.
- The final note explicitly says whether the cold open is `HTML-only`, `re-cut`, or `N/A`.
- No implementation files are changed.
- No docs reintroduce `1 item open` as the Beat 8 money moment.

## Final response

Report:

- product decision
- approved money line
- cold-open decision
- files changed, if any

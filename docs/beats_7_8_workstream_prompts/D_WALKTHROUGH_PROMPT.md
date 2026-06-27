# Workstream D prompt - Presenter walkthrough and cold open

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Update `demo-walkthrough.html` so Beat 7 and Beat 8 presenter copy, storyboard frames, and inline
fixtures match the live Acme behavior.

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

If Workstream A has landed, read its cold-open decision.

Use `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md` as the workstream boundary reference.

## Canonical story

Beat 7:

- 6 follow-ups.
- 2 safe actions: one task and one draft.
- 2 approval routes: Credit Officer and Legal.
- 2 hard-blocked actions: missing evidence and information-barrier / mosaic.
- Approving all six still skips both blocked actions.

Beat 8:

- 5 assignments/replies.
- 3 escalations.
- 3 unresolved items.
- Cycle closed does not mean fully resolved.
- Money line: honest about what is still open.

## Scope

In scope:

- `demo-walkthrough.html`
- cold-open recording/storyboard assets, if they are represented in repo files

Out of scope:

- frontend app implementation
- API behavior
- generated docs corpus
- `core/`
- action engine behavior

## Tasks

1. Update Beat 7 say block.
2. Update Beat 7 inline `ACTIONS` and `approveAll()` audit rows.
3. Update Beat 8 say block.
4. Update Beat 8 inline assignments/escalations/scheduled/status copy.
5. Update opening thesis / money-moment copy.
6. Update cold-open shot list and storyboard frames at `00:46` and `00:58`.
7. Update deep-dive answer about real orchestration.
8. Record whether the cold open is `HTML-only`, `re-cut`, or `N/A`.

## Required stale-string check

After edits, run:

`rg "1 item open|the blocked one|Three are safe drafts|executes three" demo-walkthrough.html`

If any match remains, verify it is not stale Beat 7/8 copy. Prefer removing or rewriting all matches.

## Acceptance

- The walkthrough can be read verbatim against live mode.
- Beat 7 never says singular "the blocked one."
- Beat 7 never says three safe drafts or executes three.
- Beat 8 no longer sells "1 item open."
- Inline HTML fixtures mirror the canonical live counts.
- Cold-open decision is recorded.

## Final response

Report:

- files changed
- stale-string check result
- cold-open decision
- any expected follow-up for video re-cut or visual QA

# Workstream E prompt - Anti-drift guardrail suite

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Add guardrails so Beats 7 and 8 cannot drift again between live API output, frontend mocks, and
presenter copy.

The target behavior is documented in:

- `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md`

## Required context

Read these files before writing:

- `AGENTS.md`
- `README.md`
- `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md`
- `api/tests/test_loop_endpoint.py`
- `tests/test_docs_corpus.py`
- `frontend/src/data/actions.ts`
- `frontend/src/data/loop.ts`
- `demo-walkthrough.html`

If Workstreams B-D have landed, read their changed files before adding guards.

`WORKSTREAMS.md` may be absent on this branch. If it is absent, use
`docs/BEATS_7_8_ASYNC_WORKSTREAMS.md` as the temporary boundary reference.

## Scope

In scope:

- `api/tests/`
- `tests/`
- lightweight scripts under `scripts/`, if useful
- optional frontend tests only if a runner is defined or added deliberately

Out of scope:

- product copy decisions
- backend engine behavior changes
- broad frontend refactors
- `core/`

## Tasks

1. Add exact API guards for `/api/actions`:
   - six tools in order
   - two ready, two route, two blocked
   - blocked reasons include `missing_evidence` and `mosaic` / `information-barrier`
2. Add exact API guards for `/api/loop`:
   - 5 assignments
   - 5 replies
   - 3 escalations
   - targets include `compliance` and `human`
   - scheduled reason includes `3 item(s) unresolved`
3. Keep determinism checks timestamp-normalized.
4. Add content guards for stale copy:
   - `1 item open`
   - `the blocked one`
   - `Three are safe drafts`
   - `executes three`
5. Add frontend mock-vs-baseline checks after Workstream C updates mocks.
6. If adding frontend tests, define the runner first because `frontend/package.json` currently has
   no `test` script.

## Acceptance

- A stale walkthrough or frontend open-count string fails a guard.
- A changed live action count/order fails a guard.
- A changed loop unresolved count fails a guard.
- Python checks pass:
  - `make test`
  - `make lint`
- If frontend tests are added, their command is documented and passes.

## Final response

Report:

- files changed
- new guard names
- commands run and results
- any guard intentionally deferred because another workstream has not landed

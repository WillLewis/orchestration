# Workstream B prompt - API baseline and deterministic personas

You are working in the ConnectWork Command Agent repo:

`/Users/WL/Documents/Documents - William's MacBook Pro (4)/GitHub/box`

## Goal

Make the live API baseline for Beats 7 and 8 explicit, deterministic, and guarded by exact tests.

The target behavior is documented in:

- `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md`

## Required context

Read these files before writing:

- `AGENTS.md`
- `README.md`
- `api/README.md`
- `actions/README.md`
- `docs/BEATS_7_8_WALKTHROUGH_UPGRADE_PLAN.md`
- `docs/BEATS_7_8_ASYNC_WORKSTREAMS.md`
- `api/orchestrator.py`
- `api/tests/test_loop_endpoint.py`
- `api/main.py`

`WORKSTREAMS.md` may be absent on this branch. If it is absent, use
`docs/BEATS_7_8_ASYNC_WORKSTREAMS.md` as the temporary boundary reference.

## Canonical baseline

`/api/actions` must expose exactly:

1. `create_task` - ready.
2. `draft_internal_note` - ready.
3. `route_approval` - route to `credit_officer`.
4. `route_approval` - route to `legal`.
5. `schedule_meeting` - blocked by `missing_evidence`.
6. `draft_internal_note` - blocked by information-barrier / mosaic.

`/api/loop` must expose exactly:

- 5 assignments
- 5 replies
- 3 escalations
- escalation targets include `compliance` and `human`
- 1 scheduled item whose reason includes `3 item(s) unresolved`
- `closed: true`

Compare determinism after normalizing audit timestamps. Do not require byte-identical JSON unless
you add an injected/frozen audit clock.

## Scope

In scope:

- `api/orchestrator.py`
- `api/tests/test_loop_endpoint.py`
- optional baseline fixture under `api/tests/fixtures/` or `tests/fixtures/`
- `.env.example` or README/docs only if needed for deterministic demo setup

Out of scope:

- `core/schemas.py`
- `core/pipeline.py`
- `actions/engine.py`
- frontend files
- `demo-walkthrough.html`

## Tasks

1. Capture or encode the normalized `/api/actions` and `/api/loop` baselines.
2. Tighten API tests from loose semantic assertions to exact baseline assertions.
3. Ensure the deterministic demo path uses stub persona replies.
4. Prefer adding/documenting `DEMO_DETERMINISTIC=1` to force `StubPersonaClient`; otherwise document
   that `PERSONA_MODEL` must be blank for the walkthrough runtime.
5. Preserve the existing engine/composer behavior. The live gates are correct.

## Acceptance

- `python -m pytest api/tests/test_loop_endpoint.py -q` passes.
- The tests fail if action order/counts change.
- The tests fail if loop assignments/replies/escalations/scheduled unresolved count changes.
- Repeated loop calls match after timestamp normalization.
- No LLM-generated persona paragraphs appear in the deterministic demo path.
- No edits to `core/` or `actions/engine.py`.

## Final response

Report:

- files changed
- exact API baseline now enforced
- deterministic-persona mechanism used
- test command and result
- any handoff artifact for frontend mock parity

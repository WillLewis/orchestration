# CLAUDE.md — operating guide for Claude Code

You are working in the **ConnectWork Command Agent** prototype. Read the relevant directory
`README.md` and any task-specific docs under `docs/` before writing code. Current demo and
lifecycle context lives in `demo-walkthrough.html`, `docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md`,
and `docs/ACTION_LIFECYCLE.md`.

## Your lanes (Claude-owned)
WS-0 `core/` · WS-B `context/` · WS-D `brief/` · WS-E (loop + personas) `actions/` ·
WS-G (eval harness) `evals/` · WS-H `frontend/`.
Codex owns the deterministic/data lanes (`corpus/`, `verification/`, `lifecycle/`, `telemetry/`,
`recipes/`, the WS-E action engine). Don't edit those without a hand-off note in the PR.

## Non-negotiable rules
1. **Contracts are locked.** Do not edit `core/schemas.py` or `core/pipeline.py` on a feature
   branch. If a contract truly must change, open a small WS-0 PR titled `contract:` and flag it in
   the relevant task handoff or PR notes so Codex can rebase. Drift here breaks every parallel
   stream.
2. **Stay in your directory.** One owner per dir.
3. **Build against `fixtures/acme.py`** until the upstream stream lands; never block on another branch.
4. **Deterministic vs. probabilistic boundary.** The LLM interprets evidence and drafts language.
   It NEVER owns a pass/fail decision — approvals, calculations, policy gates, permission
   decisions, and schema validity belong to `verification/` (WS-C). Do not reimplement gates in
   the LLM layer.
5. **Permission filter runs before content enters context** (WS-B). Denied content never reaches a prompt.
6. **No raw content in telemetry.** `TelemetryEvent` forbids it by construction; keep it that way.
7. **Secrets:** read from `.env` via `python-dotenv`; never hardcode or commit keys.

## Conventions
- Python 3.11+, Pydantic v2, full type hints, small pure functions where possible.
- Every module you add ships unit tests in its own `tests/` and keeps `make test` green.
- `make lint` (ruff) clean before PR. Line length 100.
- Implement the relevant `core.pipeline` Protocol so the integrator can swap your stage in.
- Prefer model routing via env (`PLANNER_MODEL`, `PERSONA_MODEL`); don't hardcode model names.

## Definition of Done (per workstream)
Implements its Protocol · unit tests green · exposes a demo fixture (so the integrator can call
it on `fixtures.acme`) · updates its dir `README.md` with status + how to run.

## Useful commands
`make install` · `make test` · `make lint` · `make schemas-json` · `make eval`

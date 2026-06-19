# Contributing — ConnectWork Command Agent

Contract-first, then fan out. **WS-0** locks the typed contracts (`core/schemas.py`,
`core/pipeline.py`) and the shared `fixtures/` layer, then merges to `main`. After that, all
nine workstreams build **in parallel against the contracts and fixtures** — no stream waits for
another's runtime to exist. This file is the shared rulebook for both agents (Claude + Codex);
the per-agent guides are `CLAUDE.md` and `AGENTS.md`, the build plan is `WORKSTREAMS.md`.

## The non-negotiable rules

1. **Contracts are locked.** Do not edit `core/schemas.py` or `core/pipeline.py` on a feature
   branch. If a contract truly must change, open a small WS-0 PR titled `contract:` and flag it in
   `WORKSTREAMS.md` so the other agent can rebase. Drift here breaks every parallel stream.
2. **Stay in your directory.** One owner per dir (see the table in `WORKSTREAMS.md`). Don't edit
   another stream's dir without a hand-off note in the PR.
3. **Build against `fixtures/acme.py`** until the upstream stream lands. Never block on another
   branch. WS-A keeps `corpus.load("finance")` shape-compatible with `acme_workspace()`;
   WS-C's `verify(acme_bundle())` must reproduce `acme_expected_decision()`.
4. **Deterministic vs. probabilistic boundary.** The LLM interprets evidence and drafts language.
   It NEVER owns a pass/fail decision — approvals, calculations, policy gates, permission
   decisions, and schema validity belong to `verification/` (WS-C). Do not reimplement gates in
   the LLM layer, and never let a brief/action override a `DeterministicDecision`.
5. **Permission filter runs before content enters context** (WS-B). Denied content never reaches
   a prompt.
6. **No raw content in telemetry.** `TelemetryEvent` and `RedactedFailurePacket` forbid extra
   fields by construction — keep it that way. Redact client-side; aggregate with k-anonymity;
   add differential-privacy noise to aggregates.
7. **Secrets** come from `.env` via `python-dotenv` (see `.env.example`); never hardcode or
   commit keys. Route models via env (`PLANNER_MODEL`, `PERSONA_MODEL`, …); don't hardcode names.

## Conventions

- Python 3.11+, Pydantic v2, full type hints, small pure functions where possible.
- Line length 100. `make lint` (ruff) clean and `make test` green before every PR.
- Implement the relevant `core.pipeline` Protocol so the integrator can swap your stage in.
- Every module you add ships unit tests in its own `tests/`; name deterministic tests after the
  rule id they cover.

## Definition of Done (per workstream)

Implements its `core.pipeline` Protocol · unit tests green (incl. the `fixtures.acme`
expectations) · exposes a demo fixture so the integrator can call it on `fixtures.acme` ·
updates its dir `README.md` with status + how to run.

## Branches & merge order

Each workstream owns one branch (`wsX-…`). **Merge order:**
WS-0 → (A · B · C · G · H) → D · E · F → I → integration. Daily PRs into `main` behind the
contract; keep `make test` green on `main` at all times.

## Useful commands

```bash
make install        # pip install -e ".[dev]"
make test           # pytest
make lint           # ruff check .
make fmt            # ruff check . --fix
make schemas-json   # export core.schemas -> frontend/schemas.json (WS-H)
make run            # end-to-end demo pipeline over fixtures.acme (stubs)
make eval           # three-vertical eval proof (WS-G/WS-I)
```

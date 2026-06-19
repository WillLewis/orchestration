# ConnectWork Command Agent

Prototype for the Box "AI Agent Orchestration" case: a **governed work-orchestration agent**
that turns regulated enterprise conversations into **decision-ready context, safe actions, and
governed work products**, with **deterministic controls** where correctness is non-negotiable.
Hero vertical: **Financial Services** (credit/risk committee). Platform proof: the same
substrate runs **finance + legal + health** recipes through one eval scorecard.

> Full strategy is in `ConnectWork_Case_Plan_of_Attack_FINAL.md`. This repo is the build.

## Quickstart
```bash
make install        # pip install -e ".[dev]"
make test           # pytest — should be green from the start (WS-0 baseline)
make schemas-json   # export JSON Schema for the Lovable frontend
cp .env.example .env # then add your API keys
```

## How the work is split (contract-first, then fan out)
`core/schemas.py` + `core/pipeline.py` are the **locked contracts**. Every workstream owns one
directory and builds against the contracts + `fixtures/acme.py` (shared mock data), so streams
run in parallel without colliding. See `WORKSTREAMS.md` for the full plan and `CLAUDE.md` /
`AGENTS.md` for per-agent rules.

| Branch | Dir | Agent | Scope |
|---|---|---|---|
| `ws0-foundation` | `core/` `fixtures/` | Claude | contracts, interfaces, scaffolding, CI |
| `wsa-corpus` | `corpus/` | Codex | synthetic regulated workspace + legal/health stubs |
| `wsb-context` | `context/` | Claude | permission-aware retrieval, ContextBundle, claims |
| `wsc-verification` | `verification/` | Codex | rule/calc engine, approval matrix, schema validation |
| `wsd-brief` | `brief/` | Claude | Decision Brief synthesis |
| `wse-actions` | `actions/` | Codex + Claude | action composer, diffs, rollback + the loop |
| `wsf-lifecycle` | `lifecycle/` | Codex | revalidation / stale-state |
| `wsg-evals` | `evals/` `telemetry/` | Claude + Codex | eval harness + privacy telemetry |
| `wsh-frontend` | `frontend/` | Claude/Lovable | the 4 prototype surfaces |
| `wsi-recipes` | `recipes/` | Codex + Claude | per-vertical recipes + three-vertical proof |

**Merge order:** WS-0 → (A · B · C · G · H) → D · E · F → I → integration.

## Pipeline
```
intent → ContextAssembler(WS-B) → Verifier(WS-C) → BriefSynthesizer(WS-D)
       → ActionComposer(WS-E) → [human approval] → Executor(WS-E)
       → RevalidationEngine(WS-F) ⟲   |   EvalRunner(WS-G) + TelemetryEvent
```

## Rules that keep parallel work safe
1. **Don't edit `core/` on a feature branch.** Contract changes go through a WS-0 PR.
2. **Stay in your directory.** One owner per dir (table above).
3. **Build against `fixtures/acme.py`** until the upstream stream lands.
4. **Definition of Done:** implements your `core.pipeline` Protocol · unit tests green ·
   exposes a demo fixture · updates your dir `README.md`.

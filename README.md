# ConnectWork Command Agent

Prototype for the Box "AI Agent Orchestration" case: a **governed work-orchestration agent**
that turns regulated enterprise conversations into **decision-ready context, safe actions, and
governed work products**, with **deterministic controls** where correctness is non-negotiable.
Hero vertical: **Financial Services** (credit/risk committee). Platform proof: the same
substrate runs **finance + legal + health** recipes through one eval scorecard.

## Quickstart
```bash
make install        # pip install -e ".[dev]"
make test           # pytest suite
make lint           # ruff check .
make run            # end-to-end demo pipeline over fixtures.acme (stubs)
make eval           # three-vertical eval proof (finance + legal + health scorecard)
make schemas-json   # export JSON Schema for the frontend -> frontend/schemas.json
make serve          # FastAPI gateway for the frontend (api/main.py, port 8000)
cp .env.example .env # then add your API keys
```
**Frontend** lives in `frontend/` (vendored from Lovable — TanStack Start + React). It defaults
to bundled mocks (identical to the Lovable demo) and can fetch live from the gateway:
```bash
cd frontend && bun install && bun run dev    # mock data by default
# live: set VITE_USE_MOCKS=false + VITE_API_URL=http://localhost:8000 (see frontend/README.md)
```

## Architecture
`core/schemas.py` and `core/pipeline.py` define the shared contracts for the agent pipeline.
Implementations build against those contracts and the shared `fixtures/acme.py` demo data.

## Pipeline
```
intent → ContextAssembler → Verifier → BriefSynthesizer
       → ActionComposer → [human approval] → Executor
       → RevalidationEngine ⟲   |   EvalRunner + TelemetryEvent
```

## Development
1. Keep schema and pipeline contract changes compatible with downstream stages.
2. Build end-to-end behavior against `fixtures/acme.py`.
3. Run `make test` and `make lint` before opening a PR.

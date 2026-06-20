# api/ — Integration layer (pipeline assembly + FastAPI gateway)

**Status: ✅ live.** Replaces the `core.demo` stub wiring at the API boundary with a real
orchestrator that composes the merged workstreams. No LLM calls, no network — deterministic and
offline. The deterministic engine stays authoritative: a model never owns a pass/fail decision,
and `/actions/execute` recomposes the gated plan server-side so a client can't bypass a gate.

## Layout
- [`orchestrator.py`](orchestrator.py) — composes the live stages (imports only; never reimplements
  a gate): WS-B context · WS-C verify · WS-D brief · WS-E actions · WS-F revalidation · WS-G/WS-I evals.
- [`models.py`](models.py) — request bodies + the `OpsReport` aggregate (shaped to `ops.ts`).
  Domain responses reuse `core.schemas` / `lifecycle.RevalidationResult` directly.
- [`main.py`](main.py) — FastAPI endpoints + CORS.
- [`export_openapi.py`](export_openapi.py) — writes `frontend/openapi.json` (`make openapi`).

## Endpoints
| Method | Path | Returns | Composes | Frontend surface (mock) |
|---|---|---|---|---|
| POST | `/brief` | `DecisionBrief` | WS-B→C→D | Brief / Decision Packet ([brief.ts](../frontend/src/data/brief.ts)) |
| POST | `/context` | `ContextBundle` | WS-B | (debug) |
| POST | `/verify` | `DeterministicDecision` | WS-C | (debug) |
| POST | `/actions/compose` | `ActionPlan` | WS-E (+B,C,D) | Action Diff Drawer ([actions.ts](../frontend/src/data/actions.ts)) |
| POST | `/actions/execute` | `list[AuditEvent]` | WS-E | Action Diff Drawer |
| POST | `/revalidate` | `RevalidationResult` | WS-F (+B,C,D) | Stale-decision alert |
| GET | `/ops/evals` | `OpsReport` | WS-I + WS-G | Agent Ops ([ops.ts](../frontend/src/data/ops.ts)) |
| GET | `/api/health` | `{ok}` | — | — |
| GET | `/api/brief` · `/api/actions` · `/api/meeting` · `/api/ops/scorecard` | dict | real-backed | compat shims for the currently-wired `queries.ts` |

Workspace note: the brief assembles over the canonical `fixtures.acme` workspace (surfaces the
missing covenant tracker, discount conflict, restricted legal-memo exclusion); action validation
runs against the richer WS-A `corpus.load("finance")` workspace, which carries both
information-barrier sides so the mosaic gate is exercised.

## Run
```bash
make api          # uvicorn api.main:app --reload --port 8000  (Swagger at /docs)
make openapi      # export frontend/openapi.json
pytest api/tests/ -q   # capstone E2E (offline, no key)
```

## Capstone ([tests/test_e2e.py](tests/test_e2e.py))
Proves through the HTTP boundary on the Acme scenario: brief is not approval-ready + omits the
restricted memo + surfaces missing evidence + the conflict; compose blocks mosaic and
missing-evidence actions and holds approval routes; execute runs only approved non-blocked actions
(**a gate is never overridden, even when a blocked index is approved**); revalidation marks the
approval sections stale and routes to legal; the three-vertical eval passes threshold with the one
intentional honest failure (`fin_ambig_01`) still visible; responses stay shape-compatible with the
frontend data modules.

## Next
The frontend live-data flip is the separate `prompts/lovable_integration_live_data.md`
(`VITE_USE_MOCKS=false`, point `VITE_API_URL` at this gateway; light brief → actions → ops).

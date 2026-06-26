# api/ — Integration layer (pipeline assembly + FastAPI gateway)

**Status: ✅ live.** Replaces the `core.demo` stub wiring at the API boundary with a real
orchestrator that composes the merged workstreams. No LLM calls, no network — deterministic and
offline. The deterministic engine stays authoritative: a model never owns a pass/fail decision,
and `/actions/execute` recomposes the gated plan server-side so a client can't bypass a gate.

## Layout
- [`orchestrator.py`](orchestrator.py) — composes the live stages (imports only; never reimplements
  a gate): WS-B context · WS-C verify · WS-D brief · WS-E actions · WS-F revalidation · WS-G/WS-I evals.
- [`chat.py`](chat.py) — the governed `/chat` answerer: drafts prose with an injectable LLM client
  but owns every governance check (permission, gate, citations, missing evidence) deterministically.
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
| POST | `/chat` | `ChatResponse` | WS-B→C (+ injectable LLM) | InputBar / "Ask about this packet" |
| POST | `/actions/compose` | `ActionPlan` | WS-E (+B,C,D) | Action Diff Drawer ([actions.ts](../frontend/src/data/actions.ts)) |
| POST | `/actions/execute` | `list[AuditEvent]` | WS-E | Action Diff Drawer |
| POST | `/revalidate` | `RevalidationResult` | WS-F (+B,C,D) | Stale-decision alert |
| POST | `/workproducts/mint` | `MintResponse` | WS-B→D + WS-F snapshot | Seal as governed record |
| GET | `/workproducts/{record_id}` | `GovernedRecord` | (in-memory store) | Governed-record page |
| POST | `/workproducts/{record_id}/verify` | `RecordVerification` | WS-F | Verify record (integrity/stale) |
| GET | `/ops/evals` | `OpsReport` | WS-I + WS-G | Agent Ops ([ops.ts](../frontend/src/data/ops.ts)) |
| GET | `/api/health` | `{ok}` | — | — |
| GET | `/api/brief` · `/api/actions` · `/api/meeting` · `/api/ops/scorecard` | dict | real-backed | compat shims for the currently-wired `queries.ts` |

Workspace note: the brief assembles over the canonical `fixtures.acme` workspace (surfaces the
missing covenant tracker, discount conflict, restricted legal-memo exclusion); action validation
runs against the richer WS-A `corpus.load("finance")` workspace, which carries both
information-barrier sides so the mosaic gate is exercised.

## Governed chat (`POST /chat`)
Answers questions about the meeting/decision using **only** the permission-filtered
`ContextBundle`. An LLM may draft prose, but `api.chat.answer` never returns the draft directly —
it rebuilds the `ChatResponse` through deterministic post-processing so the model can't move a gate:

- **Permission fail-closed** — a question about an excluded object (e.g. the legal memo) gets a
  deterministic restricted-source refusal; restricted content is never revealed/summarized/inferred.
  `permission_boundary_hit` is derived from `bundle.permission_boundary` + the request, not the model.
- **No gate override** — an approve/mark-ready/bypass request (or a model claiming approval) is
  neutralized to the authoritative gate-hold while `approval_ready` is False; `gate_held` is set
  deterministically and the reply offers the safe path (route to the missing approver).
- **Grounded citations only** — every citation is validated against `bundle.sources`; hallucinated,
  excluded, or history-introduced ids are dropped. Returned as `list[SourceRef]`.
- **Missing-evidence honesty** — `missing_evidence` mirrors `bundle.missing_evidence`; when asked,
  the reply states the item is missing/unavailable and was not reviewed.
- **Injection-resistant** — the message and history are untrusted; the prompt tells the model to
  ignore embedded instructions, and the wrapper enforces every gate regardless. History is
  conversational context only — never evidence.

The LLM client is injectable (`ChatLLMClient` protocol). The default `DeterministicChatClient` is
**offline** (no key), so the suite is reproducible; `LLMChatClient` is opt-in and used only when
both `CHAT_MODEL` and `ANTHROPIC_API_KEY` are set (model name comes from env, never hardcoded).

## Docs chat (`POST /docs/chat`)
Answers over the documentation corpus with chunk-level retrieval. `api.docs_corpus.load_docs()`
keeps the legacy document shape unchanged; `load_chunks()` adds ACL-safe retrieval units from the
curated markdown files plus the Phase-0 `pages.fixture.json` section records. Public page sections
return anchored citations, locked chunks carry metadata with empty text, and sealed chunks expose
only their cleared derivative.

The `/docs/chat` ranker extends the #13 heuristic to chunks: curated name hits, length-normalized
body hits, sealed-topic bonus, exact multi-token phrase bonus, and a relevance threshold. If no
chunk clears the threshold, the endpoint returns `status="no_results"`. Answer confidence is a
pure deterministic band (`grounded` / `partial` / `weak`) derived from ranking margin, query-aspect
coverage, threshold status, missing coverage, and safe support count; model output never affects it.

## Governed record (`POST /workproducts/mint` · `/verify`)
Seals a decision packet into a **governed record** ([`workproducts.py`](workproducts.py)) — the
governed work product, made literal. The record is a point-in-time artifact carrying the decision,
deterministic gate results, evidence, permission omissions, a snapshot of the **source versions** it
was built from, and a **server-minted HMAC integrity seal**. It composes the live brief + gate
(never re-authoring a gate) and runs **no actions and no loop**. Three independent trust axes:

- **integrity** — `verify` re-HMACs the sealed canonical bytes; tampering flips `integrity_valid`.
- **freshness** — `verify` applies a source-change event and reuses WS-F revalidation: e.g.
  `legal_needs_review` flips `freshness` to `stale`, reports the changed field
  (`wf_approval.legal_status: pending → Needs Review`), and routes reapproval to Legal.
- **approval-readiness** — the deterministic gate, unchanged; the Acme record stays NOT approval-ready.

Honesty boundary: the seal is **symmetric** (HMAC) — this server verifies its *own* seal, proving the
record is unaltered since it minted it. Independent third-party verification would require asymmetric
signing (the upgrade path). The key is read from `WORKPRODUCT_SECRET` (a non-secret demo fallback
keeps tests/CI offline). The store is in-memory (demo only). Shape-compatible with
`frontend/src/data/record.ts` (the Lovable governed-record page).

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

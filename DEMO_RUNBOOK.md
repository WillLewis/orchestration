# Demo Runbook

Pre-flight this from the repo root before the panel.

1. Start the backend gateway on `:8000`.

   ```bash
   make serve
   ```

   Leave that terminal running. The Makefile target runs:

   ```bash
   uvicorn api.main:app --reload --port 8000
   ```

2. Confirm the gateway is up with the real health endpoint from `api/main.py`.

   ```bash
   curl -sS http://localhost:8000/api/health
   ```

   Expected response:

   ```json
   {"ok":true}
   ```

3. In a second terminal, start the frontend on Vite's default dev port, `:5173`.

   ```bash
   cd frontend
   bun install
   bun run dev
   ```

   Open the URL printed by Vite. In this repo there is no custom dev-server port in
   `frontend/vite.config.ts`, so the normal local URL is:

   ```text
   http://localhost:5173
   ```

4. From the repo root in another terminal, confirm mocks are on for the reliable interview path.

   ```bash
   if test -f frontend/.env.local; then
     grep -E '^VITE_USE_MOCKS=true$' frontend/.env.local
   else
     echo "no frontend/.env.local; mocks stay on unless VITE_USE_MOCKS=false is exported"
   fi
   ```

   Safe default: `frontend/src/hooks/queries.ts` only goes live when
   `VITE_USE_MOCKS=false` and `VITE_API_URL` is non-empty. The current local demo setting is
   `VITE_USE_MOCKS=true`; `VITE_API_URL=http://localhost:8000` can stay present because mocks still
   win unless `VITE_USE_MOCKS` is explicitly `false`.

5. Open the browser and confirm the key surfaces load.

   ```text
   http://localhost:5173/          Meeting + ConnectAgent side panel
   http://localhost:5173/packet    Decision Packet workspace
   http://localhost:5173/loop      Agent Batch orchestration
   http://localhost:5173/ops       Agent Ops / eval scorecard
   ```

   Also click `Agent Actions` from the app top bar or Decision Packet to confirm the action diff
   drawer opens.

## LLM Toggle Smoke Matrix

Use this matrix to decide which docs-chat questions to ask live. The goal is not for every prompt
to return LLM prose; the goal is to prove the toggle is real, governed fields stay deterministic,
guard fallback works, and no-results stays honest.

Prerequisites: backend running on `:8000`, `ANTHROPIC_API_KEY` set, and `CHAT_MODEL` configured
either in the shell or `.env`. The backend may report a model even if the shell has
`CHAT_MODEL=unset`, because `api/docs_chat.py` loads `.env` at import time.

Readiness labels:

- **Safe for stage:** use this in the live demo when prerequisites are met.
- **Works but not preferred:** useful backup or safety narration, but not the main toggle proof.
- **Needs live approval:** do not run against the external LLM provider until explicitly approved in
  the active thread.
- **Blocked:** do not demo until the listed blocker is resolved.

| Case | Question / Probe | Readiness | Expected current result | Purpose |
|---|---|---|---|---|
| Refusal / fail-closed | `When does the agent refuse to act?` | Works but not preferred; needs live approval for LLM mode | Safe fake-client paraphrases can return `effective_mode=llm`; live prose may also fall back with `fallback_reason=grounding_guard`. Either is acceptable only if governed fields match deterministic mode. | Shows fail-closed safety and discard-on-drift behavior. |
| Sealed record | `What happens after a record is sealed?` | Works but not preferred; needs live approval for LLM mode | Safe fake-client paraphrases can return `effective_mode=llm`; live prose may also fall back with `fallback_reason=grounding_guard`. Raw sealed spans must never appear. | Shows sealed derivatives and stable governed fields. |
| Restricted source | `How does the agent handle restricted source material?` | Safe for stage; needs live approval for LLM mode | With live LLM configured and approved: `effective_mode=llm`, `fallback_reason=null`. Without config: deterministic `not_configured`. | Main visible LLM-toggle proof: prose changes while governed fields remain fixed. |
| Unrelated / no-results | `What is the cafeteria menu for next Tuesday?` | Safe for stage | `status=no_results`, `citations=[]`, `effective_mode=deterministic`. `fallback_reason` should stay null when the model is configured because no evidence is sent. | Shows honest no-results behavior. |
| Unavailable path | Unset `CHAT_MODEL` and/or `ANTHROPIC_API_KEY`, then ask any grounded question with `mode="llm"` | Safe for stage | `effective_mode=deterministic`, `llm_available=false`, `fallback_reason=not_configured`. | Shows the backend fails closed when LLM phrasing is unavailable. |
| Backend unreachable | Stop `make serve`, then use the frontend docs-chat UI | Works but not preferred | Frontend shows offline/backend fallback instead of claiming LLM prose. | Backup explanation for local demo setup failure. |
| Full live smoke | Run the live LLM matrix against the configured provider | Blocked until explicit approval | Do not run from WS-L0 without approval. | Sends ACL-filtered docs context to the external provider. |

Manual probe for a single question:

```bash
curl -sS localhost:8000/docs/chat \
  -X POST \
  -H 'content-type: application/json' \
  -d '{"surface":"chat","message":"How does the agent handle restricted source material?","mode":"llm"}' \
  | jq '{status, phrasing, citations, confidence, missing, response}'
```

Real demo failures:

- The restricted-source toggle question returns `not_configured` or `client_error`: live LLM path
  is not proven.
- Any question changes governed fields between deterministic and LLM mode:
  `status`, `citations`, `confidence`, or `missing`.
- The unrelated/no-results question returns citations or `status!="no_results"`.
- Any raw locked source body or raw sealed span appears in a response, prompt log, telemetry event,
  or UI citation snippet.

Acceptable safety behavior:

- Refusal or sealed-record questions returning `grounding_guard` are not demo failures when
  governed fields match. That proves the wrapper discarded prose it did not trust and kept the
  deterministic answer surface stable.

## Optional Go Live

Use this only when you want the frontend to fetch from the FastAPI gateway instead of bundled
mocks.

1. Update `frontend/.env.local`.

   ```bash
   VITE_USE_MOCKS=false
   VITE_API_URL=http://localhost:8000
   ```

2. Restart the frontend dev server.

   ```bash
   cd frontend
   bun run dev
   ```

3. Confirm live data is reaching the gateway.

   In the browser Network tab, reload `http://localhost:5173/packet` and confirm requests to
   `http://localhost:8000/api/brief` and `http://localhost:8000/api/actions`.

   You can also confirm the gateway responses directly:

   ```bash
   curl -sS http://localhost:8000/api/brief | head -c 200
   curl -sS http://localhost:8000/api/ops/scorecard | head -c 200
   ```

   The Ops scorecard should report finance `5/6`, legal `2/2`, and health `2/2`;
   `/ops/evals` should show `fin_ambig_01` as the single visible failed row.

## Fallback

If anything breaks live, fall back to the 75-second recording + screenshots and keep narrating the
same governed-agent arc.

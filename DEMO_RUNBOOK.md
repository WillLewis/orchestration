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

| Question | Use in demo? | Expected current result | Purpose |
|---|---:|---|---|
| `When does the agent refuse to act?` | Optional | `effective_mode=deterministic`, `fallback_reason=grounding_guard` | Shows discard-on-drift safety; governed fields must still match deterministic mode. |
| `What happens after a record is sealed?` | Optional | `effective_mode=deterministic`, `fallback_reason=grounding_guard` | Shows guard fallback on sealed-record wording; governed fields must still match deterministic mode. |
| `How does the agent handle restricted source material?` | Yes | `effective_mode=llm`, `fallback_reason=null` | Main visible LLM-toggle proof: prose changes while governed fields remain fixed. |
| `What is the cafeteria menu for next Tuesday?` | Yes | `status=no_results`, `effective_mode=deterministic`, `fallback_reason=null` | Shows honest no-results behavior. |

Manual probe for a single question:

```bash
curl -sS localhost:8000/docs/chat \
  -X POST \
  -H 'content-type: application/json' \
  -d '{"surface":"chat","message":"How does the agent handle restricted source material?","mode":"llm"}' \
  | jq '{status, phrasing, citations, confidence, missing, response}'
```

Real demo failures:

- Q3 returns `not_configured` or `client_error`: live LLM path is not proven.
- Any question changes governed fields between deterministic and LLM mode:
  `status`, `citations`, `confidence`, or `missing`.
- Q4 returns citations or `status!="no_results"`.

Acceptable safety behavior:

- Q1 or Q2 returning `grounding_guard` is not a demo failure when governed fields match. It proves
  the wrapper discarded prose it did not trust and kept the deterministic answer surface stable.

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

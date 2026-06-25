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

## Fallback

If anything breaks live, fall back to the 75-second recording + screenshots and keep narrating the
same governed-agent arc.

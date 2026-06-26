# frontend/ — WS-H (vendored from Lovable)

The four prototype surfaces — (1) meeting side panel, (2) decision packet workspace,
(3) action diff drawer, (4) Agent Ops / Eval proof — built in Lovable and **vendored** here as a
flat copy of the app.

- **Upstream / design library:** https://github.com/WillLewis/command-companion
  (live demo: https://govern-meeting-view.lovable.app). Design iteration continues in Lovable;
  to pull design updates, re-copy the tree and re-apply the data-layer swap (below).
- **Stack:** TanStack Start + React 19 + shadcn/ui + Tailwind v4, run with **Bun**.

## Run

```bash
cd frontend
bun install
bun run dev      # dev server (URL printed on start)
bun run build    # production build
```

## Docs corpus extractor

Developer docs anchors and corpus JSON are generated from rendered `/developers/*` routes:

```bash
cd frontend
bun test tests/docs-extractor.test.tsx
bun run scripts/extract-docs.ts
```

The extractor writes `../api/docs_corpus/generated/pages.json`. CI regenerates this file and fails
if it differs from the committed output.

## Data layer (mocks ↔ live API)

Surfaces read through React Query hooks in `src/hooks/queries.ts`. By default they serve the
bundled mocks in `src/data/*.ts` — visually identical to Lovable. To fetch live from the backend
gateway (`api/main.py`, run with `make serve` from the repo root):

```bash
# frontend/.env.local
VITE_API_URL=http://localhost:8000
VITE_USE_MOCKS=false
```

Mock shapes mirror `core/schemas.py` (snake_case), so the live API returns the same shapes with no
remapping. UI-only fields (`status`, `SourceStatus`, `SourceType`) are derived client-side and are
**not** part of the frozen `core.schemas` contract.

The `/developers/ui-chat`, `/developers/ui-meetings`, and
`/developers/ui-decision-brief` docs insets are live by default against `POST /docs/chat`; if the
gateway is unavailable, the inset falls back to its bundled demo-safe mocks. Set
`VITE_DOCS_CHAT_MOCKS=true` to pin those docs insets to mocks while preserving the same UI path.

## Demo runbook

Keep `VITE_USE_MOCKS=true` for the interview walkthrough. Mock mode powers the scripted hero arc
end-to-end: the 22% chat block, Credit Officer signoff, live revalidation, cascade edit, Agent
Actions drawer, Agent Batch handoff, and governed-record epilogue stay deterministic. Live API mode
(`VITE_USE_MOCKS=false`) is for proving the backend contracts and eval endpoints against the same
UI shapes.

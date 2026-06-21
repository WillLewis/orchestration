# Revalidation demo — live-parity hand-off

The "governed change" arc (chat block → route to CO → CO signs off → brief recomputes → cascade edit →
follow-ups → loop) ships **mock-first**: it runs end-to-end under `VITE_USE_MOCKS` with pinned,
deterministic outcomes and is the demo path. This doc is the **coordination note** for wiring the *live*
gateway (`make api`) to recompute the same states — enrichment only, never load-bearing for the panel.

## Done (in this change)
- **Track A (frontend hero, mock):** `lib/revalidation-store.ts` (stage machine + `useGovernedBrief()`
  overlay) drives the recompute across the meeting rail, the shared memo, and the packet. Verified.
- **Track B (live chat, api lane — Claude):** `POST /chat` now returns the deterministic 22%
  **discount-application block** with three `actions` (Explain · Route to Credit Officer · use the capped
  max) and the permission-aware **"why does this need approval?"** explanation. The numbers come from the
  deterministic `approval_threshold` firing; `ChatResponse.actions` added to `api/models.py`; covered by
  `api/tests/test_chat_endpoint.py`. This is genuine live governance — run `make api` (offline,
  deterministic, no key) and the frontend in live mode to see it.
- **Corpus primitive (WS-A / Codex lane — added with this hand-off note):**
  `corpus.apply_change(objects, "credit_officer_signoff")` flips `wf_approval.credit_officer_approval` to
  `True` and stamps `doc_pricing_exception` CO-approved (`approved_by_role="credit_officer"`,
  `approver_authority=0.25`). Mirrors the existing `financials_v2` / `legal_needs_review` events; tested in
  `tests/test_corpus.py`.

## Remaining for full live gate-clearing + cascade parity
Owners in parentheses (CLAUDE.md lanes). None require a `core/` contract change.

1. **Assemble the demo brief over the corpus workspace** *(context/ + api — Claude).* The brief currently
   assembles over `fixtures.acme.acme_workspace` (6 objects, **no** `doc_pricing_exception`/`doc_cs_plan`).
   For the live conflict/cascade to match the mock, build the revalidation bundle over
   `corpus.load("finance")`. Do this in a **local** assembler in the new endpoint (below) —
   `PermissionAwareContextAssembler(workspace_loader=lambda: changed_objs)` — do **not** repoint the shared
   `_assembler` singleton (it backs `/brief`). Confirmed: for `u_rm` both docs are readable and `"discount"`
   ∈ `FINANCE_CREDIT_RECIPE.conflict_probe_keys`, so the metadata conflict probe yields the same
   `[doc_pricing_exception, doc_cs_plan]` pairing as the mock.

2. **Feed the post-sign-off facts to the verifier via `SourceRef.span`** *(context/ — Claude).*
   `verification/facts.py::extract_facts` reads facts **only** from `source.span` JSON
   (`{"verification": {...}}`), merging them **over** the hardcoded `_acme_fixture_facts()` fallback
   (`facts = {**_acme_fixture_facts(), **span_facts}` — span wins). The assembler never sets `span` today.
   For the `credit_officer_signoff` bundle, the assembler (or the endpoint, post-assembly, in api) should
   embed on the `wf_approval` source:
   ```json
   {"verification": {"approvals": {"relationship_manager": true, "credit_officer": true, "legal": false},
                     "approval_threshold": {"requested_discount": 0.22, "delegated_authority": 0.25}}}
   ```
   Then `verify()` clears `missing_approver` and `approval_threshold` deterministically — **no
   `verification/engine.py` rule change** (the fact approach; the corpus event already carries
   `approver_authority=0.25`).

3. **⚠️ Keep the recompute HONEST — `approval_ready` must stay `False`** *(verification/ facts — Codex).*
   This is the subtle part. In the *fixture* facts, the **only** blocking gates are `missing_approver` and
   `approval_threshold`; clearing both would (wrongly) flip `approval_ready` to `True`. The narrative
   requires it to stay **False** (covenant tracker missing + Legal pending). So the post-sign-off facts
   must ALSO carry a still-failing blocking gate:
   - `required_documents`: include `final_covenant_tracker` (absent from sources) → `required_document_checklist` fails; and/or
   - `blocking_required_roles`: include `legal` (still `present:false`) → `missing_approver` still fails for Legal.
   Without this, the live recompute contradicts the demo. The mock overlay already encodes the correct
   pinned outcome; the live facts must match it.

4. **`POST /revalidate-brief` (or `/demo/revalidation/step`)** *(api — Claude).* Body `{user_id, intent,
   event}`. For `event="credit_officer_signoff"`: apply the corpus change → local corpus-bound assembler →
   embed the span facts (2) incl. the still-blocking gate (3) → `verify` → `synthesize` → return the
   recomputed `DecisionBrief`. The frontend `useGovernedBrief()` overlay already applies on top of either
   mock or live brief data, so live mode converges on the same UI.

5. **Cascade live parity** *(lifecycle/ + actions/ — Codex).*
   - `lifecycle/revalidation.py`: detect that the CO-approved `doc_pricing_exception` (22%) makes
     `doc_cs_plan` (18%) stale/conflicting and emit a reconciliation route.
   - `actions/engine.py` + ToolCards: register an `edit_document` ToolCard (`write`, low risk). **Verify
     first** whether the missing-evidence gate blocks a *reconciliation* write or only *decision-advancing*
     writes; if it blocks all writes while the covenant tracker is missing, add a carve-out so the
     `edit_document` cascade edit is executable-after-acceptance while decision-advancing writes stay
     blocked. (`Action.tool` is a free `str` in core — no contract change.)

## Why this is a hand-off, not done here
Steps 3 and 5 live in Codex-owned lanes and turn on verification-fact semantics (which gates stay blocking)
and the action engine's remediation classification. Getting them wrong silently flips `approval_ready` or
blocks the cascade edit. The mock demo already proves the exact honest behavior, so the live path is
enrichment — best implemented by the lane owners against the spec above rather than guessed under the
contract. Flag this file from the PR and in `WORKSTREAMS.md`.

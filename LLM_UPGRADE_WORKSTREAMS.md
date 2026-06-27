# LLM Upgrade Workstreams

This document is the shareable handoff for asynchronous LLM-upgrade threads. Give each thread the
shared rules plus exactly one workstream section. Workstreams should make narrow, independently
reviewable changes and avoid editing each other's files unless explicitly coordinated.

## Shared Context

The target system is `/docs/chat`.

Current state:

- Live LLM path works when configured.
- Governed fields must remain deterministic:
  - `status`
  - `citations`
  - `confidence`
  - `missing`
- Public LLM metadata is carried in `phrasing`.
- The restricted-source question is the primary visible LLM toggle proof:
  `How does the agent handle restricted source material?`
- Refusal and sealed-record questions are valid safety probes but are not the preferred live toggle
  proof.
- The unrelated/no-results question should remain `no_results` with no citations:
  `What is the cafeteria menu for next Tuesday?`
- Live LLM smoke requires explicit user approval because ACL-filtered docs context is sent to the
  configured external LLM provider.

## Shared Rules

- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not hardcode secrets or model names.
- Do not commit `.env` changes.
- Do not print API keys or raw environment dumps.
- Do not log raw prompts, raw documents, raw model responses, transcripts, secrets, or restricted
  content by default.
- Do not add raw content fields to telemetry.
- Do not make the LLM authoritative for citations, confidence, missing evidence, or status.
- Before handoff, run focused tests plus `make test` and `make lint`, unless the workstream is
  docs-only.

## Status Labels

- `Planned`: no accepted implementation has been recorded by WS-L0.
- `Partial`: code or tests appear to cover part of the scope, but acceptance is incomplete or not
  verified by WS-L0.
- `Needs verification`: implementation appears present, but the owning thread has not handed off
  test results.
- `Complete`: owning thread handed off passing verification and docs are aligned.
- `Blocked`: cannot proceed without another workstream, approval, or external state.

## Coordination Table

| Workstream | Owner | Area | Primary Files | Parallel With | Status |
|---|---|---|---|---|---|
| WS-L0 | Coordination/docs thread | Planning and demo readiness | `LLM_UPGRADE_PLAN.md`, `LLM_UPGRADE_WORKSTREAMS.md`, `DEMO_RUNBOOK.md`, `prompts/llm_upgrade_ws_l*.md` | All | Complete; live smoke run with demo gap |
| WS-L1 | Eval harness thread | Offline docs-chat evals | `api/tests/`, optional fixtures under `api/` | WS-L2, WS-L3, WS-L5, WS-L6 | Complete |
| WS-L2 | Retrieval thread | Deterministic retrieval quality | `api/docs_chat.py`, `api/tests/` | WS-L1, WS-L3 with coordination | Complete |
| WS-L3 | Guard thread | Grounding guard and diagnostics | `api/docs_chat.py`, `api/tests/` | WS-L1, WS-L2 with coordination | Complete |
| WS-L4 | Prompt/runtime thread | Prompt and live-client reliability | `api/docs_chat.py`, `api/tests/` | After WS-L3 diagnostics begin | Complete |
| WS-L5 | Frontend demo thread | Toggle and fallback UX | `frontend/src/components/docs/`, `frontend/tests/`, `DEMO_RUNBOOK.md` | WS-L1, WS-L6 | Complete |
| WS-L6 | Observability thread | Privacy-safe aggregate telemetry | `telemetry/`, `api/`, tests | WS-L1, WS-L5 | Complete |

## Current Coordination Notes

- WS-L1 is complete: `api/tests/test_docs_chat_eval.py` freezes Q1-Q4 governed fields,
  fake-client acceptance, `not_configured`, `client_error`, `grounding_guard`, and no-results
  behavior.
- WS-L2 is complete: retrieval now resolves refusal, sealed-record, restricted-source, policy-gate,
  RAG, and unrelated no-results questions without relying on generic `vision` matches.
- WS-L3 is complete: `_grounding_guard()` returns local-only structured diagnostics with categories
  and counts, while the public API continues to expose only `fallback_reason`.
- WS-L4 is complete: live-client setup includes bounded timeout, one wrapper-level retry for
  transient errors, redacted diagnostics, and deterministic `client_error` fallback. Tests use fake
  Anthropic/client paths only.
- WS-L5 is complete for automated verification: the docs-chat inset static-render test covers
  `/developers/ui-chat`, `/developers/ui-meetings`, and `/developers/ui-decision-brief` states.
  Browser walkthrough remains a demo pre-flight item.
- WS-L6 is complete for current acceptance: `/docs/chat` records aggregate counters only, exposes
  `/ops/docs-chat`, and rejects raw-content fields. Per-guard-category telemetry is intentionally
  not exposed in the public response shape.
- Live LLM smoke was approved and run by WS-L0 on 2026-06-27. Safety checks passed, but the
  primary restricted-source visible-toggle question fell back with `grounding_guard`, so it is not
  accepted-prose demo-ready.

## Final Offline Verification

WS-L0 ran the final offline integration pass on 2026-06-27. Artifact:
`.context/ws-l0-final-integration.md`.

- `python -m pytest api/tests/test_docs_chat.py -q` -> 69 passed
- `python -m pytest api/tests/test_docs_chat_eval.py -q` -> 18 passed
- `python -m pytest api/tests/test_docs_chat_telemetry.py tests/test_privacy.py -q` -> 20 passed
- `bun test tests/docs-chat-inset.test.tsx` -> 24 passed
- `make test` -> 428 passed
- `make lint` -> all checks passed
- `git diff --check` -> passed
- Safe unavailable-path HTTP check with `CHAT_MODEL=` and `ANTHROPIC_API_KEY=` -> HTTP 200,
  `status="answered"`, `effective_mode="deterministic"`, `llm_available=false`,
  `fallback_reason="not_configured"`

Live-smoke result:

- Artifact: `.context/ws-l0-live-smoke.md`.
- Explicit user approval was recorded in this thread before external provider calls.
- Q1 refusal, Q2 sealed-record, and Q3 restricted-source all returned safe deterministic fallback
  with `fallback_reason="grounding_guard"` and stable governed fields.
- Q4 no-results remained `status="no_results"` with no citations.
- A direct backup policy-gate probe accepted live LLM prose once, but follow-up endpoint probes
  fell back. Treat accepted live prose as not reliable enough for the visible demo until tuned and
  retested.

## Thread Prompts

Use one prompt per async thread:

- WS-L0: `prompts/llm_upgrade_ws_l0.md`
- WS-L1: `prompts/llm_upgrade_ws_l1.md`
- WS-L2: `prompts/llm_upgrade_ws_l2.md`
- WS-L3: `prompts/llm_upgrade_ws_l3.md`
- WS-L4: `prompts/llm_upgrade_ws_l4.md`
- WS-L5: `prompts/llm_upgrade_ws_l5.md`
- WS-L6: `prompts/llm_upgrade_ws_l6.md`

## WS-L0: Coordination And Demo Readiness

### Owner

Coordination/docs thread.

### Mission

Keep the upgrade coherent across threads. Maintain the source-of-truth docs, demo readiness
matrix, integration order, and final smoke checklist.

### Scope

- Maintain this workstreams document.
- Maintain `LLM_UPGRADE_PLAN.md`.
- Keep `DEMO_RUNBOOK.md` aligned with observed behavior.
- Maintain `prompts/llm_upgrade_ws_l*.md`.
- Track baseline and final smoke results.

### Out Of Scope

- No backend product behavior changes.
- No frontend product behavior changes.
- No telemetry implementation changes.
- No live LLM smoke without explicit user approval.

### Acceptance

- Each workstream has owner, scope, out-of-scope list, acceptance criteria, and verification
  guidance.
- Demo readiness distinguishes safe for stage, works but not preferred, blocked, and needs live
  approval.
- Final acceptance criteria in `LLM_UPGRADE_PLAN.md` are checked.

### Verification Guidance

- For docs-only changes, run `git diff --check`.
- If code changes are made by user redirect, run the focused tests for that code path plus
  `make test` and `make lint`.

## WS-L1: Docs-Chat Eval Harness

### Owner

Eval harness thread.

### Mission

Create offline, deterministic eval coverage for docs-chat so retrieval and guard behavior can be
tuned safely.

### Scope

- Add eval cases for:
  - refusal / fail-closed
  - sealed records
  - restricted source handling
  - policy gate / `blocks_commit`
  - private-first permissions
  - RAG / ContextBundle
  - no-results
- Check expected `status`, citation doc ids, access classes, and governed-field stability.

### Suggested Files

- `api/tests/test_docs_chat_eval.py`
- optional test fixture near existing docs-chat tests

### Out Of Scope

- No live LLM calls.
- No frontend changes.
- No production telemetry.

### Acceptance

- Eval fails when generic `vision` chunks outrank expected governance docs for key questions.
- Eval fails when no-results questions return citations.
- Eval proves governed fields are stable under fake LLM clients.
- `python -m pytest api/tests/test_docs_chat*.py -q` passes.

### Verification Guidance

- Run `python -m pytest api/tests/test_docs_chat*.py -q`.
- Run `make test` and `make lint` before handoff unless explicitly scoped down by WS-L0.

## WS-L2: Retrieval Quality

### Owner

Retrieval thread.

### Mission

Improve deterministic retrieval so natural governance questions retrieve the right docs before the
LLM drafts prose.

### Scope

- Refine lexical scoring and aliases in `api/docs_chat.py`.
- Add domain aliases for:
  - refusal / refuse to act
  - fail closed
  - blocked action
  - sealed record
  - permission boundary
  - restricted source
  - missing evidence
  - stale record / revalidation
- Down-weight generic terms that over-select broad docs.

### Suggested Files

- `api/docs_chat.py`
- `api/tests/test_docs_chat.py`
- WS-L1 eval tests, if available

### Out Of Scope

- No embeddings.
- No external reranking services.
- No LLM query rewriting.
- No schema changes.

### Acceptance

- Refusal queries retrieve policy/gating/action support, not only `vision`.
- Sealed-record queries retrieve sealed-record support.
- Restricted-source queries retrieve permission/restricted-source support.
- Unrelated/no-results queries remain `no_results`.
- Existing sealed/locked permission tests still pass.

### Verification Guidance

- Run `python -m pytest api/tests/test_docs_chat.py -q`.
- If WS-L1 exists, also run `python -m pytest api/tests/test_docs_chat*.py -q`.
- Run `make test` and `make lint` before handoff unless coordinated otherwise.

## WS-L3: Grounding Guard And Debuggability

### Owner

Guard thread.

### Mission

Reduce false guard fallbacks while keeping hard safety behavior intact and making rejected drafts
diagnosable.

### Scope

- Refine `grounding_guard` support checks.
- Preserve hard rejects for raw locked/sealed content and forbidden control claims.
- Add local-only structured guard categories.
- Add fake-client tests for safe paraphrases and hostile drift.

### Suggested Files

- `api/docs_chat.py`
- `api/tests/test_docs_chat.py`

### Out Of Scope

- No raw rejected drafts in normal API responses.
- No raw rejected drafts in default logs.
- No public response schema change unless WS-L0 explicitly coordinates it.

### Acceptance

- Hostile raw sealed/locked drafts still fall back.
- Unsupported outside claims still fall back.
- Safe paraphrases pass when source support is adequate.
- Debug category logic can explain a rejection without exposing raw content by default.

### Verification Guidance

- Run `python -m pytest api/tests/test_docs_chat.py -q`.
- Add focused tests for each guard category implemented.
- Run `make test` and `make lint` before handoff unless coordinated otherwise.

## WS-L4: Prompt And Runtime Reliability

### Owner

Prompt/runtime thread.

### Mission

Make the live LLM draft more likely to pass the guard and make model failures boring.

### Scope

- Tune prompt instructions for concise, source-close prose.
- Ensure prompt tells the model not to invent examples, identifiers, numbers, citations, or hidden
  scoring details.
- Add timeout and one safe retry for transient provider failures if appropriate.
- Preserve deterministic fallback on client errors.

### Suggested Files

- `api/docs_chat.py`
- `api/tests/test_docs_chat.py`

### Out Of Scope

- No model-generated citations.
- No model-generated confidence.
- No model-generated missing fields.
- No hardcoded provider secrets.

### Acceptance

- Fake Anthropic/client tests cover timeout/error/retry behavior.
- `client_error` fallback preserves governed fields.
- Prompt tests verify model receives prose-only instructions and ACL-safe context.
- Live smoke may be run only after explicit approval.

### Verification Guidance

- Run `python -m pytest api/tests/test_docs_chat.py -q`.
- Do not run live LLM smoke unless the user explicitly approves it in that thread.
- Run `make test` and `make lint` before handoff unless coordinated otherwise.

## WS-L5: Frontend Demo Controls

### Owner

Frontend demo thread.

### Mission

Make the existing frontend LLM/deterministic toggle obvious and demo-safe.

### Scope

- Verify `/developers/ui-chat`, `/developers/ui-meetings`, and `/developers/ui-decision-brief`.
- Improve labels/tooltips only if needed.
- Ensure fallback states are clear:
  - LLM phrasing
  - deterministic
  - grounding fallback
  - LLM not configured
  - backend unreachable
- Keep `DEMO_RUNBOOK.md` aligned.

### Suggested Files

- `frontend/src/components/docs/DocsChatInset/DocsChatInset.tsx`
- `frontend/tests/docs-chat-inset.test.tsx`
- `DEMO_RUNBOOK.md`

### Out Of Scope

- No backend logic.
- No changes to main interview mock flow unless explicitly coordinated.

### Acceptance

- Restricted-source question visibly toggles between deterministic and LLM prose when backend is
  configured.
- Refusal/sealed-record fallback is labeled as safety fallback, not a broken toggle.
- Offline fallback is explicit.
- Frontend tests cover button labels and fallback-state copy.

### Verification Guidance

- Run the existing frontend test command from `frontend/README.md`.
- Browser-check `/developers/ui-chat`, `/developers/ui-meetings`, and
  `/developers/ui-decision-brief` when the frontend can be started locally.
- Run `make test` and `make lint` before handoff unless coordinated otherwise.

## WS-L6: Privacy-Safe Observability

### Owner

Observability thread.

### Mission

Add aggregate observability for docs-chat LLM behavior without raw content.

### Scope

- Track aggregate counts for:
  - requested mode
  - effective mode
  - fallback reason
  - response status
  - model configured yes/no
  - citation count buckets
  - guard category counts, if WS-L3 exposes them

### Suggested Files

- `telemetry/`
- `api/`
- relevant tests

### Out Of Scope

- No raw prompts.
- No raw responses.
- No raw document text.
- No transcript fields.
- No changes to `TelemetryEvent` that violate existing no-extra-fields constraints.

### Acceptance

- It is possible to answer "how often did `grounding_guard` fire?" without exposing content.
- Tests prove no raw prompt/response/document fields are emitted.
- README explains privacy boundary.

### Verification Guidance

- Run focused telemetry/API tests added by this workstream.
- Run existing privacy tests, for example `python -m pytest tests/test_privacy.py -q`.
- Run `make test` and `make lint` before handoff unless coordinated otherwise.

## Integration Order

1. WS-L0 kept documents current and recorded handoffs.
2. WS-L1 landed the offline regression baseline.
3. WS-L2 and WS-L3 finished and were verified together through `api/tests/test_docs_chat.py` plus
   eval coverage.
4. WS-L4 finished prompt/runtime reliability with fake-provider tests.
5. WS-L5 verified frontend demo states with the docs-chat inset static-render test.
6. WS-L6 wired aggregate-only telemetry after WS-L3 settled guard-category availability as
   local-only diagnostics.
7. WS-L0 ran final offline verification.
8. WS-L0 ran live smoke after explicit user approval and recorded the demo readiness gap.

## Final Merge Checklist

- [x] `python -m pytest api/tests/test_docs_chat.py -q` passes.
- [x] New docs-chat eval tests pass.
- [x] `bun test tests/docs-chat-inset.test.tsx` passes.
- [x] `make test` passes.
- [x] `make lint` passes.
- [x] `DEMO_RUNBOOK.md` has current readiness for refusal, sealed-record, restricted-source,
      unrelated/no-results, toggle, and unavailable-path cases.
- [x] Safe unavailable-path check returns deterministic `not_configured`.
- [x] Live smoke was not run without approval.
- [x] Live smoke approval is recorded before any external LLM call.
- [x] Live smoke results confirm governed fields are stable.
- [ ] Primary restricted-source live toggle returns accepted LLM prose. Observed: deterministic
      fallback with `grounding_guard`.
- [ ] Accepted LLM prose is reliable through `/docs/chat` endpoint smoke. Observed: direct backup
      accepted once; endpoint follow-up probes fell back.

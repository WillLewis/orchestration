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
- Q3, `How does the agent handle restricted source material?`, is the primary visible LLM toggle
  proof.
- Q1/Q2 may currently return `grounding_guard`; that is acceptable when governed fields match.
- Q4, `What is the cafeteria menu for next Tuesday?`, should remain `no_results`.

## Shared Rules

- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not hardcode secrets or model names.
- Do not commit `.env` changes.
- Do not log raw prompts, raw documents, raw model responses, transcripts, secrets, or restricted
  content by default.
- Do not add raw content fields to telemetry.
- Do not make the LLM authoritative for citations, confidence, missing evidence, or status.
- Live LLM smoke requires explicit user approval because ACL-filtered docs context is sent to the
  configured external LLM provider.
- Before handoff, run focused tests plus `make test` and `make lint`, unless the workstream is
  docs-only.

## Coordination Table

| Workstream | Area | Primary Files | Can Run In Parallel With | Status |
|---|---|---|---|---|
| WS-L0 | Coordination and docs | `LLM_UPGRADE_PLAN.md`, `LLM_UPGRADE_WORKSTREAMS.md`, `DEMO_RUNBOOK.md` | All | Planned |
| WS-L1 | Eval harness | `api/tests/`, optional fixtures under `api/` | WS-L2, WS-L3, WS-L5, WS-L6 | Planned |
| WS-L2 | Retrieval quality | `api/docs_chat.py`, `api/tests/` | WS-L1, WS-L3 with coordination | Planned |
| WS-L3 | Grounding guard | `api/docs_chat.py`, `api/tests/` | WS-L1, WS-L2 with coordination | Planned |
| WS-L4 | Prompt/runtime reliability | `api/docs_chat.py`, `api/tests/` | After WS-L3 diagnostics begin | Planned |
| WS-L5 | Frontend demo controls | `frontend/src/components/docs/`, `frontend/tests/`, `DEMO_RUNBOOK.md` | WS-L1, WS-L6 | Planned |
| WS-L6 | Privacy-safe observability | `telemetry/`, `api/`, tests | WS-L1, WS-L5 | Planned |

## Thread Prompts

Use one prompt per async thread:

- WS-L0: `prompts/llm_upgrade_ws_l0.md`
- WS-L1: `prompts/llm_upgrade_ws_l1.md`
- WS-L2: `prompts/llm_upgrade_ws_l2.md`
- WS-L3: `prompts/llm_upgrade_ws_l3.md`
- WS-L4: `prompts/llm_upgrade_ws_l4.md`
- WS-L5: `prompts/llm_upgrade_ws_l5.md`
- WS-L6: `prompts/llm_upgrade_ws_l6.md`

## WS-L0: Coordination And Baseline

### Mission

Keep the upgrade coherent across threads. Maintain the source-of-truth docs and decide when the
system is ready for final live smoke.

### Scope

- Maintain this workstreams document.
- Maintain `LLM_UPGRADE_PLAN.md`.
- Keep `DEMO_RUNBOOK.md` aligned with observed behavior.
- Track baseline and final smoke results.

### Deliverables

- Updated coordination table.
- Final merge checklist.
- Final smoke summary with artifact path.

### Out Of Scope

- No backend product behavior changes.
- No frontend product behavior changes.

### Acceptance

- Each completed workstream has status and verification notes.
- Final acceptance criteria in `LLM_UPGRADE_PLAN.md` are checked.

## WS-L1: Docs-Chat Eval Harness

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

## WS-L2: Retrieval Quality

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

- Q1 retrieves policy/gating/action support, not only `vision`.
- Q2 retrieves `sealed-records`.
- Q3 retrieves permission/restricted-source support.
- Q4 remains `no_results`.
- Existing sealed/locked permission tests still pass.

## WS-L3: Grounding Guard And Debuggability

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

## WS-L4: Prompt And Runtime Reliability

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

## WS-L5: Frontend Demo Controls

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

- Q3 visibly toggles between deterministic and LLM prose when backend is configured.
- Q1/Q2 fallback is labeled as safety fallback, not a broken toggle.
- Offline fallback is explicit.
- Frontend tests cover button labels and fallback-state copy.

## WS-L6: Privacy-Safe Observability

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

- It is possible to answer "how often did grounding_guard fire?" without exposing content.
- Tests prove no raw prompt/response/document fields are emitted.
- README explains privacy boundary.

## Integration Order

1. WS-L0 keeps documents current.
2. WS-L1 lands early as the regression baseline.
3. WS-L2 and WS-L3 run in parallel but coordinate on `api/docs_chat.py`.
4. WS-L4 starts once WS-L3 exposes enough guard diagnostics.
5. WS-L5 can run independently after the current demo toggle behavior is understood.
6. WS-L6 can run independently, constrained by telemetry privacy rules.
7. WS-L0 runs final offline verification.
8. WS-L0 runs live smoke only after explicit approval.

## Final Verification Checklist

- `python -m pytest api/tests/test_docs_chat.py -q`
- new docs-chat eval tests
- `make test`
- `make lint`
- safe unavailable-path HTTP check
- live LLM smoke with explicit approval

## Handoff Template For Each Thread

Use this when starting a workstream thread:

```text
You are working on <WORKSTREAM_ID> from LLM_UPGRADE_WORKSTREAMS.md.
Read AGENTS.md, README.md, api/README.md, LLM_UPGRADE_PLAN.md, and your workstream section.
Stay inside your scope and do not edit core/schemas.py or core/pipeline.py.
Do not log raw prompts, documents, model responses, transcripts, secrets, or restricted content.
Before handoff, run the focused tests plus make test and make lint unless your workstream is docs-only.
Report changed files, tests run, residual risks, and whether any coordination with WS-L0 is needed.
```

# LLM Upgrade Plan

This plan upgrades the `/docs/chat` LLM path without making the model authoritative. The LLM may
draft prose, but deterministic code must continue to own retrieval selection, citations,
confidence, missing evidence, response status, and fallback behavior.

## Current Repo Snapshot

As of the WS-L0 final offline integration pass on 2026-06-27:

- Live LLM mode remains opt-in for `/docs/chat` when `CHAT_MODEL` and `ANTHROPIC_API_KEY` are
  configured. The default and unavailable paths remain deterministic.
- `DEMO_RUNBOOK.md` is the source of truth for stage questions, fallback interpretation, and the
  approval-gated live-smoke checklist.
- WS-L1 added an offline eval harness in `api/tests/test_docs_chat_eval.py`; it freezes the demo
  questions at the governed-field boundary and verifies fake-client fallback stability.
- WS-L2 retrieval updates are present and verified for refusal, sealed-record, restricted-source,
  RAG/policy-gate, and unrelated no-results questions.
- WS-L3 grounding guard diagnostics are local-only, category/count based, and tested for accepted
  paraphrases, hard raw-content rejects, citation mismatch, missing locked-source refusal facts,
  unsupported numbers/identifiers, and empty drafts.
- WS-L4 prompt/runtime hardening is present and tested with fake clients for ACL-safe prompts,
  deterministic `client_error` fallback, redacted timeout diagnostics, bounded timeout, and one
  wrapper-level retry for transient provider errors.
- WS-L5 frontend docs-chat inset tests cover the three developer surfaces, live/off toggle labels,
  accepted LLM prose, deterministic fallback, `not_configured`, `grounding_guard`,
  `client_error`, backend-offline copy, and locked/sealed citation treatment.
- WS-L6 aggregate docs-chat telemetry is present in `telemetry/docs_chat.py`, exposed through
  `/ops/docs-chat`, documented in `telemetry/README.md`, and tested to exclude raw prompts,
  responses, documents, snippets, history, user messages, model names, and secrets.
- Final offline verification passed:
  - `python -m pytest api/tests/test_docs_chat.py -q` -> 69 passed
  - `python -m pytest api/tests/test_docs_chat_eval.py -q` -> 18 passed
  - `python -m pytest api/tests/test_docs_chat_telemetry.py tests/test_privacy.py -q` -> 20 passed
  - `bun test tests/docs-chat-inset.test.tsx` -> 24 passed
  - `make test` -> 428 passed
  - `make lint` -> all checks passed
  - safe unavailable-path HTTP check -> `effective_mode="deterministic"`,
    `llm_available=false`, `fallback_reason="not_configured"`
- Live LLM smoke was run by WS-L0 on 2026-06-27 after explicit user approval. The live provider was
  configured and called. Governed fields stayed stable, no-results stayed honest, and no raw
  locked/sealed markers were detected by the smoke script. The primary restricted-source demo
  question did not produce accepted LLM prose; it fell back with `fallback_reason="grounding_guard"`.
  A direct backup policy-gate probe accepted live LLM prose once, but follow-up endpoint probes
  fell back, so accepted live prose is not reliable enough for the visible demo yet.

## Goals

1. Improve real LLM prose quality and reliability for docs-chat.
2. Reduce false `grounding_guard` fallbacks for grounded paraphrases.
3. Improve deterministic retrieval for governance questions.
4. Add eval coverage so regressions are caught before demo.
5. Add privacy-safe observability for LLM behavior.
6. Preserve the proof that governed fields do not move between deterministic and LLM mode.

## Non-Goals

- Do not edit `core/schemas.py` or `core/pipeline.py`.
- Do not make the model generate citations, confidence, missing fields, or status.
- Do not add embeddings or external retrieval services in the first pass.
- Do not log raw prompts, raw documents, raw model responses, transcripts, secrets, or restricted
  content by default.
- Do not weaken locked, sealed, raw-content, or permission protections to make demo questions pass.

## Upgrade Phases

### Phase 1: Baseline And Evals

Create a deterministic docs-chat eval suite that captures the current demo and governance
questions. This should run offline and never call a live model.

Key checks:

- expected `status`
- expected citation doc ids
- expected citation access class
- expected fallback class when using fake LLM clients
- no-results stays citation-free
- governed fields stay byte-stable across deterministic and LLM-mode fake clients

### Phase 2: Retrieval Quality

Improve deterministic retrieval before prompt or model tuning. The retrieval layer should better
map natural governance questions onto the relevant docs sections.

Focus areas:

- domain aliases for refusal, fail-closed, blocked actions, sealed records, permission boundary,
  restricted sources, stale records, and missing evidence
- down-weight generic terms such as `agent`, `docs`, `source`, and `document`
- keep relevance threshold strict enough for unrelated questions

### Phase 3: Grounding Guard Debuggability

Make guard decisions explainable without exposing raw content. Add structured internal categories
for guard outcomes so tuning is evidence-based.

Target categories:

- `forbidden_control_claim`
- `raw_locked_marker`
- `raw_sealed_marker`
- `unsupported_number`
- `unsupported_identifier`
- `low_source_overlap`
- `empty_draft`

Normal API responses should continue to expose only the public `fallback_reason`.

### Phase 4: Prompt And Runtime Reliability

Tune the LLM prompt to produce guard-compatible prose and harden the live client.

Prompt guidance:

- one concise paragraph by default
- stay close to retrieved source wording
- do not invent examples, numbers, identifiers, or citations
- do not mention hidden scoring, retrieval internals, or confidence bands
- acknowledge unavailable information rather than guessing

Runtime reliability:

- request timeout
- one safe retry for transient provider errors if appropriate
- deterministic fallback on `client_error`
- tests with fake clients only

### Phase 5: Frontend Demo Clarity

Keep the existing docs-chat mode toggle clear and demo-safe. The UI should make these states easy
to distinguish:

- requested and effective LLM prose
- deterministic mode
- grounding fallback
- LLM not configured
- backend unreachable

The primary live-toggle demo should stay on `/developers/ui-chat`, but the specific visible proof
question should not be the restricted-source question until live smoke shows accepted LLM prose
reliably.

### Phase 6: Privacy-Safe Observability

Add aggregate-only observability so the team can answer operational questions without content
logging.

Useful counters:

- requested mode
- effective mode
- fallback reason
- response status
- model configured yes/no
- citation count buckets
- no-results count
- guard category counts, if available

No raw content should enter telemetry.

## Acceptance Criteria

Current final status:

- [x] `python -m pytest api/tests/test_docs_chat.py -q` passes.
- [x] New docs-chat eval tests pass.
- [x] `make test` passes.
- [x] `make lint` passes.
- [x] Safe unavailable-path HTTP check returns:
  - `effective_mode="deterministic"`
  - `llm_available=false`
  - `fallback_reason="not_configured"`
- [x] Live LLM smoke approval was recorded before any external provider call.
- [x] Live LLM smoke proved governed fields match deterministic twins for compared smoke questions.
- [x] Live LLM smoke proved no-results remains honest.
- [x] Live LLM smoke proved `grounding_guard` fallback preserves governed fields.
- [ ] Live LLM smoke proves the primary restricted-source demo question returns
      `effective_mode="llm"`. Observed result: deterministic fallback with
      `fallback_reason="grounding_guard"`.
- [ ] Live LLM smoke proves accepted LLM prose is reliable through the endpoint. One direct
      backup policy-gate probe accepted LLM prose, but follow-up endpoint probes fell back.

## Remaining Gaps

- The primary restricted-source visible-toggle proof is not live-demo-ready. It currently falls
  back with `grounding_guard` despite stable governed fields.
- Accepted live LLM prose is not reliable enough for a stage proof. Prompt/guard tuning should make
  a known stage question pass repeatedly through `/docs/chat` before the visible live-toggle demo.
- Browser visual walkthrough of `/developers/ui-chat`, `/developers/ui-meetings`, and
  `/developers/ui-decision-brief` was not repeated in this final WS-L0 pass. The static-render
  frontend test for those surfaces is passing and should be enough for code merge; run the browser
  walkthrough during demo pre-flight.
- Guard diagnostics are local-only category/count records. The aggregate telemetry currently
  exposes public fallback-reason counts, not per-guard-category counters. This preserves the
  no-public-schema-change boundary and is not a blocker for the current demo.

## Demo Policy

Use the demo matrix in `DEMO_RUNBOOK.md`.

- Do not use the restricted-source question as the visible LLM toggle proof until it returns
  accepted LLM prose reliably in live smoke.
- Use the unrelated/no-results question as the no-results proof.
- Use refusal and sealed-record questions only if you want to explain discard-on-drift or
  fail-closed behavior. They are not the preferred proof that the live toggle works.
- Do not present `grounding_guard` fallback as a broken toggle when governed fields match. It means
  the wrapper discarded prose it did not trust and kept the deterministic answer surface stable.

## Coordination

Implement this plan through `LLM_UPGRADE_WORKSTREAMS.md`. Each thread should own one workstream,
stay inside its scope, and avoid cross-workstream changes unless the coordination owner updates
the workstreams document.

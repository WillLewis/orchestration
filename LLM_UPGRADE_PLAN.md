# LLM Upgrade Plan

This plan upgrades the `/docs/chat` LLM path without making the model authoritative. The LLM may
draft prose, but deterministic code must continue to own retrieval selection, citations,
confidence, missing evidence, response status, and fallback behavior.

## Current Repo Snapshot

As of the WS-L0 coordination pass on 2026-06-26:

- Root coordination docs were missing from the repo and have been materialized from the attached
  plan/workstreams context.
- Live LLM mode is available for `/docs/chat` when `CHAT_MODEL` and `ANTHROPIC_API_KEY` are
  configured.
- `DEMO_RUNBOOK.md` exists and is the source of truth for live demo questions.
- Static inspection shows existing docs-chat tests for:
  - governed-field stability between deterministic and fake LLM clients
  - `not_configured`, `client_error`, and `grounding_guard` fallbacks
  - no-results behavior with no citations
  - safe paraphrases for refusal, sealed-record, and restricted-source questions
  - retrieval coverage for refusal and restricted-source questions
- Static inspection does not show a separate `api/tests/test_docs_chat_eval.py` harness, structured
  public guard categories, live-client timeout/retry coverage, or docs-chat aggregate telemetry.
- No live LLM smoke has been run by WS-L0. Any live LLM smoke still requires explicit user
  approval in the thread that runs it.

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

The primary live-toggle demo should stay on `/developers/ui-chat` using:
`How does the agent handle restricted source material?`

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

The upgrade is ready when all of these are true:

- `python -m pytest api/tests/test_docs_chat.py -q` passes.
- New docs-chat eval tests pass.
- `make test` passes.
- `make lint` passes.
- Safe unavailable-path HTTP check returns:
  - `effective_mode="deterministic"`
  - `llm_available=false`
  - `fallback_reason="not_configured"`
- Live LLM smoke, only after explicit user approval, proves:
  - at least one normal question returns `effective_mode="llm"`
  - governed fields match deterministic twins for all smoke questions
  - no-results remains honest
  - any `grounding_guard` fallback preserves governed fields

## Demo Policy

Use the demo matrix in `DEMO_RUNBOOK.md`.

- Use the restricted-source question as the visible LLM toggle proof.
- Use the unrelated/no-results question as the no-results proof.
- Use refusal and sealed-record questions only if you want to explain discard-on-drift or
  fail-closed behavior. They are not the preferred proof that the live toggle works.
- Do not present `grounding_guard` fallback as a broken toggle when governed fields match. It means
  the wrapper discarded prose it did not trust and kept the deterministic answer surface stable.

## Coordination

Implement this plan through `LLM_UPGRADE_WORKSTREAMS.md`. Each thread should own one workstream,
stay inside its scope, and avoid cross-workstream changes unless the coordination owner updates
the workstreams document.

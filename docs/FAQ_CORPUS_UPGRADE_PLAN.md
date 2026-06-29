# FAQ Corpus Upgrade Plan

## Summary

Upgrade the Markdown corpus that feeds the docs RAG and panel follow-up answers through five quality
passes. The goal is to make every answer accurate for the current architecture, easy for a Box
virtual panel to evaluate, and clear enough that Product, Engineering, and Design reviewers can
understand the primitives without repo context.

This plan is review-first. Workstream threads propose changes only. The user reviews the proposed
changes before any Markdown file is edited.

## Source Files In Scope

Curated docs RAG corpus:

- `api/docs_corpus/product-faq.md`
- `api/docs_corpus/engineering-faq.md`
- `api/docs_corpus/ux-faq.md`
- `api/docs_corpus/commercial-faq.md`
- `api/docs_corpus/sharp-followups-faq.md`
- `api/docs_corpus/design-rationale.md`
- `api/docs_corpus/gating.md`
- `api/docs_corpus/red-team-eval.md`
- `api/docs_corpus/employee-directory.md`
- `api/docs_corpus/revenue-fy26.md`

Architecture and demo Markdown:

- `docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md`
- `docs/ACTION_LIFECYCLE.md`
- `docs/REVALIDATION_LIVE_PARITY_HANDOFF.md`

Out of scope until approved:

- Generated files such as `api/docs_corpus/generated/pages.json`
- HTML mirrors such as `docs/ACTION_LIFECYCLE.html` and `docs/LIVE_STATUS_WIDGET.html`
- Frontend source docs, unless a workstream finds a contradiction that must be fixed at the source

## Current Architecture Facts

Use these as non-negotiable correction points:

- `Policy Artifact` is the product term.
- `RulePack` is the internal locked verifier schema / compiled rule subset only.
- Live meeting revalidation is lifecycle-event-derived through `/api/brief`.
- `/revalidate` is for sealed governed record/source-change verification, not the active meeting walkthrough.
- Decision Brief is the typed readiness and read/stage surface.
- Agent Actions is the execution surface for reviewed actions and diffs.
- Counterparty responses are visible simulated beats for Credit Officer, Legal, and Customer Success.
- The CS-plan 18% vs 22% conflict appears after Credit Officer approval returns.
- Approval-ready becomes true only after Credit Officer, Legal, final covenant tracker, and CS-plan reconciliation clear.
- The demo should distinguish real controls from simulated people/timing without underselling the real engine.

## Panel Rubric

Every answer should help the panel score one or more of:

- Strategic Thinking: platform framing, prioritization, business value, defensible wedge.
- Product Design: clear user need, entry point, happy paths, edge cases, understandable states.
- Technical & AI Integration: permission-aware retrieval, deterministic gates, action safety, lifecycle, evals.
- Communication: crisp narrative, low-jargon explanation, explicit assumptions, no overclaiming.

## Five Quality Passes

### 1. Architecture Freshness

Find and propose fixes for stale claims about:

- `RulePack` vs `Policy Artifact`
- `/api/brief` vs `/revalidate`
- Hidden timers or auto-signing
- CS-plan conflict timing
- Approval-ready state
- What is live, mocked, simulated, or synthetic

### 2. Panel Rubric Alignment

Rewrite weak answers so they directly support the Box rubric. Prefer answers that make the
architecture legible as reusable primitives instead of Acme-specific choreography.

### 3. Top-1% Candidate Polish

Tighten answers to sound calm, precise, and defensible. Remove loaded language, colorful phrasing,
duplicate answers, and unexplained internal jargon. Keep the core line: Acme is the scenario; the
primitive set is the product.

### 4. RAG Answer Quality

Make answers retrieval-friendly:

- Self-contained enough to answer a likely panel question.
- Short enough to be useful in a RAG response.
- Consistent with canonical terminology.
- Not duplicative unless the question genuinely needs a different angle.

### 5. Demo Consistency

Check every answer against the actual Acme path:

1. Direct write request is refused.
2. Decision Brief explains blockers.
3. Brief rows stage remediations.
4. Agent Actions validates and executes.
5. Counterparty responses are visible simulations.
6. Lifecycle events recompute readiness.
7. CS-plan reconciliation follows Credit Officer approval.
8. Legal and covenant dependencies clear.
9. Governed record is sealed after dependencies clear.

## Review Workflow

1. Run async workstreams using `docs/FAQ_UPGRADE_WORKSTREAMS.md`.
2. Each workstream proposes changes only.
3. Consolidation thread merges proposals into an approval packet.
4. User reviews proposed changes.
5. Implementation pass applies only approved edits.
6. Regenerate generated docs corpus if source docs changed.

## Post-Approval Verification

After approved edits are applied:

```bash
cd frontend && bun run scripts/extract-docs.ts
python -m pytest tests/test_docs_corpus.py -q -p no:cacheprovider
cd frontend && bun test tests/docs-extractor.test.tsx
cd frontend && bun run lint
git diff --check
```

Search hygiene:

```bash
rg -n "RulePack|rulepack|/revalidate|auto-sign|hidden timer|churn" api/docs_corpus docs demo-walkthrough.html
```

Expected remaining matches:

- `RulePack` / `rulepack` only where discussing internal schema/API fields.
- `/revalidate` only where discussing sealed governed records or source-change verification.
- No stale hidden-timer, auto-signing, or churn framing in panel-facing answers.


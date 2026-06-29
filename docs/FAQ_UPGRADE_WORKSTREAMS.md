# FAQ Upgrade Workstreams

## Purpose

Use this document to run asynchronous review threads for the FAQ corpus upgrade. Each workstream has
a bounded file set, shared architecture context, and an output format. Threads should propose
changes only; they should not edit files.

Each thread must keep responses under 40 seconds by working in small batches. If a file is large,
review a section at a time and checkpoint with concise findings.

## Global Rules

- Do not edit files directly.
- Return proposed changes only: issue list, before/after copy, or patch-style replacement text.
- Keep language panel-friendly and low-jargon.
- Do not overclaim what is live.
- Preserve the distinction between real controls and simulated people/timing.
- Use `Policy Artifact` as the product term.
- Mention `RulePack` only as the internal verifier schema / compiled rule subset when necessary.
- Treat Acme as the scenario; the reusable primitive set is the product.

## Required Reading For Every Workstream

Read these before reviewing assigned files:

- `/Users/WL/Downloads/Round_1_Case_Study_Virtual_Panel (3).md`
- `demo-walkthrough.html`
- `docs/FAQ_CORPUS_UPGRADE_PLAN.md`
- `docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md`
- `docs/ACTION_LIFECYCLE.md`
- `frontend/src/routes/developers/p0.tsx`
- `frontend/src/components/docs/DeveloperDocPage.tsx`

Use these FAQ files as current answer-style references:

- `api/docs_corpus/product-faq.md`
- `api/docs_corpus/engineering-faq.md`

## Current Architecture Facts

- Decision Brief is the typed readiness and read/stage surface.
- Agent Actions is the execution surface.
- Staged remediation must derive from the readiness row, not a parallel hardcoded action.
- Live meeting revalidation is lifecycle-event-derived through `/api/brief`.
- `/revalidate` is for sealed governed record/source-change verification.
- Credit Officer, Legal, and Customer Success responses are visible simulated counterparties.
- CS-plan conflict appears only after Credit Officer approval returns.
- Approval-ready stays false until Credit Officer, Legal, covenant tracker, and CS-plan reconciliation all clear.
- Permission filtering happens before retrieval; denied content does not enter prompts or summaries.
- Eval and telemetry answers should emphasize typed signals, no raw content, and tenant-local or synthetic evaluation.

## Output Format

Each workstream response should use this shape:

```md
## Batch Summary
- Files reviewed:
- Main stale claims:
- Main proposed improvements:

## Proposed Changes
### path/to/file.md
Finding:
Replacement:

## Open Questions
- None, or list only decisions that block a safe edit.
```

When proposing copy, prefer exact replacement blocks:

```md
Replace:
> old answer

With:
> new answer
```

## Workstream A - Product, Strategy, Commercial

Assigned files:

- `api/docs_corpus/product-faq.md`
- `api/docs_corpus/commercial-faq.md`
- `api/docs_corpus/design-rationale.md`

Goal:

Make the product story crisp: user pain, why finance first, why this is platform rather than
chatbot, what ships first, how it maps to business value, and why ConnectWork can win.

Required checks:

- No stale `RulePack` as product primitive language.
- No overclaiming beyond prototype reality.
- Clear Acme scenario vs reusable platform distinction.
- Answers understandable by Product and Design panelists without repo context.
- Strong mapping to Strategic Thinking and Product Design rubric.

Thread prompt:

```text
Review Product, Commercial, and Design Rationale FAQ files in five passes: architecture freshness,
panel rubric alignment, top-1% candidate polish, RAG answer quality, and demo consistency. Do not
edit files. Produce proposed changes only. Enforce current architecture facts from
docs/FAQ_UPGRADE_WORKSTREAMS.md. Keep each response under 40 seconds and work in small batches.
```

## Workstream B - Engineering, Architecture, Risk

Assigned files:

- `api/docs_corpus/engineering-faq.md`
- `api/docs_corpus/gating.md`
- `api/docs_corpus/red-team-eval.md`

Goal:

Make technical answers accurate, defensible, and current with the implemented architecture.

Required checks:

- Correct real vs simulated boundaries.
- Correct lifecycle-event revalidation story.
- Correct staged-remediation, action-diff, and anti-bypass explanation.
- Correct `Policy Artifact` / internal `RulePack` distinction.
- Strong permission, prompt-injection, and eval answers.
- No claim that target architecture exists if it is only planned.

Thread prompt:

```text
Review Engineering, Gating, and Red-Team Eval files for stale architecture claims and panel-facing
precision. Do not edit files. Prioritize deterministic gates, staged remediation, lifecycle events,
docs RAG access control, real vs simulated boundaries, Policy Artifact vs internal RulePack, and
/api/brief vs /revalidate. Return proposed replacements or diffs only. Keep each response under
40 seconds.
```

## Workstream C - UX, Adoption, Sharp Followups

Assigned files:

- `api/docs_corpus/ux-faq.md`
- `api/docs_corpus/sharp-followups-faq.md`

Goal:

Make answers strong for Design/product-adoption questions: reluctant users, trust model, review
affordances, permission explanations, likely panel objections, and “what did not get built.”

Required checks:

- Avoid internal jargon unless explained.
- Make user control explicit: stage, review, accept/reject, visible counterparty response.
- Clarify why the agent does not replace attendee chat or silently act.
- Align “what did not get built” with current live/mock boundaries.
- Keep sharp-followup answers crisp enough for a late-panel Q&A.

Thread prompt:

```text
Review UX FAQ and Sharp Followups for panel readiness and adoption clarity. Do not edit files.
Check reluctant-user trust, explicit user control, permission explanations, live/mock boundaries,
and demo consistency. Return proposed answer rewrites grouped by theme. Keep each response under
40 seconds.
```

## Workstream D - Restricted And Synthetic Corpus Hygiene

Assigned files:

- `api/docs_corpus/employee-directory.md`
- `api/docs_corpus/revenue-fy26.md`

Goal:

Confirm restricted/source demo documents support permission-aware RAG without exposing sensitive
content inappropriately.

Required checks:

- Keep these files useful for retrieval and access-control tests.
- Do not weaken the permission-boundary demo.
- Restricted content should read as synthetic corpus material, not panel-facing truth.
- Propose minimal edits only where the current copy creates confusion or retrieval risk.

Thread prompt:

```text
Review Employee Directory and Revenue FY26 as synthetic docs RAG corpus files. Do not edit files.
Confirm they support permission-aware retrieval and restricted-content behavior. Recommend keep,
edit, or remove for each file, with minimal proposed edits only where needed. Keep each response
under 40 seconds.
```

## Workstream E - Demo And Lifecycle Markdown

Assigned files:

- `docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md`
- `docs/ACTION_LIFECYCLE.md`
- `docs/REVALIDATION_LIVE_PARITY_HANDOFF.md`

Reference only:

- `docs/LIVE_STATUS_WIDGET.html`

Goal:

Make architecture/demo docs match the live Acme path and serve as the canonical source for FAQ
reviewers.

Required checks:

- Demo beat sequence is current.
- Lifecycle language does not claim planned target architecture is already live.
- `/api/brief` vs `/revalidate` boundary is clear.
- Approval-ready and CS-plan conflict timing are correct.
- Action lifecycle anti-drift language is consistent with current staged remediation behavior.

Thread prompt:

```text
Review demo and lifecycle Markdown docs for current architecture alignment. Do not edit files.
Confirm the causal sequence: direct write refused, brief stages rows, drawer executes, visible
simulated counterparty responses, lifecycle revalidation, CS conflict after CO approval,
Legal/covenant closeout, approval-ready, sealed record. Propose precise doc updates only. Keep each
response under 40 seconds.
```

## Workstream F - Consolidation And Approval Packet

Inputs:

- Outputs from Workstreams A-E

Goal:

Produce one user-reviewable approval packet before implementation.

Required checks:

- Remove duplicate proposed edits.
- Resolve contradictions across workstreams.
- Group changes by file.
- Preserve exact replacement text where possible.
- Flag any unresolved decisions before implementation.

Thread prompt:

```text
Consolidate proposed Markdown changes from Workstreams A-E into one approval packet. Do not edit
files. Group by file, resolve duplicate/conflicting recommendations, and produce patch-style
proposed changes. Flag open decisions clearly. Keep each response under 40 seconds by summarizing
first and expanding file-by-file only when asked.
```

## Approval And Implementation Boundary

Workstreams A-F stop at proposed changes. After the user approves a consolidated packet, a separate
implementation pass applies approved edits only.

After implementation:

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


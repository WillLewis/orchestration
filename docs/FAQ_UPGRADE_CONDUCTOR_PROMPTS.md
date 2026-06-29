# FAQ Upgrade Conductor Prompts

Use these prompts to create isolated Conductor threads. Each prompt assumes the thread has zero
prior context. Paste one prompt per thread.

All threads are review-only unless the prompt explicitly says consolidation. They should not edit
files. They should propose changes for user approval.

## Prompt A - Product, Strategy, Commercial

```text
You are working in the ConnectWork Command Agent prototype repo.

Goal: Review and propose upgrades to the Product, Commercial, and Design Rationale FAQ corpus so it is accurate for the current architecture and strong enough for a Box virtual panel. Do not edit files. Produce proposed changes only.

Time/response constraint:
- Keep each response under 40 seconds.
- Work in small batches.
- If the file set is too large, review one file or one section at a time and checkpoint.

Files assigned to you:
- api/docs_corpus/product-faq.md
- api/docs_corpus/commercial-faq.md
- api/docs_corpus/design-rationale.md

Read first, in this order:
1. /Users/WL/Downloads/Round_1_Case_Study_Virtual_Panel (3).md
2. demo-walkthrough.html
3. docs/FAQ_CORPUS_UPGRADE_PLAN.md
4. docs/FAQ_UPGRADE_WORKSTREAMS.md
5. docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md
6. docs/ACTION_LIFECYCLE.md
7. frontend/src/routes/developers/p0.tsx
8. frontend/src/components/docs/DeveloperDocPage.tsx
9. api/docs_corpus/product-faq.md
10. api/docs_corpus/engineering-faq.md

Panel rubric to optimize for:
- Strategic Thinking: platform framing, prioritization, business value, defensible wedge.
- Product Design: clear user need, entry point, happy paths, edge cases, understandable states.
- Technical & AI Integration: permission-aware retrieval, deterministic gates, action safety, lifecycle, evals.
- Communication: crisp narrative, low-jargon explanation, explicit assumptions, no overclaiming.

Current architecture facts to enforce:
- Policy Artifact is the product term.
- RulePack is the internal locked verifier schema / compiled rule subset only.
- Live meeting revalidation is lifecycle-event-derived through /api/brief.
- /revalidate is for sealed governed record/source-change verification, not the active meeting walkthrough.
- Decision Brief is the typed readiness and read/stage surface.
- Agent Actions is the execution surface.
- Staged remediation must derive from the readiness row, not a parallel hardcoded action.
- Credit Officer, Legal, and Customer Success responses are visible simulated counterparties.
- CS-plan conflict appears only after Credit Officer approval returns.
- Approval-ready stays false until Credit Officer, Legal, covenant tracker, and CS-plan reconciliation all clear.
- Permission filtering happens before retrieval; denied content does not enter prompts or summaries.
- Acme is the scenario; the reusable primitive set is the product.

Your five review passes:
1. Architecture freshness: find stale claims about RulePack, /revalidate, hidden timers, CS-plan timing, approval-ready state, and live/mock boundaries.
2. Panel rubric alignment: make answers directly support the Box rubric.
3. Top-1% candidate polish: tighten language, remove overclaims and loaded/colorful phrasing.
4. RAG answer quality: make answers self-contained, retrieval-friendly, and non-duplicative.
5. Demo consistency: check every answer against the Acme path from blocked write to sealed record.

Specific focus for your workstream:
- Make the product story crisp: user pain, why finance first, why this is platform rather than chatbot, what ships first, how it maps to business value, and why ConnectWork can win.
- Ensure answers are understandable by Product and Design panelists without repo context.
- Remove stale “RulePack as product primitive” language.
- Avoid overclaiming beyond prototype reality.
- Keep the Acme scenario vs reusable platform distinction clear.

Output format:
## Batch Summary
- Files reviewed:
- Main stale claims:
- Main proposed improvements:

## Proposed Changes
### path/to/file.md
Finding:
Replacement:

Use exact replacement blocks where possible:
Replace:
> old answer

With:
> new answer

## Open Questions
- None, or list only decisions that block a safe edit.

Do not edit files. Do not run formatters. Do not regenerate generated docs. Stop after proposed changes.
```

## Prompt B - Engineering, Architecture, Risk

```text
You are working in the ConnectWork Command Agent prototype repo.

Goal: Review and propose upgrades to the Engineering, Gating, and Red-Team Eval FAQ/docs corpus so technical answers are accurate, defensible, and current with the implemented architecture. Do not edit files. Produce proposed changes only.

Time/response constraint:
- Keep each response under 40 seconds.
- Work in small batches.
- If the file set is too large, review one file or one section at a time and checkpoint.

Files assigned to you:
- api/docs_corpus/engineering-faq.md
- api/docs_corpus/gating.md
- api/docs_corpus/red-team-eval.md

Read first, in this order:
1. /Users/WL/Downloads/Round_1_Case_Study_Virtual_Panel (3).md
2. demo-walkthrough.html
3. docs/FAQ_CORPUS_UPGRADE_PLAN.md
4. docs/FAQ_UPGRADE_WORKSTREAMS.md
5. docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md
6. docs/ACTION_LIFECYCLE.md
7. docs/REVALIDATION_LIVE_PARITY_HANDOFF.md
8. frontend/src/routes/developers/p0.tsx
9. frontend/src/components/docs/DeveloperDocPage.tsx
10. api/docs_corpus/product-faq.md
11. api/docs_corpus/engineering-faq.md

Panel rubric to optimize for:
- Strategic Thinking: platform framing, prioritization, business value, defensible wedge.
- Product Design: clear user need, entry point, happy paths, edge cases, understandable states.
- Technical & AI Integration: permission-aware retrieval, deterministic gates, action safety, lifecycle, evals.
- Communication: crisp narrative, low-jargon explanation, explicit assumptions, no overclaiming.

Current architecture facts to enforce:
- Policy Artifact is the product term.
- RulePack is the internal locked verifier schema / compiled rule subset only.
- Live meeting revalidation is lifecycle-event-derived through /api/brief.
- /revalidate is for sealed governed record/source-change verification, not the active meeting walkthrough.
- Decision Brief is the typed readiness and read/stage surface.
- Agent Actions is the execution surface.
- Staged remediation must derive from the readiness row, not a parallel hardcoded action.
- Credit Officer, Legal, and Customer Success responses are visible simulated counterparties.
- CS-plan conflict appears only after Credit Officer approval returns.
- Approval-ready stays false until Credit Officer, Legal, covenant tracker, and CS-plan reconciliation all clear.
- Permission filtering happens before retrieval; denied content does not enter prompts or summaries.
- Eval and telemetry answers should emphasize typed signals, no raw content, and tenant-local or synthetic evaluation.
- Acme is the scenario; the reusable primitive set is the product.

Your five review passes:
1. Architecture freshness: find stale claims about RulePack, /revalidate, hidden timers, CS-plan timing, approval-ready state, and live/mock boundaries.
2. Panel rubric alignment: make answers directly support the Box rubric.
3. Top-1% candidate polish: tighten language, remove overclaims and loaded/colorful phrasing.
4. RAG answer quality: make answers self-contained, retrieval-friendly, and non-duplicative.
5. Demo consistency: check every answer against the Acme path from blocked write to sealed record.

Specific focus for your workstream:
- Correct real vs simulated boundaries.
- Correct lifecycle-event revalidation story.
- Correct staged-remediation, action-diff, and anti-bypass explanation.
- Correct Policy Artifact / internal RulePack distinction.
- Strong permission, prompt-injection, and eval answers.
- No claim that target architecture exists if it is only planned.
- Technical answers should be concrete enough for Engineering, but short enough for panel Q&A.

Output format:
## Batch Summary
- Files reviewed:
- Main stale claims:
- Main proposed improvements:

## Proposed Changes
### path/to/file.md
Finding:
Replacement:

Use exact replacement blocks where possible:
Replace:
> old answer

With:
> new answer

## Open Questions
- None, or list only decisions that block a safe edit.

Do not edit files. Do not run formatters. Do not regenerate generated docs. Stop after proposed changes.
```

## Prompt C - UX, Adoption, Sharp Followups

```text
You are working in the ConnectWork Command Agent prototype repo.

Goal: Review and propose upgrades to the UX FAQ and Sharp Followups corpus so answers are strong for Design/product-adoption questions, reluctant users, trust model, permissions, likely objections, and “what did not get built.” Do not edit files. Produce proposed changes only.

Time/response constraint:
- Keep each response under 40 seconds.
- Work in small batches.
- If the file set is too large, review one file or one section at a time and checkpoint.

Files assigned to you:
- api/docs_corpus/ux-faq.md
- api/docs_corpus/sharp-followups-faq.md

Read first, in this order:
1. /Users/WL/Downloads/Round_1_Case_Study_Virtual_Panel (3).md
2. demo-walkthrough.html
3. docs/FAQ_CORPUS_UPGRADE_PLAN.md
4. docs/FAQ_UPGRADE_WORKSTREAMS.md
5. docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md
6. docs/ACTION_LIFECYCLE.md
7. frontend/src/routes/developers/p0.tsx
8. frontend/src/components/docs/DeveloperDocPage.tsx
9. api/docs_corpus/product-faq.md
10. api/docs_corpus/engineering-faq.md

Panel rubric to optimize for:
- Strategic Thinking: platform framing, prioritization, business value, defensible wedge.
- Product Design: clear user need, entry point, happy paths, edge cases, understandable states.
- Technical & AI Integration: permission-aware retrieval, deterministic gates, action safety, lifecycle, evals.
- Communication: crisp narrative, low-jargon explanation, explicit assumptions, no overclaiming.

Current architecture facts to enforce:
- Policy Artifact is the product term.
- RulePack is the internal locked verifier schema / compiled rule subset only.
- Live meeting revalidation is lifecycle-event-derived through /api/brief.
- /revalidate is for sealed governed record/source-change verification, not the active meeting walkthrough.
- Decision Brief is the typed readiness and read/stage surface.
- Agent Actions is the execution surface.
- Staged remediation must derive from the readiness row, not a parallel hardcoded action.
- Credit Officer, Legal, and Customer Success responses are visible simulated counterparties.
- CS-plan conflict appears only after Credit Officer approval returns.
- Approval-ready stays false until Credit Officer, Legal, covenant tracker, and CS-plan reconciliation all clear.
- Permission filtering happens before retrieval; denied content does not enter prompts or summaries.
- Acme is the scenario; the reusable primitive set is the product.

Your five review passes:
1. Architecture freshness: find stale claims about RulePack, /revalidate, hidden timers, CS-plan timing, approval-ready state, and live/mock boundaries.
2. Panel rubric alignment: make answers directly support the Box rubric.
3. Top-1% candidate polish: tighten language, remove overclaims and loaded/colorful phrasing.
4. RAG answer quality: make answers self-contained, retrieval-friendly, and non-duplicative.
5. Demo consistency: check every answer against the Acme path from blocked write to sealed record.

Specific focus for your workstream:
- Avoid internal jargon unless explained.
- Make user control explicit: stage, review, accept/reject, visible counterparty response.
- Clarify why the agent does not replace attendee chat or silently act.
- Align “what did not get built” with current live/mock boundaries.
- Make reluctant-user and trust-model answers concrete and balanced.
- Keep sharp-followup answers crisp enough for a late-panel Q&A.

Output format:
## Batch Summary
- Files reviewed:
- Main stale claims:
- Main proposed improvements:

## Proposed Changes
### path/to/file.md
Finding:
Replacement:

Use exact replacement blocks where possible:
Replace:
> old answer

With:
> new answer

## Open Questions
- None, or list only decisions that block a safe edit.

Do not edit files. Do not run formatters. Do not regenerate generated docs. Stop after proposed changes.
```

## Prompt D - Restricted And Synthetic Corpus Hygiene

```text
You are working in the ConnectWork Command Agent prototype repo.

Goal: Review restricted/synthetic corpus files that feed docs RAG tests. Confirm they support permission-aware retrieval without exposing sensitive content inappropriately. Do not edit files. Produce proposed changes only.

Time/response constraint:
- Keep each response under 40 seconds.
- Work in small batches.
- These files are short; inspect each and return a keep/edit/remove recommendation.

Files assigned to you:
- api/docs_corpus/employee-directory.md
- api/docs_corpus/revenue-fy26.md

Read first, in this order:
1. /Users/WL/Downloads/Round_1_Case_Study_Virtual_Panel (3).md
2. docs/FAQ_CORPUS_UPGRADE_PLAN.md
3. docs/FAQ_UPGRADE_WORKSTREAMS.md
4. api/docs_corpus/product-faq.md
5. api/docs_corpus/engineering-faq.md
6. api/docs_corpus/employee-directory.md
7. api/docs_corpus/revenue-fy26.md

Panel rubric to optimize for:
- Technical & AI Integration: permission-aware retrieval, deterministic access boundary, no leakage.
- Communication: crisp explanation of what is synthetic and why it exists.

Current architecture facts to enforce:
- Permission filtering happens before retrieval; denied content does not enter prompts or summaries.
- Restricted content can be acknowledged only if the user already has a permitted reference to the restricted source.
- Synthetic corpus files exist to test retrieval/access-control behavior, not to represent real company data.
- Acme is the scenario; the reusable primitive set is the product.

Specific focus for your workstream:
- Keep these files useful for retrieval and access-control tests.
- Do not weaken the permission-boundary demo.
- Restricted content should read as synthetic corpus material, not panel-facing truth.
- Propose minimal edits only where current copy creates confusion, stale architecture references, or retrieval risk.

Output format:
## Batch Summary
- Files reviewed:
- Keep/edit/remove recommendation:
- Main risks:

## Proposed Changes
### path/to/file.md
Finding:
Replacement:

Use exact replacement blocks where possible:
Replace:
> old answer

With:
> new answer

## Open Questions
- None, or list only decisions that block a safe edit.

Do not edit files. Do not run formatters. Do not regenerate generated docs. Stop after proposed changes.
```

## Prompt E - Demo And Lifecycle Markdown

```text
You are working in the ConnectWork Command Agent prototype repo.

Goal: Review demo and lifecycle Markdown docs so they match the live Acme path and can serve as canonical context for FAQ reviewers. Do not edit files. Produce proposed changes only.

Time/response constraint:
- Keep each response under 40 seconds.
- Work in small batches.
- If a file is large, review one section at a time and checkpoint.

Files assigned to you:
- docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md
- docs/ACTION_LIFECYCLE.md
- docs/REVALIDATION_LIVE_PARITY_HANDOFF.md

Reference only:
- docs/LIVE_STATUS_WIDGET.html

Read first, in this order:
1. /Users/WL/Downloads/Round_1_Case_Study_Virtual_Panel (3).md
2. demo-walkthrough.html
3. docs/FAQ_CORPUS_UPGRADE_PLAN.md
4. docs/FAQ_UPGRADE_WORKSTREAMS.md
5. docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md
6. docs/ACTION_LIFECYCLE.md
7. docs/REVALIDATION_LIVE_PARITY_HANDOFF.md
8. frontend/src/routes/developers/p0.tsx
9. frontend/src/components/docs/DeveloperDocPage.tsx

Panel rubric to optimize for:
- Strategic Thinking: platform framing, prioritization, business value, defensible wedge.
- Product Design: clear user need, entry point, happy paths, edge cases, understandable states.
- Technical & AI Integration: permission-aware retrieval, deterministic gates, action safety, lifecycle, evals.
- Communication: crisp narrative, low-jargon explanation, explicit assumptions, no overclaiming.

Current architecture facts to enforce:
- Policy Artifact is the product term.
- RulePack is the internal locked verifier schema / compiled rule subset only.
- Live meeting revalidation is lifecycle-event-derived through /api/brief.
- /revalidate is for sealed governed record/source-change verification, not the active meeting walkthrough.
- Decision Brief is the typed readiness and read/stage surface.
- Agent Actions is the execution surface.
- Staged remediation must derive from the readiness row, not a parallel hardcoded action.
- Credit Officer, Legal, and Customer Success responses are visible simulated counterparties.
- CS-plan conflict appears only after Credit Officer approval returns.
- Approval-ready stays false until Credit Officer, Legal, covenant tracker, and CS-plan reconciliation all clear.
- Permission filtering happens before retrieval; denied content does not enter prompts or summaries.
- Acme is the scenario; the reusable primitive set is the product.

Specific focus for your workstream:
- Demo beat sequence is current.
- Lifecycle language does not claim planned target architecture is already live.
- /api/brief vs /revalidate boundary is clear.
- Approval-ready and CS-plan conflict timing are correct.
- Action lifecycle anti-drift language is consistent with current staged remediation behavior.
- Proposed edits should improve the docs that other FAQ-review threads rely on.

Expected causal sequence:
1. Direct write refused.
2. Decision Brief stages rows.
3. Drawer executes reviewed action.
4. Visible simulated counterparty response returns.
5. Lifecycle revalidation updates readiness.
6. CS conflict appears after CO approval.
7. Legal and covenant dependencies close out.
8. Approval-ready becomes true.
9. Governed record is sealed.

Output format:
## Batch Summary
- Files reviewed:
- Main stale claims:
- Main proposed improvements:

## Proposed Changes
### path/to/file.md
Finding:
Replacement:

Use exact replacement blocks where possible:
Replace:
> old answer

With:
> new answer

## Open Questions
- None, or list only decisions that block a safe edit.

Do not edit files. Do not run formatters. Do not regenerate generated docs. Stop after proposed changes.
```

## Prompt F - Consolidation And Approval Packet

```text
You are working in the ConnectWork Command Agent prototype repo.

Goal: Consolidate proposed changes from Workstreams A-E into one user-reviewable approval packet. Do not edit files. Produce the packet only.

Time/response constraint:
- Keep each response under 40 seconds.
- Summarize first.
- Expand file-by-file only when asked.
- If inputs are too large, process one workstream output at a time and checkpoint.

Inputs you should request or read:
- Workstream A output: Product, Strategy, Commercial
- Workstream B output: Engineering, Architecture, Risk
- Workstream C output: UX, Adoption, Sharp Followups
- Workstream D output: Restricted/Synthetic Corpus Hygiene
- Workstream E output: Demo and Lifecycle Markdown

Read first, in this order:
1. /Users/WL/Downloads/Round_1_Case_Study_Virtual_Panel (3).md
2. demo-walkthrough.html
3. docs/FAQ_CORPUS_UPGRADE_PLAN.md
4. docs/FAQ_UPGRADE_WORKSTREAMS.md
5. docs/DEMO_BEATS_APPLY_DISCOUNT_TO_SEAL.md
6. docs/ACTION_LIFECYCLE.md
7. frontend/src/routes/developers/p0.tsx
8. frontend/src/components/docs/DeveloperDocPage.tsx

Current architecture facts to enforce:
- Policy Artifact is the product term.
- RulePack is the internal locked verifier schema / compiled rule subset only.
- Live meeting revalidation is lifecycle-event-derived through /api/brief.
- /revalidate is for sealed governed record/source-change verification, not the active meeting walkthrough.
- Decision Brief is the typed readiness and read/stage surface.
- Agent Actions is the execution surface.
- Staged remediation must derive from the readiness row, not a parallel hardcoded action.
- Credit Officer, Legal, and Customer Success responses are visible simulated counterparties.
- CS-plan conflict appears only after Credit Officer approval returns.
- Approval-ready stays false until Credit Officer, Legal, covenant tracker, and CS-plan reconciliation all clear.
- Permission filtering happens before retrieval; denied content does not enter prompts or summaries.
- Acme is the scenario; the reusable primitive set is the product.

Your consolidation responsibilities:
- Remove duplicate proposed edits.
- Resolve contradictions across workstreams.
- Group changes by file.
- Preserve exact replacement text where possible.
- Flag unresolved decisions before implementation.
- Separate “approved-safe” changes from “needs user decision” changes.

Output format:
## Approval Packet Summary
- Files with proposed edits:
- Highest-impact fixes:
- Open decisions:

## Proposed Changes By File
### path/to/file.md
Reason:
Patch-style replacement:

## Conflicts Resolved
- Workstream conflict:
- Resolution:

## User Decisions Needed
- None, or list concise decision prompts.

Do not edit files. Do not run formatters. Do not regenerate generated docs. Stop after producing the approval packet.
```


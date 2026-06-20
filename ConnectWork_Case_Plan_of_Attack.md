# ConnectWork Case — Plan of Attack
### Round 1: Case Study Virtual Panel — Senior PM, AI Agent Orchestration
*Working merge. **Product features, roadmap, edge cases, primitives, and success metrics** follow the ChatGPT (Revised Case Plan v3) version; **strategy, backstory, positioning, platform-fix, hero loop, interview callbacks, and build plan** keep the Claude version. Q&A merged. ✅ locked · ⬜ open · 🟡 stated assumption.*

---

## 0. The spine *(Claude)*
> Today the Conversational Insights Agent **describes** conversations. We turn it into the **trusted layer that closes the loop from discussed to done** — harvesting signals across chat, meetings, content, metadata, and workflows, then producing **verified work products and safe actions** that regulated enterprises can trust.

**Product one-liner:** *ConnectWork Command Agent turns regulated enterprise conversations into decision-ready context, safe action plans, and governed work products, with deterministic controls wherever correctness is non-negotiable.*

**A platform thesis, proven through a vertical.** Across Legal, Financial, and Healthcare the blocker to agentic adoption is the same — **verifiable trust**, not capability. Two business problems, one architecture: **the loop drives growth** (discussed→done) and **the deterministic substrate stops the churn** (trust). Surface name: **Conversational Insights Agent**; vision-state shorthand: **Command Agent** (⬜ optional).

---

## 1. Locked decisions *(Claude)*
- ✅ Reframe → governed work-orchestration agent; motivated by two verticals (Financial churn + Legal trust crisis), framed as a platform problem.
- ✅ Product = cross-surface **work-loop closer**; the five features (§5) compose into it.
- ✅ Hero vertical = **Financial Services** (credit/risk committee).
- ✅ Platform proof = **three-vertical eval finale** (§14).
- ✅ Full real stack: LangChain/LangGraph · Braintrust + W&B (both in Box's stack) · Lovable · real Anthropic + OpenAI APIs.
- ✅ Roadmap: **Phase 0–3** (§6). Defuse the Kus boundary out loud (§3).

---

## 2. Backstory (context slide) *(Claude — verified data, two-vertical)*
🟡 *Assumptions are illustrative; the arXiv and legal data are real and current.*

ConnectWork leads all three surfaces (document management; chat & video; project/workflow). Its franchise base skews **Legal, Financial, Healthcare** — clients who bought it for being secure, permissioned, auditable, governable. But growth is slowing.

**What changed:**
1. **AI competition is reframing the category.** Teams + Copilot trains buyers to expect AI inside collaboration; summaries and transcript Q&A are now table stakes.
2. **The current agent isn't enough.** It summarizes but doesn't close the loop into governed work — doesn't reliably answer what changed, what matters, what evidence is missing, which approvals are required, or whether the output is still current.
3. **Financial Services is churning fastest.** A vertical competitor (**FinSight AI**) wins these accounts with **deterministic verification layers** around the model — "verified decisions, policy gates, calculations, audit-ready workflows," not "better summaries." The research backs why that wins:
   - **VERAFI** (arXiv:2512.14744): RAG-with-reranking ≈ **52.4%** factual correctness on financial reasoning; neurosymbolic reaches **94.7%** (81% relative gain).
   - **Neuro-Symbolic Compliance** (arXiv:2601.06181): LLM→SMT→solver = **86.2%** on real financial-regulator enforcement cases, ~100× efficiency.
   So a good summarizer/RAG tops out ~50% factual correctness on financial work; a deterministic competitor is ~95%. **Hallucination is the churn driver, not a polish issue.**
4. **The AI feedback loop is hard to close.** As an enterprise tool, ConnectWork can't freely inspect raw prompts, responses, transcripts, or documents, so the team over-relies on synthetic dummy accounts and PM-authored eval sets.
5. **It's not only finance — it's a pattern.** Legal is in a public trust crisis: mid-2026, a widely-cited database lists **1,400+ court cases** with AI-hallucinated content; U.S. courts imposed **$145K+ in sanctions in Q1 2026** (record $110K; first license suspension); a June 2026 ruling removed lawyers from **both sides** of a case for relying on AI; New York mandated a **system-wide court AI policy** effective June 1, 2026. Healthcare/life-sciences has parallel concerns (PHI, protocol approvals, SOP versioning, auditability).

**Strategic conclusion — two jobs at once:** (1) **growth:** move beyond summarization into closing the work loop; (2) **trust:** win back regulated clients by making agent outputs verifiable, auditable, and safe. The answer is a governed work-orchestration agent on an unglamorous-but-powerful substrate: permission-aware context assembly, deterministic verification, action diffs, work-product lifecycle, and privacy-preserving eval loops. The wedge Microsoft can recognize but not easily replicate inside ConnectWork's native content, workflow, and permission graph.

---

## 3. Strategic positioning *(Claude)*
**Compete on:** native workspace signal graph · permission-aware context assembly · deterministic policy & calculation gates · safe action diffs · governed work-product lifecycle · privacy-preserving eval loops · customer-configurable recipes · audit-ready traces.

**Do NOT compete on first:** generic chatbot parity · universal cross-app orchestration · fully autonomous approvals · broad "agent swarm" demos · raw production-data inspection · per-tenant fine-tuning as the first reliability answer.

**Strategic line:** *Finance is the wedge, not the architecture. I chose it for the clearest churn signal and the richest deterministic surface — but the primitives are reusable: ContextBundle, RulePack, ActionDiff, WorkProductContract, EvalTrace.*

**Defuse the Kus boundary, unprompted:** "This isn't the cross-app orchestration race. We make ConnectWork's own native work graph actionable and trustworthy, and reach external systems only via typed connectors — we're the governed layer other agents call into via MCP. That's also the **headless** direction the team described."

**Why this is a PLATFORM answer, not a vertical answer:** (1) the backstory motivates a *pattern* (finance churn + legal trust crisis); (2) the primitives (§7) are vertical-agnostic — verticals differ only by RulePack + recipe + eval pack (configuration, not code); (3) the three-vertical eval finale (§14) is the proof.

---

## 4. Roads not taken — backlog of obvious bets declined *(Claude merged + ChatGPT additions)*
| Obvious bet | Decision | Why |
|---|---|---|
| Better meeting summaries | Decline as hero | Commodity; too close to Copilot parity |
| Generic RAG across all docs | Substrate only | Necessary but insufficient for approvals, calculations, compliance, action safety (VERAFI: RAG-only ≈52%) |
| Cross-source Q&A chatbot | Deprioritize | Helpful, but not the wedge that wins back regulated clients |
| General chatbot front door | Decline | Undifferentiated; over-serves power users, fails the user who didn't opt into AI |
| Universal cross-app orchestration | Don't pursue first | Too broad/integration-heavy; cuts against Kus boundary; competes with systems-of-record owners |
| Fully autonomous approvals | Cut from MVP | Unacceptable regulated risk; use propose → preview → approve |
| External financial-data integrations first | Defer | Prove value with native surfaces first |
| Per-tenant fine-tuning | Defer | Deterministic gates + eval coverage give more reliability per unit effort |
| Persistent memory as headline | Defer | Memory governance is a hard, unsolved problem |
| Multi-agent swarm | Avoid | Worse observability; use understander→planner→verifier→executor |
| Cost dashboard | Cut as hero | Not differentiated; keep cost as an ops metric |
| AI Studio-first product | Defer to Phase 3 | Studio scales a *proven* recipe; not the first value wedge |
| Raw production eval logging | Cut | Enterprise privacy constraints make it brittle; use tenant-local + aggregate telemetry |
| Customer-facing comms automation | Defer | Internal notes + approval routing safer first for regulated work |
| Model benchmark shootout | Defer | Model choice matters, but the wedge is orchestration, verification, eval coverage |
| "Agent does everything" demo | Cut | Flashy but undermines enterprise trust; earn autonomy progressively |

> **Say it out loud:** "I could have built the obvious RAG and summary features — but that chases the table-stakes market. I chose the vertical where trust failures are causing churn and where deterministic architecture gives ConnectWork a real right to win."

---

## 5. Product features *(ChatGPT version)*
> The five features compose into the cross-surface work loop (§9): **Brief** harvests → **Deterministic layer** verifies → **Action Composer** executes → **Lifecycle** revalidates → **Eval loop** learns.

### Feature 1 — Financial Decision Brief *(the same DecisionBriefSchema powers legal/health recipes)*
**Problem.** Financial review meetings need context from many artifacts; transcripts alone aren't enough.
**Experience.** From a meeting/chat/project, the user selects **Generate Financial Decision Brief**. The agent produces: executive summary · decision needed today · what changed since last review · key financial facts · policy & approval gates · required approvals · missing evidence · **conflicting evidence** · open questions · recommended next steps · source map · permission limitations · confidence state.
**Example output (Acme):** *Decision:* approve/reject the pricing exception + covenant modification. *What changed:* revenue forecast $42M→$38M; Legal approval pending; project plan still references the old date; CS plan references a discount level that **conflicts** with the pricing-exception doc. *Policy gates:* RM approval present; Credit Officer missing; Legal pending; exception exceeds threshold → committee review. *Missing evidence:* final covenant tracker not uploaded; Legal memo permission-restricted; no updated risk-rating approval.
**Why it matters:** turns the native content + conversation graph into decision-ready context. Not generic RAG — a structured, governed decision packet.
**Primitives:** `ContextBundle · SourceGraph · ClaimMap · PermissionBoundary · MissingEvidenceState · ConflictState · DecisionBriefSchema · WorkProductContract`

### Feature 2 — Deterministic Verification Layer
**Problem.** Clients churn because AI can't be trusted for calculations, policy gates, approvals, and audit-ready decisions. RAG finds content; it doesn't prove reasoning is correct.
**Experience.** Before marking a brief "approval-ready," the agent runs deterministic checks: required-approver matrix · approval-threshold checks · policy prerequisites · financial-ratio calculations · covenant-threshold checks · required-document completeness · deadline/status validation · restricted-content checks · permission gates · output-schema validation · work-product freshness.
**Example.** *"Can we mark this pricing exception approved?"* → *"I cannot mark this approval-ready. The discount exceeds the RM's delegated authority, Credit Officer approval is missing, and Legal approval is pending. I can route the approval packet to the required approvers."*
**Why it matters:** the LLM interprets messy evidence and drafts language; the deterministic layer owns pass/fail where mistakes are expensive.
**Primitives:** `RulePack · PolicyGraph · ApprovalMatrix · CalculationChecker · SchemaValidator · DeterministicDecision · RuleFiring · ComplianceTrace · RegressionSuite`

### Feature 3 — Safe Action Composer
**Problem.** Meetings create follow-up work across tasks, approvals, documents, schedules, notes — which must be reviewable before execution.
**Experience.** *"I found 6 follow-ups. 3 can be drafted now, 2 require approval routing, and 1 is blocked by missing evidence."* Proposed: create task (upload final covenant tracker) · route pricing exception to Credit Officer · draft committee packet · update status "Ready for Approval"→"Pending Legal" · schedule follow-up review · draft internal note on open risks. Each action carries: target object · reason · source evidence · before/after diff · required approver · risk level · execute-only-after-approval.
**Why it matters:** the move from insight to workflow completion, without unsafe autonomy.
**Primitives:** `ToolCard · ActionPlan · ActionDiff · SideEffectClass · ApprovalPolicy · DryRunExecutor · AuditEvent · RollbackPlan`

### Feature 4 — Work Product Lifecycle & Revalidation
**Problem.** Enterprise decisions go stale — a credit memo, legal approval, risk packet, project plan, or healthcare protocol can become wrong when source content changes.
**Experience.** *"The Acme committee brief may be stale. Section 3 says 'Legal approval complete,' but the Legal approval workflow moved back to 'Needs Review' yesterday."* Options: re-run affected section · notify owner · route approval · dismiss with reason · view dependency graph.
**Why it matters:** the move from "AI generated an answer" to "AI manages the trust state of a work product."
**Primitives:** `WorkProductContract · SourceDependencyGraph · StaleSectionState · RevalidationRule · EventTrigger · ReapprovalRoute · ChangeImpactMap`

### Feature 5 — Privacy-Preserving Eval Loop *(DEMOTED to a supporting subpoint)*
> **Presentation note:** this came from Matt's interview comment, not the case materials, so a mixed panel lacks context for why it matters — a headline feature with no shared context reads as solving a problem the audience didn't know they had. Keep it built, but present it as a one-line subpoint *under* the three-vertical eval proof ("…and we close the feedback loop without ever seeing raw content — something Matt and I discussed"), not a featured pillar. The **highlighted** eval moment is the three-vertical scorecard (platform generalization), which *is* in the case spirit.

**Problem.** ConnectWork can't freely inspect enterprise prompts, responses, transcripts, or documents, making live quality measurement hard.
**Collect (no raw content):** intent_class · recipe_id · source_types_used · tool attempted · tool success/fail · permission_denial_count · missing_evidence_category · schema_pass/fail · deterministic_rule_pass/fail · citation_coverage_score · claim_support_score (tenant-side) · action approved/edited/rejected · latency_bucket · cost_bucket · error_code. **Not collected by default:** raw prompt/response/document/transcript text or sensitive customer content.
**Optional customer-controlled modes:** (1) tenant-local evaluation (raw content stays in tenant) · (2) customer-approved redacted samples · (3) synthetic eval generation from metadata/schema/config · (4) AI Studio feedback capture · (5) differential privacy on aggregate analytics.
**Important caveat (say it — it builds credibility):** DP helps aggregate trend learning, **not** row-level debugging. For debugging we still need tenant-local evals, consented redacted samples, synthetic evals, and explicit admin feedback loops.
**Primitives:** `EvalTrace · TenantLocalEvalRunner · RedactedFailurePacket · AggregateMetricEmitter · PrivacyBudget · FeedbackReasonCode · SyntheticEvalGenerator · EvalPack`

---

## 6. Roadmap *(ChatGPT version)*

### Phase 0 — Substrate: Grounded Harvest & Verification
**Goal:** build the unglamorous foundation that makes every later feature trustworthy.
**Ships:** WorkspaceObject schema · permission-aware retrieval · SourceGraph · ContextBundle · ClaimMap · citation service · MissingEvidenceState · ConflictState · typed work-product schema · RulePack/policy-gate engine · CalculationChecker · ApprovalMatrix · structured-output validation · ToolCard registry · ActionDiff contract · EvalTrace schema · Braintrust/W&B harness · synthetic regulated-workspace corpus · privacy telemetry v1 (typed event extraction, redaction, aggregation thresholds, no raw-content export).
**Why it matters:** most candidates jump straight to features; this phase shows platform judgment. Without it, the product is just another chatbot with a nice UI.
**Killer wedge:** *Before we make the agent more powerful, we make its context, outputs, actions, and evaluation measurable.*

### Phase 1 — Financial Decision Brief
**Goal:** win back trust in the churning vertical by turning native signals into verified decision packets.
**Ships:** Credit/Risk Committee Decision Brief · what-changed-since-last-review · source map · permission-safe omissions · missing-evidence list · conflicting-evidence state · required-document checklist · approval-readiness status · policy-gate panel · calculation validation · pinned committee packet.
**Why it matters:** finance is the richest proof point — content, meetings, chat, metadata, approvals, calculations, policy gates.
**Killer wedge:** *Every brief shows what it used, what it skipped, what it could not know, and which deterministic gates passed or failed.*

### Phase 2 — Controlled Work Loop
**Goal:** move from answering to acting, while preserving human control.
**Ships:** post-meeting action plan · task creation · approval routing · internal-note draft · project-status updates · follow-up scheduling · action-diff drawer · approve/edit/reject flow · audit trail · **capability levels (read · draft · propose · write-with-approval)** · deterministic action gates · transaction-safe execution.
**Why it matters:** the real productivity gain is closing the loop, not summarizing — but action must be reviewable.
**Killer wedge:** *Agents can act, but only through typed tools, previewable diffs, and explicit approval.*

### Phase 3 — Lifecycle, Evals & Platform Scale
**Goal:** turn the finance proof point into a platform capability across regulated verticals.
**Ships:** stale work-product alerts · active revalidation · section-level freshness state · tenant-local eval runner · DP aggregate analytics · opt-in redacted failure packets · AI Studio recipe builder · EvalPack manager · **Legal recipe · Healthcare/life-sciences recipe** · Agent Ops dashboard · versioning & rollback · cross-recipe regression suite.
**Why it matters:** proves the product is a platform substrate for regulated work, not a finance-only custom workflow.
**Killer wedge:** *Customers can configure and improve agents without giving ConnectWork raw prompts, responses, or content.*

---

## 7. Core primitives *(ChatGPT version)*
| Primitive | Purpose |
|---|---|
| WorkspaceObject | Common representation for docs, meetings, chats, tasks, users, workflows, metadata |
| ContextBundle | Assembled-context packet with source IDs, permissions, citations, missing evidence, conflicts |
| SourceGraph | Dependency map between work products and source artifacts |
| ClaimMap | Links each factual claim to supporting sources or flags it unsupported |
| RulePack | Versioned deterministic rules for approvals, calculations, policy gates, compliance |
| ToolCard | Machine-readable tool description: schema, side effects, permissions, retries, approval policy |
| ActionDiff | Previewable before/after representation of any proposed mutation |
| WorkProductContract | Output schema, owners, approvals, source dependencies, revalidation rules |
| EvalTrace | Logs model versions, prompts, source types, tool calls, rule firings, verifier results, latency, cost |
| EvalPack | Versioned set of synthetic, tenant-local, redacted, and regression eval cases |
*(Per-feature primitive lists are inline in §5.)*

---

## 8. Reference architecture *(shared)*
```
User intent (meeting / chat / project)
  → Intent + workflow resolver → Recipe selection
  → Permission-aware context planner
  → Native sources: Docs · Meetings · Chat · Projects · Metadata · Workflows · User Profiles
  → ContextBundle (sources · claims · permissions · missing evidence · conflicts)
  → LLM synthesis (decision brief · rationale · action candidates)
  → Deterministic verification layer (policy gates · approval matrix · calculation · schema)
  → Verifier (faithfulness · citation support · permission safety · action validity)
  → UX (brief · source map · policy gates · action diffs · approval states)
  → Human approval (approve · edit · reject · route)
  → Tool execution (typed actions · audit events · rollback metadata)
  → Eval loop (privacy-preserving telemetry · tenant-local · synthetic · Braintrust)
```

---

## 9. The hero loop — Financial credit/risk committee *(Claude — the orchestration spine)*
*User: an RM, credit analyst, portfolio manager, risk officer, compliance officer, or deal lead prepping a credit/investment committee, lending-exception, risk, or renewal review. Scenario: a large commercial borrower facility — approve a pricing exception + covenant modification? Info spans prior + current transcripts, deal-room chat, credit memo, financials, covenant tracker, risk-rating history, legal memo, pricing-exception doc, project plan, approval workflow, authority matrix, information-barrier policies. Teammates = LLM personas in the prototype.*

**The loop:** harvest → Decision Brief (F1) → deterministic gate (F2) → propose the loop as a human-approved action diff (F3) → distribute & collect (chat/async) → route/escalate (e.g., MNPI to Compliance) → schedule to unblock → close with a governed work product + audit dossier, and **monitor for staleness** (F4). *The "AI interprets evidence, deterministic rules decide policy, human approves" system I built at Capital One.*

**Entry point (meeting side panel buttons):** Summarize this meeting · Generate Financial Decision Brief · What changed since last review? · Check approval readiness · Propose follow-ups · Monitor this decision.

---

## 10. Success metrics *(ChatGPT version)*
**North star:** **Decision-to-closed-work-product cycle time** for regulated review workflows.

- **User value:** time to prepare a decision packet · time from meeting-end to routed follow-ups · reduction in manual source-switching · decision-packet reuse rate · follow-up completion rate · repeat usage by regulated teams.
- **Trust & quality:** citation correctness · claim-support rate · missing-evidence honesty · conflict-detection accuracy · permission-denial pass rate · deterministic-rule pass rate · calculation-validation accuracy · structured-output correctness.
- **Action safety:** action-schema validity · diff-preview coverage · invalid-action rate · approve/edit/reject rate · rollback/correction rate · audit-trace completeness.
- **Platform health:** latency p50/p95 · cost per successful workflow · tool success rate · retry rate · trace completeness · eval-regression pass rate · recipe-version adoption.
- **Business:** financial-services churn reduction · expansion in financial accounts · AI feature adoption by regulated teams · Studio recipe creation · premium AI attach rate · renewal lift for regulated verticals.
- **Eval loop:** % eval signal from synthetic / tenant-local / customer-approved redacted samples / aggregate telemetry · # customer-created eval cases · regression pass rate by recipe · failure recurrence after fix.

---

## 11. Edge cases *(ChatGPT version — all four)*

**Edge case 1 — Permission boundary.**
*User:* "Why did Legal reject the discount?"
*Agent:* "I found three relevant sources. You have access to the meeting transcript and commercial summary. A Legal memo appears relevant, but you don't have access, so I did not use its contents. I can request access, ask Legal for a shareable summary, or answer from accessible sources only."
*Options:* request access · ask Legal for summary · continue with accessible sources · show source map.

**Edge case 2 — Deterministic policy block.**
*User:* "Mark the pricing exception as approved."
*Agent:* "I cannot mark this approved. The requested discount exceeds the RM's delegated authority, Credit Officer approval is missing, and Legal approval is pending. I can route the approval packet to the required approvers."
*Options:* route approval · draft note · show policy gates · dismiss with reason.

**Edge case 3 — Stale work product.**
*Trigger:* Legal approval document changes after the committee brief was pinned.
*Agent:* "The Acme committee brief may be stale. Section 3 says 'Legal approval complete,' but the Legal approval workflow moved to 'Needs Review' yesterday."
*Options:* re-run affected section · notify owner · route approval · dismiss with reason.

**Edge case 4 — Mosaic / synthesis permission risk.**
*Trigger:* the agent combines a restricted borrower financial update with a public-side research note; the individual objects have different audiences, but the synthesis may create an information-barrier problem.
*Agent:* "I cannot include this synthesized conclusion in the shared committee packet. The combined sources cross an information-barrier rule. I can route the question to Compliance or generate a public-side-safe version."
*Options:* route to Compliance · generate safe version · show rule · remove from packet.

---

## 12. Talking points & panel pushbacks *(Claude callbacks + merged Q&A)*
**Proactive callbacks (highest leverage with this HM):**
- *Eval gap (subpoint — raise only if Matt is present or eval comes up; not a headline):* "You said you can't eval on live data and it all falls on PM-built dummy sets. Here's how we get real-environment signal without ever seeing a prompt — structured events, redaction, tenant-local, DP." *(Demoted: came from the interview, not the case packet, so the broader panel lacks context.)*
- *Synthesis-permission (you raised it; he loved it):* "Permission is object-level, agents synthesize across objects — the mosaic problem. Here's the deterministic guard." *(Now Edge case 4.)*
- *Content→context wedge (you agreed on):* "The loop is how we prove cold-storage content is valuable."
- *"I built this" hooks:* offline-replay eval harness · neurosymbolic control · accept/edit/reject telemetry as the regression set · understander→planner→verifier with explicit contracts.

**Pushbacks & answers:**
- *Why finance first?* Clearest combination of urgency, churn risk, deterministic controls, calculations, approvals, auditability — the best vertical to prove trust. Then show the same substrate in Legal and Healthcare.
- *Isn't this just RAG?* RAG is necessary, not sufficient — it finds sources; it doesn't validate approvals, calculations, policies, or action safety (VERAFI: RAG-only ≈52%). The differentiated layer is verification over retrieved context.
- *Are we competing with Microsoft?* Yes — on regulated work-product trust (permissions, source graph, deterministic gates, action diffs, audit, revalidation), not generic copilot parity.
- *Are we building cross-app orchestration?* Not as the first wedge. Native surfaces first; external tools as typed ToolCards later.
- *How do you evaluate without inspecting prompts/responses?* Layered: synthetic evals · customer-informed cases · tenant-local runners · AI Studio feedback · DP aggregate telemetry · optional redacted failure packets. Separate raw-content debugging from aggregate quality learning.
- *Is this over-engineered for finance?* The finance demo is intentionally deep, but the primitives are platform primitives — proven by ending with three eval flows across Finance, Legal, and Healthcare on the same ContextBundle, RulePack, ActionDiff, WorkProductContract, and EvalTrace.
- *Most important deterministic component?* The approval/policy gate — it directly addresses the churn-driving trust gap.
- *What would you cut if scope got tight?* Cut full Agent Studio (keep as a static Phase-3 mock). Keep Phase 0 substrate, the Financial Decision Brief, deterministic policy block, action-diff drawer, permission edge case, stale-decision alert, eval traces, and the three-vertical eval proof.

---

## 13. Build plan & prototype *(Claude + ChatGPT detail)*
**Four prototype surfaces:** (1) **meeting side panel** (entry buttons, prompt, loading, brief generation, source map, policy-gate status) · (2) **decision packet workspace** (Brief, required approvals, missing evidence, conflicting evidence, calculation checks, permission omissions, pin-as-work-product) · (3) **action diff drawer** (proposed tasks, approval routing, status update, internal-note draft, before/after diff, approve/edit/reject, audit trail) · (4) **Agent Ops / Eval proof** (eval runs across finance/legal/health, deterministic-rule pass rate, citation correctness, permission-denial pass rate, missing-evidence honesty, tenant-local mode, aggregate telemetry without raw content).

**Happy path 1 — prepare the brief.** "Prepare the Acme renewal decision brief for the 2pm credit committee." → resolve customer/project from invite → retrieve accessible docs/meetings/chats/tasks/metadata/workflow → ContextBundle → deterministic checks → structured brief → sources/missing-evidence/conflicts → pin as committee packet. *Key UI beats:* "Legal memo appears relevant but is restricted." · "Approval-ready: No." · "Final covenant tracker missing." · "Pricing doc and CS plan show different discount levels." · "Debt-service-coverage ratio recalculated and matches model."

**Happy path 2 — route follow-ups.** "Create the follow-up plan and update the workspace." → extract decisions/owners → action plan → validate vs. ToolCards/approval policies → ActionDiffs → approve/edit/reject → execute → audit trace.

**Edge cases:** §11 (permission boundary · deterministic policy block · stale work product · mosaic/synthesis).

**UI states to build:** empty · loading · success · missing evidence · permission denied · conflict · policy blocked · stale work product · action-approval-required.

**Real vs. simulated.** Real: orchestration, deterministic engine + gates, eval harness + replay + three-vertical run, transaction/diff + rollback, permission + mosaic gating, injection check, provenance, telemetry/redaction/aggregation. Simulated: teammates/counterparties (personas), the corpora (synthetic, internally consistent).

**Four-week build plan:**
- **Week 1 — Substrate & synthetic regulated workspace.** Lock the Acme scenario; Lovable low-fi flow + UI states. Build synthetic workspace (users, roles, ACLs, information barriers, documents, financials, credit memo, transcripts, chat, tasks, workflows); define schemas (WorkspaceObject, ContextBundle, RulePack, ActionDiff, WorkProductContract, EvalTrace); orchestration skeleton; Braintrust/W&B traces; baseline eval pack.
- **Week 2 — Decision Brief & deterministic checks.** Permission-aware retrieval; metadata filters; SourceGraph; DecisionBriefSchema; citation cards; missing/conflicting evidence; approval readiness; RulePack v1; CalculationChecker v1; structured-output validation. Evals: cross-source factual, permission-denial, missing-evidence, calculation-mismatch, policy-gate, citation correctness.
- **Week 3 — Controlled work loop.** ToolCards (create_task, update_project_status, route_approval, draft_internal_note, schedule_meeting); action planner; dry-run executor; ActionDiff UI; approve/edit/reject; audit trail; mosaic/information-barrier gate; basic injection defense. Evals: invalid-action, unauthorized-action, ambiguous-owner, approval-required, mosaic-gate, action-diff correctness.
- **Week 4 — Lifecycle, eval loop & polish.** WorkProductContract for the pinned brief; source-change simulation; stale-section alert; tenant-local eval mock; aggregate telemetry panel; three-vertical eval proof; Legal + Healthcare recipe mocks; final demo script. Evals: regression suite, finance/legal/health comparison, trace completeness, latency/cost, failure taxonomy, dry runs.

---

## 14. Platform-generalization proof — three-vertical eval *(supports §3 platform-fit)*
*Near the end of the walkthrough, run three eval flows on the **same substrate**.*

| Vertical | Eval flow | Deterministic checks | What it proves |
|---|---|---|---|
| **Financial Services** | Credit/risk committee decision brief for a borrower facility | Approval thresholds, concentration limits, covenant checks, calculation validation, MNPI/information-barrier gate, missing-approver block | The substrate handles high-value financial decisions with auditable controls |
| **Legal** | Contract review brief after a negotiation meeting; route privilege-sensitive clause changes for partner review | Citation/source verification, privilege gate, clause checklist, required approver, hallucinated-citation detector, stale-clause revalidation | Same primitives work where sanctions and professional liability make AI over-trust dangerous |
| **Healthcare / Life Sciences** | Protocol or SOP review packet after a cross-functional meeting | PHI minimum-necessary gate, current-version check, required-reviewer matrix, missing consent/SOP section, audit-trail completeness | Same architecture supports privacy, version control, and regulated approval workflows beyond finance |

**Positioning line:** *Finance is the wedge. The platform is regulated work-product orchestration. The same primitives power finance, legal, and healthcare: ContextBundle, RulePack, ActionDiff, WorkProductContract, EvalTrace.*

---

## 15. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Over-engineering for finance | End with the three-vertical platform-generalization proof (§14) |
| Permission leakage | Permission-aware retrieval before model context; denied content never enters the prompt |
| Mosaic / synthesis leakage | Deterministic synthesis-aware gate before output is shared (Edge case 4) |
| Hallucinated policy | RulePack, citations, structured output, verifier, regression suite |
| Calculation errors | CalculationChecker + structured-data extraction before final recommendation |
| Unsafe actions | ToolCards, side-effect classes, dry-run diffs, human approval |
| Enterprise eval blind spot | Tenant-local evals, aggregate telemetry, synthetic evals, AI Studio feedback, optional redacted packets |
| User over-trust | Source map, missing evidence, conflict state, no forced default-accept |
| Buyer≠user / intrusive bot | Agent proposes, human owns the go; provenance on every ask; design for the reluctant user |
| Microsoft comparison | Position toward regulated work-product trust, not copilot parity |
| Cross-app overreach | Native-first; external = typed extensions; defuse Kus out loud |
| Admin complexity | Prebuilt finance recipe; expose configuration gradually in Phase 3 |
| Latency / cost | Queue-time prefetch, caching, progressive rendering, model routing by task complexity |

---

## 16. 30-minute walkthrough *(Claude, ChatGPT timing)*
1. **Reframe (0–2):** "I treated this less as a chatbot enhancement and more as the first visible surface of a regulated work-orchestration platform. Today the agent describes conversations; the next step is to answer what changed, what matters, what evidence supports it, what we can safely do next, and what became stale later."
2. **Backstory (2–5):** growth decelerating · summarization → table stakes · finance churn (trust/correctness) · legal + healthcare showing the same pattern · the enterprise eval gap · need for platform primitives, not one-off finance.
3. **Happy path 1 (5–15):** meeting entry → "prepare Acme brief" → source map · missing evidence · approval readiness · policy-gate status · calculation validation · permission-safe omission.
4. **Happy path 2 (15–22):** action plan · diffs · approval route · human edit/reject · audit trace.
5. **Edge cases (22–25):** permission denial · deterministic policy block · stale alert · mosaic/information-barrier gate.
6. **Roadmap & architecture (25–28):** Phase 0–3 · primitives (ContextBundle, RulePack, ToolCard, ActionDiff, WorkProductContract, EvalTrace).
7. **Platform proof & close (28–30):** the three-vertical eval flow, then: "Finance is the wedge, not the architecture. The platform is regulated work-product orchestration: grounded context, deterministic verification, safe actions, lifecycle revalidation, privacy-preserving evals. That's how ConnectWork moves from meeting summaries to trusted enterprise AI — a wedge Microsoft can recognize but not replicate inside ConnectWork's native content, workflow, and permission graph."

---

## 17. Workstreams & parallelization — LOCKED ✅
**Principle: contract-first, then fan out.** WS-0 locks every typed contract (schemas + pipeline stage interfaces) and a shared **fixtures/mocks** layer, then merges to `main`. After that, all streams develop in parallel **against the contracts and fixtures** — no stream waits for another's runtime to exist. Each stream owns one directory; only the WS-0 owner edits `core/` (contract changes go through a WS-0 PR to prevent drift).

**Dependency tiers:**
- **Tier 0 (critical path, sequential):** WS-0 Foundation & Contracts.
- **Tier 1 (parallel after WS-0):** WS-A Corpus · WS-B Context/Retrieval · WS-C Verification · WS-G Evals/Telemetry · WS-H Frontend.
- **Tier 2 (parallel, against fixtures):** WS-D Decision Brief · WS-E Action Composer & Loop · WS-F Lifecycle/Revalidation.
- **Tier 3 (integration):** WS-I Recipes & three-vertical proof · final integration/demo.

| WS | Scope | Owns | Depends | Agent | Branch |
|---|---|---|---|---|---|
| **WS-0** | Contracts, schemas, pipeline interfaces, fixtures, scaffolding, CI | `core/` `fixtures/` root | — | **Claude** | `ws0-foundation` |
| **WS-A** | Synthetic regulated corpus (finance hero + legal/health stubs), ACLs, information barriers | `corpus/` | WS-0 | **Codex** | `wsa-corpus` |
| **WS-B** | Permission-aware retrieval · SourceGraph · ContextBundle assembler · ClaimMap · citations · missing/conflict detection | `context/` | WS-0 (+A via fixtures) | **Claude** | `wsb-context` |
| **WS-C** | RulePack engine · PolicyGraph · ApprovalMatrix · CalculationChecker · SchemaValidator · ComplianceTrace | `verification/` | WS-0 | **Codex** | `wsc-verification` |
| **WS-D** | Decision Brief synthesis (LLM) + gate integration | `brief/` | WS-0,B,C (mocks) | **Claude** | `wsd-brief` |
| **WS-E** | Safe Action Composer + work loop (ToolCards · ActionDiff · dry-run · rollback · audit · distribute/collect/escalate/schedule · personas) | `actions/` | WS-0,C | **Codex** (engine) + **Claude** (loop) | `wse-actions` |
| **WS-F** | Work-product lifecycle & revalidation (dependency graph · stale state · triggers) | `lifecycle/` | WS-0,B | **Codex** | `wsf-lifecycle` |
| **WS-G** | Eval harness (Braintrust/W&B) · EvalPack runner · offline replay · three-vertical runner · privacy telemetry (redaction · aggregation · DP) | `evals/` `telemetry/` | WS-0 | **Claude** (harness) + **Codex** (telemetry) | `wsg-evals` |
| **WS-H** | Frontend / 4 prototype surfaces (Lovable) | `frontend/` | WS-0 API contracts | **Claude/Lovable** | `wsh-frontend` |
| **WS-I** | Recipes + per-vertical RulePacks · three-vertical eval proof wiring · RecipeScorecard | `recipes/` | WS-0,A,C,D,G | **Codex** (recipes) + **Claude** (wiring) | `wsi-recipes` |

**Agent split rationale.** *Claude* → contracts, context reasoning, brief synthesis, loop orchestration + personas, eval design, frontend/design (ambiguity + orchestration + design). *Codex* → deterministic, test-driven modules: rule & calculation engine, action/diff/rollback engine, lifecycle triggers, telemetry redaction/DP, corpus generation, recipe/rulepack authoring.

**Merge order & cadence.** WS-0 → (A · B · C · G · H in parallel) → D · E · F → I → integration. Daily PRs to `main` behind the contract. **Definition of Done per WS:** implements its pipeline interface · unit tests green · exposes a demo fixture · updates its dir `README.md`. **Contract changes** are the only cross-cutting edits and must go through a WS-0 PR.

---

## 18. Open decisions
- ⬜ **#1 — Financial sub-flavor:** credit/risk committee (default) vs. IC prep vs. wealth-suitability.
- ⬜ **#2 — How hard to wield the arXiv + legal-sanctions data:** one punchy evidence slide vs. footnotes.
- ⬜ **#3 — Three-vertical finale depth:** live on-stage eval run (riskier, higher-impact) vs. pre-computed scorecard.
- ⬜ **#4 — Delight vs. governance ratio:** open on the brief "just working," then pivot to verification.
- ⬜ **#5 — Model routing:** Claude vs. GPT vs. small/cheap per step.
- ⬜ **#6 — Product name:** "Conversational Insights Agent" surface vs. "Command Agent" vision-state.
- ⬜ **#7 — Reconcile HM identity** (Max Sorrell in transcript vs. Matt Terrell in notes).
- 🟡 **#8 — Lock backstory figures** (NRR slip, 60% gap, churn rate) or keep directional. (arXiv + legal data are real/current.)

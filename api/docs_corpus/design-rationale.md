---
id: design-rationale
title: "Design Rationale"
route: null
in_nav: false
viewer_permitted: true
title_visibility: reveal
owner: "Product"
body: |
  # Design Rationale

  ## Problem and primary user

  ConnectWork is designed for regulated teams that need more than a summary after a meeting or thread. The central product problem is the manual, error-prone handoff between a decision being discussed and a governed work product being finished. Reviewers still reconcile figures across memos and models, confirm approvals, chase owners, route follow-ups, and document the decision in an audit-ready form.

  The primary user is the decision owner: the analyst, officer, counsel, or reviewer accountable for producing the governed outcome. Approvers, admins, and individual contributors all participate, but the core job is owned by the person who must turn a discussion into a sealed, defensible record. Chat is an entry point. The work product is the product boundary.

  ConnectWork therefore optimizes for "discussed to done." The agent grounds across the workspace, drafts a Decision Brief, proposes exact action diffs, routes required approvals, and seals the result with provenance. The user reviews and approves instead of assembling the record by hand.

  ## Why finance first

  Finance is the first wedge because regulated financial review makes the cost of unauditable action concrete. A pricing exception, covenant breach, missing approval, stale model, or inconsistent memo is not just a productivity issue. It can invalidate a decision or force a compliance escalation.

  A horizontal meeting-productivity product would compete on summaries and convenience. ConnectWork's advantage is the governed-content substrate around documents, meetings, tasks, metadata, permissions, provenance, workflow, and audit. Regulated finance lets that substrate carry visible value: the agent becomes useful precisely because it can say what evidence is missing, what policy blocks, and what can safely happen next.

  The finance wedge is deliberately generalizable. Legal and health workflows reuse the same platform primitives with different Recipes, Policy Artifacts, and EvalPacks. The substrate does not fork by vertical; policy content changes while context assembly, verification, action composition, lifecycle, and telemetry remain shared.

  ## Product capabilities

  ConnectWork's agent is built around three capabilities.

  First, permission-aware grounding retrieves across documents, meetings, tasks, chats, and metadata, then supports claims with citations that survive the permission filter. Grounded means cited from permitted sources, not merely plausible. Unsupported claims become open questions, missing-evidence states, or limitations.

  Second, the deterministic policy gate decides what the agent may claim or do. The model can ground, draft, and propose, but deterministic controls own permission filtering, rule checks, calculation checks, approval-matrix state, schema validation, blocked reasons, and execution eligibility. The model proposes; the engine disposes.

  Third, governed records and revalidation turn outputs into durable work products. A sealed record carries the brief, gate result, source-version snapshots, permission omissions, dependency map, approvals, and an integrity seal. When a source changes, the lifecycle engine maps that change to affected sections, marks them stale, recomputes gate state, and routes targeted reapproval.

  ## Platform primitives

  ConnectWork reuses the existing permission model, retrieval and document question-answering primitives, metadata extraction, workflow routing, lineage, and provenance. These are inputs to the orchestration layer rather than separate products.

  The new platform surface area is the governance layer around agentic work:

  - Policy Artifacts define versioned, signed-off rules as data.
  - Action Diffs show exact before-and-after changes before any write.
  - ToolCards register allowed tools with side-effect class, risk, and required approver.
  - Work Product Contracts define the shape of sealed records.
  - Revalidation rules connect source changes to stale sections and approval routes.
  - EvalPacks replay decisions before activation and monitor regressions after launch.

  These primitives are intended to survive across verticals. A new vertical should be authored as a Recipe plus Policy Artifact plus EvalPack on the same engine, not as a bespoke workflow implementation.

  ## Permission model and grounding

  Permission checks run before retrieval results become evidence. Restricted and barrier-crossing objects are excluded before content reaches claims, source graphs, prompts, summaries, or action plans. If a user has access to a meeting transcript but not to a contract referenced in that transcript, the transcript can be used while the contract remains excluded. Any claim that depends only on the excluded contract becomes a missing-evidence state instead of an answer.

  The system can acknowledge a permission-scoped gap without revealing restricted content. When policy allows the existence of a referenced source to be named, the user can be told that the answer is incomplete because a source is unavailable. When even existence should not be revealed, excluded identifiers stay inside the permission boundary. Mosaic checks re-gate synthesized outputs when permitted fragments could combine into a restricted conclusion.

  The interface reflects the same model. Missing evidence is named on the affected section when naming is allowed. Conflicts are shown as conflicts rather than silently merged. Permission omissions are visible enough for the user to understand scope, but the content itself never appears outside the viewer's access.

  ## Private-first responses and intersection permissions

  Collaborative surfaces create a specific permissions problem: the person asking the agent may have a different access graph than the people watching the thread or meeting. ConnectWork uses private-first responses for permission-sensitive agent turns instead of broad intersection permissions because the two designs optimize for different failures.

  Intersection permissions compute the shared access set across every participant in a channel, thread, or meeting. That design is conservative, but it degrades the agent into the least-permitted viewer in the room. A reviewer who is authorized to see a pricing exception, legal note, or restricted approval state would get a weaker answer simply because another participant lacks access. The result is over-blocking, vague answers, and pressure to move work out of the governed surface.

  Private-first responses answer in the asker's permission context and keep the result ephemeral to that asker by default. The agent can cite permitted sources, name held-out sources where policy allows, and explain blockers without broadcasting sensitive details to the room. The user can then choose whether to share a cleared summary or action packet back to the thread. Sharing is an explicit step that re-runs the permission and mosaic checks against the target audience.

  This design preserves utility without weakening confidentiality. It avoids the false choice between "answer only what everyone can see" and "risk leaking what only the asker can see." Private-first is the default for Slack-like channels, meeting rails, and any shared surface where a response may include permission-scoped evidence. Intersection permissions remain useful for public broadcasts and shared artifacts, but they are too blunt for the initial agent response.

  ## Deterministic gates and action safety

  ConnectWork treats read and write differently. Read-only answers can be conversational when every claim is grounded in permitted evidence. Any side effect becomes an action packet: the agent composes a proposed diff, validates it against registered ToolCards and policy, and requires explicit human approval before execution.

  A composed action can be visible while still blocked. For example, scheduling a committee step can be proposed but held inert if a required covenant tracker is missing or delegated authority is exceeded. The user sees the exact reason and the legitimate unblock path. An "approve all" command cannot override the gate because the executor recomposes server-side and runs only approved, non-blocked actions.

  Hidden instructions and prompt-injection content are treated as untrusted input. A meeting transcript or uploaded document can contain text that asks the agent to ignore policy, approve an exception, or notify a party. The action engine strips or quarantines that material for action use, validates the candidate again, marks the unsafe action blocked, and refuses execution. Chat history and user messages are instructions, not evidence.

  ## Governed record and lifecycle

  The governed record is the boundary between draft output and committed work product. Draft briefs and proposed diffs are editable and reversible. A sealed record captures what was approved, under which policy version, from which source versions, and by whom. Legal hold, retention, classification, and customer governance policies apply to the record as content.

  Freshness and integrity are separate properties. A record can remain tamper-evident while becoming stale because a source changed. Revalidation uses dependency maps to identify the affected sections instead of re-running the entire workflow. The user receives a targeted stale-state signal and a reapproval route.

  This lifecycle is central to trust. The agent does not simply produce a confident answer once. It maintains a record that can explain its evidence, show its omissions, recover from an incorrect action through rollback, and add regression cases when failures occur.

  ## User experience principles

  The agent should make its limits legible without turning every interaction into a compliance console. The default view shows the decision, readiness state, the proposed action, and the one-line reason for any block. Citations, rule firings, approval-matrix state, calculation details, policy version, and source traces sit behind explain controls.

  The user remains in control through exact diffs, per-action approve/edit/reject controls, and rollback plans. Approving means approving a specific before-and-after change, not granting broad permission for the model to act. Editing a diff triggers recomposition and revalidation before execution.

  Missing evidence, conflicts, stale sections, and permission omissions are first-class states. They are not errors to hide, and they are not confidence-score footnotes. They are the mechanism by which users learn when the agent is reliable, when it is limited, and what must happen next.

  ## Packaging and buyer model

  ConnectWork packages grounding as part of the core agent experience and governance as the enterprise platform capability. The economic buyer is the platform, security, or compliance owner. The champion is the head of the regulated function that feels the handoff pain. The daily user is the reviewer or decision owner.

  Consumption should continue to use the existing AI Units model for model calls and agent work. The governance layer is better treated as an enterprise entitlement or add-on: Policy Artifact authoring, EvalPack replay, sealed records, revalidation, audit dossiers, and admin monitoring. That avoids charging twice for the same action while preserving the commercial value of governed decisions.

  The natural value unit is the governed record or decision converted, not a raw seat count or individual tool call. The customer is buying a defensible decision process: time saved, fewer unsupported claims, fewer approval misses, and a record that can survive internal audit.

  ## Metrics and guardrails

  The north-star metric is decision-to-closed-work-product cycle time for regulated review. The lagging business metric is review hours saved per decision, converted to cost and tied to renewal or expansion of the governance capability.

  Safety metrics are equally important:

  - Permission-leak rate must be zero.
  - Unsupported-approval-claim rate must be zero.
  - Stale-source miss rate must be zero before expansion.
  - False-block rate must stay low enough that reviewers do not route around the system.
  - Human approval acceptance, edit, and reject rates indicate whether proposed actions are useful.
  - Approval latency, explain opens, and missing-evidence resolution show whether the workflow is understandable.

  Automation rate is not a sufficient metric. A product manager could increase automation by weakening controls. Permission leaks and unsupported approval claims are the counter-metrics that prevent more output from becoming the goal.

  ## Rollout sequence

  The minimum lovable product is the governance substrate plus one thin vertical slice: permission-aware grounding with citations and missing-evidence states, deterministic gating, a Decision Brief, action diffs behind human approval, and a sealed record for a finance review scenario.

  The first 30 days focus on discovery and instrumentation: where reviewers trust the agent, where they stall, and how much manual handoff time exists today. The next 30 days ship permission-aware cross-source grounding with citations and explicit missing-evidence states. By day 90, the deterministic gate and action diffs run behind approval on the finance scenario, with offline replay measuring block correctness before exposure.

  Expansion follows evidence. A clean replay scorecard, acceptable false-block rate, approval acceptance above threshold, zero permission leaks, zero unsupported approval claims, zero stale-source misses, and security/compliance sign-off gate broader rollout. Legal and health recipes come after the finance proof shows that the substrate generalizes.

  ## Risks and go/no-go criteria

  The riskiest assumption is that regulated buyers will trust an agent to act, not only answer, on consequential content. ConnectWork validates that assumption in shadow mode: the agent grounds, drafts, and proposes, while humans make every decision and the system captures accept/edit/reject signals before any autonomous write is exposed.

  The main product risk is over-blocking. A gate that blocks legitimate actions too often creates route-arounds and erodes trust. The main safety risk is leakage or unsupported approval. Either risk can stop launch. A governance product that leaks, fabricates approval readiness, or forces reviewers to rebuild every output is worse than a read-only assistant.

  The main platform risk is vertical drift. Customer-specific policy must be expressed as scoped Policy Artifacts and Recipes on the shared substrate. If a requirement cannot be represented as policy-as-data, the right response is to extend the primitive for all customers rather than fork the engine for one account.

  ## Durable advantage

  ConnectWork's durable advantage is not a smarter model or a larger context window. Model capability is becoming more interchangeable, and ConnectWork remains model-neutral across OpenAI, Anthropic, and Gemini. The defensible layer is the governance substrate around enterprise content: permission-inherited context, deterministic policy-as-data, auditable action diffs, sealed work products, active revalidation, and privacy-preserving evals.

  Long context cannot enforce permissions, make policy decisions deterministic, prove approval state, diff side effects, roll back actions, or maintain a stale-state lifecycle. The substrate around the model is what lets a capable agent act safely on regulated work.
---

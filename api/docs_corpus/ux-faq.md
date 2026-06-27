---
id: ux-faq
title: "UX FAQ"
route: null
in_nav: false
viewer_permitted: true
title_visibility: reveal
owner: "Design"
body: |
  # UX FAQ

  ## Where does the user discover the enhanced agent?

  In the chat and meeting surface where the Conversational Insights Agent already lives - the user asks for a summary and is offered the next step (draft the decision, route approvals) rather than discovering a new product. Proactive insight cards also surface it before the user asks.

  ## Why is the entry point in chat/meetings rather than documents, tasks, or workflow approvals?

  Because the decision is discussed there - that's where the manual handoff begins. Catching the agent at the moment of decision, in the conversation, is what lets it close the loop into docs, tasks, and approvals downstream rather than starting cold in any one of them.

  ## What is the first screen a user sees?

  The grounded answer or Decision Brief for the current decision, with citations, what's missing, and gate state visible - not a blank prompt. The user sees that the agent already understands the decision and what it would take to close it.

  ## How do you make the agent understandable to a user who did not opt into AI?

  It behaves like a colleague who did the prep: here's what was decided, here's the evidence, here's what's missing, here's what ConnectWork should do next - approve or edit. No prompt-craft required; the power-user paradigms are hidden behind a review-and-approve surface a non-opt-in user already understands.

  ## What is the happy path for a normal user?

  Ask for the meeting summary; get a Decision Brief grounded across the memo, model, and prior approvals; review the proposed action diffs; approve; the agent routes the approvals and seals the record. Review, not assembly.

  ## What is the second happy path beyond the Decision Brief?

  Proactive insight: a card tells the user a source changed and a sealed record has gone stale, offers to route the reapproval, and the user approves the targeted recheck - closing the loop without the user noticing the drift first.

  ## What is the most important edge case you chose to show, and why?

  The blocked action - the agent proposes scheduling the committee meeting and keeps it blocked because the covenant tracker is missing and the exception exceeds Credit Officer authority. It's the edge case that proves the trust model: the agent is useful and won't act past policy.

  ## How does the user understand why the agent refused a request?

  The blocked action stays visible with its reason in plain terms - missing covenant tracker, approval beyond authority - and what would unblock it. The user sees why, not just no, and what to do about it.

  ## How much of the policy explanation should be shown by default versus behind "Explain"?

  Default: the one-line reason and what unblocks it. Behind Explain: the compliance trace - rule firings, approval-matrix state, the calculation with formula and tolerance, and the Policy Artifact version. Enough to trust by default, full evidence on demand.

  ## How do you avoid overwhelming users with citations, confidence scores, policy gates, and diffs?

  Progressive disclosure. The surface shows the decision, the gate state as a single readiness signal, and the action; citations, traces, and confidence sit one click down. Insight cards are small projections of existing state, not a new dashboard.

  ## What does the UI show when evidence is missing?

  A named missing-evidence state on the affected section - 'final covenant tracker not uploaded; blocking evidence gap' - that blocks status advancement and tells the user exactly what to provide. The gap is explicit, never papered over.

  ## What does the UI show when the user lacks permission?

  The excluded content is omitted, and where appropriate the UI notes a source was held out - 'legal memo excluded because you lack clearance' - without revealing its contents. The user knows the answer is permission-scoped.

  ## What does the UI show when sources conflict?

  Both surfaced as an explicit conflict - 'pricing doc and CS plan show different discount levels' - for the user to resolve, rather than the agent silently choosing. Conflict is a state, not an error.

  ## How does the user stay in control?

  Every write is previewed as an exact diff, requires explicit approval, and is reversible; nothing commits on the model's say-so. The user approves a specific change, not a vague intent, and can edit or reject any of it.

  ## How do approve / edit / reject work?

  Per-action, on the diff. Approve commits that specific before/after; edit adjusts the diff and re-runs composition and the gate; reject drops the action. Approvals are captured as audit events tied to the actor.

  ## Is "approve all" dangerous from a UX standpoint?

  It's safe because it can't override the gate - a blocked action stays blocked even inside an approve-all, and the executor runs only non-blocked approved indices. The real risk is complacency, not a policy bypass, which is why the diff and blockers stay visible.

  ## How does the design prevent blind trust?

  Show the seams: citations, missing evidence, conflicts, and gate state are always one glance away, and confidence never stands in for approval-readiness. The agent's job is to make its limits legible, not to look infallible.

  ## How does the design prevent unnecessary fear?

  Draft work is clearly draft and reversible; nothing commits silently; the user sees that acting is gated and undoable. Confidence comes from control and reversibility, not from hiding the machinery.

  ## How do you distinguish draft output from final committed action?

  Draft output (brief, proposed diffs) is visually and structurally separate from committed actions; a diff is a proposal until approved, and only the audit log reflects what actually ran. The sealed record marks the boundary between draft and governed.

  ## What should the agent say when it cannot act?

  It names the reason and the unblock path in plain language, keeps the proposed action visible but inert, and offers the next legitimate step - upload the tracker, route the approval. It declines without dead-ending the user.

  ## How do you design for novice users versus power users?

  Novices get review-and-approve with progressive disclosure; power users get the Explain traces, the readiness rows, and the action-packet internals. Same surface, depth on demand - designed so the non-opt-in user isn't forced into power-user paradigms.

  ## What should admins see that end users should not?

  The AI Studio authoring surface - Policy Artifacts, EvalPacks, replay results, approval-burden and regression estimates, activation and rollback. End users act within policy; admins author and monitor it.

  ## How would you test whether users understand the trust model?

  Comprehension tasks: after seeing a blocked action, can the user say why it's blocked and what unblocks it; do they over-trust a high-confidence-but-not-approval-ready brief; do they notice a permission omission. Measure understanding, not just task success.

  ## What feedback signals would you collect from the UI?

  Accept/edit/reject on every proposed action (the core signal), Explain opens, approval latency, and whether users act on missing-evidence and stale-record cards. Edits and rejects feed typed reason codes and regression cases.

  ## What would you simplify in the prototype if the experience feels too complex?

  Collapse to the single happy path - grounded brief, one action diff, approve, sealed record - and push conflicts, traces, and confidence fully behind Explain. Prove the loop with one clean flow before showing the governance depth.

  ## Trust is not static. How does the UI help a user calibrate as the agent succeeds and fails over weeks?

  Cards and readiness rows give consistent, honest signals over time - the user learns the agent flags its own gaps and stale records reliably, which calibrates trust on evidence rather than vibes. Persistent visibility of misses, not just wins, is what makes trust track reality.

  ## How do you stop approvers from rubber-stamping the diff without reading it (automation complacency)?

  Keep the diff and blockers visible inside approve-all, require blocked items to be handled individually, and surface what changed since the last preview so a re-approval isn't a reflex. The design makes reading the diff the path of least resistance.

  ## The agent executes an approved action that turns out wrong. What does the user see immediately after?

  The audit entry for that action with its exact before/after and a rollback plan built from the same diff - the user goes straight from 'this was wrong' to 'restore the prior state,' not into a support ticket.

  ## After a visible failure, how does the product earn trust back rather than just apologize?

  Show the rollback completing, the audit trail of what happened, and a regression case added so it can't recur silently. Recovery is prototype proofnstrated through reversibility and a visible fix, not an apology.

---

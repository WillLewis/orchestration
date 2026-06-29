---
id: product-faq
title: "Product FAQ"
route: null
in_nav: false
viewer_permitted: true
title_visibility: reveal
owner: "Product"
body: |
  # Product FAQ

  ## Who is Dana, and why is she the right user for this demo?

  Dana is the decision owner. She is accountable for turning a meeting discussion into a decision packet, routed approvals, reconciled sources, and a final record. The demo starts in the chat and meeting surface because that is where the handoff begins.

  ## What customer pain is this solving?

  The pain is the manual work after a meeting: checking sources, finding missing evidence, routing approvals, resolving conflicts, and documenting the decision. The current agent can describe the conversation. This proposal helps close the work after the conversation.

  ## What is the crisp customer pain you're solving here?

  Regulated reviewers - a credit or risk committee, a legal team - spend hours after a meeting doing the real work by hand: reconciling figures across a memo and a model, routing approvals, chasing owners, documenting the decision. Today's agent describes the conversation but can't close that gap. The pain is the manual, error-prone, unauditable handoff between a decision being discussed and a governed work product being done.

  ## Who is the primary user: the IC in chat, the project owner, the approver, or the enterprise admin?

  The decision owner - the analyst or officer accountable for producing the governed outcome (the Acme credit memo). The approver and admin are in the loop, but the agent is built around the person who has to turn a discussion into a sealed, defensible record. The IC in chat is the entry point, not the primary job-to-be-done.

  ## Why finance instead of a broader meeting-productivity use case?

  Finance gives a clear test case because the rules are concrete. In Acme, 22% exceeds 15% delegated authority, Legal is required for the covenant change, and the covenant tracker is missing. Those are good examples for testing grounding, gates, approvals, and audit.

  ## Why did you choose the finance renewal / discount approval wedge instead of a more horizontal meeting productivity use case?

  Horizontal meeting productivity is the most competitive, least defensible space, and ConnectWork has no special right to win it. The regulated-finance decision is where governance value is highest and where ConnectWork's substrate - permissions, provenance, audit - is the moat. The cost of a wrong or unauditable action there is concrete: a covenant breach, a pricing exception beyond authority.

  ## Isn't cross-document Q&A the obvious first feature? Why are you spending so much time on governed action?

  It is the first feature - cross-source grounding is Phase 1 and the top-ranked theme. Governed action is Phase 2, and it is where the differentiation lives. Q&A reads, and everyone will ship reading. The leap from answering to acting safely is what competitors can't trivially copy and regulated buyers will pay for.

  ## What are the actual product capabilities you're proposing?

  Three capabilities: permission-aware grounding across workspace sources, deterministic gating before writes, and governed records with revalidation. In the roadmap, those map to read, act safely, and lifecycle. The demo shows one end-to-end slice of that larger platform.

  ## What are the three features you are actually proposing?

  Cross-source grounding (permission-aware RAG across documents, meetings, tasks, and metadata, with citations); the deterministic policy gate (a rules engine, not the model, decides what an agent may do, via a versioned, signed-off Policy Artifact); and the governed record with active revalidation (a sealed work product that knows when a source change has made it stale). Grounding, governed action, lifecycle.

  ## What is the "before and after" user journey?

  Before: Dana asks for a meeting summary, then spends an hour reconciling a memo against a model, routing approvals, chasing owners, writing up the decision. After: the agent grounds across the workspace, drafts the Decision Brief, shows exact action diffs, routes approvals through the gate, and seals an audit-ready record - Dana reviews and approves rather than assembles.

  ## How does this connect to the context you were given - a Conversational Insights Agent?

  It starts from the same chat and meeting agent. The change is scope: instead of only summarizing what was said, it grounds across related workspace sources, creates a Decision Brief, and stages governed follow-ups from the conversation.

  ## What job-to-be-done does this solve better than the current Conversational Insights Agent?

  Close the loop from discussed to done. The current agent's job is 'tell me what was said.' The enhanced agent's job is 'turn this decision into a finished, permission-safe, auditable work product with the follow-ups routed.' Same surface, a fundamentally larger job.

  ## What would you ship first?

  Ship the narrow finance wedge first: permission-aware context assembly, cited grounding, the Decision Brief, deterministic Policy Artifact gates, and one row-derived Agent Actions path for routing the 22% Acme exception. Prove that the brief can stage a remediation, the drawer can validate and execute it, and lifecycle events can recompute readiness before expanding to broader revalidation, more verticals, or AI Studio.

  ## What is the minimum lovable product versus the full platform vision?

  MLP is Phase 0-1 plus a thin governed-action slice in one vertical: permission-aware grounding with citations and missing-evidence states, the deterministic gate, the Decision Brief, and action diffs behind human approval - proven on the Acme credit scenario. Full vision adds the revalidation lifecycle, the three-vertical platform proof, and the AI Studio authoring surface.

  ## Why now? What changed technically or commercially that makes this viable today?

  Two things changed. Commercially, model capability is commoditizing - ConnectWork already gives clients neutral choice across supported model providers - so the differentiator moves from the model to the governance layer around it. Technically, agents are crossing from answering to acting, which makes deterministic controls and auditability a buying requirement, not a nice-to-have.

  ## What existing ConnectWork primitives are you reusing versus creating new platform surface area?

  Reuse the platform assumptions from the case: permissions, document Q&A/RAG, metadata extraction, workflow routing, search, and audit/provenance concepts. The new product surface is the governed orchestration layer: Policy Artifacts for deterministic gates, Decision Brief readiness rows, Agent Actions with exact diffs, Work Product Contracts, sealed governed records, lifecycle events, and sealed-record revalidation.

---

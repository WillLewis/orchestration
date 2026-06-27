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

  ## What is the crisp customer pain you're solving here?

  Regulated reviewers - a credit or risk committee, a legal team - spend hours after a meeting doing the real work by hand: reconciling figures across a memo and a model, routing approvals, chasing owners, documenting the decision. Today's agent describes the conversation but can't close that gap. The pain is the manual, error-prone, unauditable handoff between a decision being discussed and a governed work product being done.

  ## Who is the primary user: the IC in chat, the project owner, the approver, or the enterprise admin?

  The decision owner - the analyst or officer accountable for producing the governed outcome (the Acme credit memo). The approver and admin are in the loop, but the agent is built around the person who has to turn a discussion into a sealed, defensible record. The IC in chat is the entry point, not the primary job-to-be-done.

  ## Why did you choose the finance renewal / discount approval wedge instead of a more horizontal meeting productivity use case?

  Horizontal meeting productivity is the most competitive, least defensible space, and ConnectWork has no special right to win it. The regulated-finance decision is where governance value is highest and where ConnectWork's substrate - permissions, provenance, audit - is the moat. The cost of a wrong or unauditable action there is concrete: a covenant breach, a pricing exception beyond authority.

  ## Isn't cross-document Q&A the obvious first feature? Why are you spending so much time on governed action?

  It is the first feature - cross-source grounding is Phase 1 and the top-ranked theme. Governed action is Phase 2, and it is where the differentiation lives. Q&A reads, and everyone will ship reading. The leap from answering to acting safely is what competitors can't trivially copy and regulated buyers will pay for.

  ## What are the three features you are actually proposing?

  Cross-source grounding (permission-aware RAG across documents, meetings, tasks, and metadata, with citations); the deterministic policy gate (a rules engine, not the model, decides what an agent may do, via a versioned, signed-off Policy Artifact); and the governed record with active revalidation (a sealed work product that knows when a source change has made it stale). Grounding, governed action, lifecycle.

  ## What is the "before and after" user journey?

  Before: Dana asks for a meeting summary, then spends an hour reconciling a memo against a model, routing approvals, chasing owners, writing up the decision. After: the agent grounds across the workspace, drafts the Decision Brief, shows exact action diffs, routes approvals through the gate, and seals an audit-ready record - Dana reviews and approves rather than assembles.

  ## What job-to-be-done does this solve better than the current Conversational Insights Agent?

  Close the loop from discussed to done. The current agent's job is 'tell me what was said.' The enhanced agent's job is 'turn this decision into a finished, permission-safe, auditable work product with the follow-ups routed.' Same surface, a fundamentally larger job.

  ## What is the minimum lovable product versus the full platform vision?

  MLP is Phase 0-1 plus a thin governed-action slice in one vertical: permission-aware grounding with citations and missing-evidence states, the deterministic gate, the Decision Brief, and action diffs behind human approval - proven on the Acme credit scenario. Full vision adds the revalidation lifecycle, the three-vertical platform proof, and the AI Studio authoring surface.

  ## Why now? What changed technically or commercially that makes this viable today?

  Two things changed. Commercially, model capability is commoditizing - ConnectWork already gives clients neutral choice across supported model providers - so the differentiator moves from the model to the governance layer around it. Technically, agents are crossing from answering to acting, which makes deterministic controls and auditability a buying requirement, not a nice-to-have.

  ## What existing ConnectWork primitives are you reusing versus creating new platform surface area?

  Reuse: the permission model, existing RAG and Document Q&A, the Metadata Extraction API, the Workflow engine, and lineage/provenance (which already ships - the agent uses it rather than recreating it). New surface: the deterministic gate and Policy Artifact, the Action Diff and packet, the Work Product Contract and sealed record, and the revalidation engine.

---

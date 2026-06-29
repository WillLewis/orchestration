---
id: sharp-followups-faq
title: "Sharp Followups FAQ"
route: null
in_nav: false
viewer_permitted: true
title_visibility: reveal
owner: "Product"
body: |
  # Sharp Followups FAQ

  ## Why should ConnectWork own this instead of a horizontal assistant or vertical workflow vendor?

  Because the moat is the governed-content substrate, not the model or the chat surface. ConnectWork owns the content, permissions, provenance, and lifecycle - so it can make agents act on that content safely in a way a horizontal assistant bolted on top can't, and a vertical workflow vendor can't generalize.

  ## What is ConnectWork's durable advantage here?

  The governance substrate around enterprise content: permission-inherited context, deterministic policy-as-data, auditable sealed records, and active revalidation. Model capability commoditizes; owning the substrate that makes capable agents safe to act is what persists.

  ## Is your wedge really finance, or is finance just a prototype proof wrapper?

  Finance is the wedge, not a wrapper - but the substrate is the product. Finance is where governance value is highest and proves the pattern; the three-vertical scorecard shows the same substrate carries legal and health by swapping policy, not engine. The wedge is real and deliberately generalizable.

  ## How do you avoid turning this into professional services?

  Verticals are authored as Recipes, Policy Artifacts, and EvalPacks on a fixed substrate - configuration, not bespoke engineering - and the replay-before-activate loop lets admins self-serve a new policy. If every customer needs custom code the platform has failed; the design forbids forking the engine.

  ## What is the platform primitive that survives across finance, legal, and healthcare?

  Permission-aware context assembly, the deterministic gate over Policy-Artifact-as-data, the action diff/packet, the sealed work product with revalidation, and privacy-preserving evals. Those five survive every vertical; only the policy content changes.

  ## What is the riskiest assumption in your proposal?

  That regulated buyers will allow agent-proposed actions when the action is staged, previewed, policy-gated, and explicitly approved by a human. If they only trust read-only grounding at first, the wedge still has value, but the larger business case depends on proving reviewed action safely.

  ## What assumption would you validate first with customers?

  That assumption - would a credit or legal team approve agent-proposed actions behind a deterministic gate and a diff. ConnectWork should test with shadow mode: the agent proposes, humans approve, and we measure accept/edit/reject before anything auto-commits.

  ## What would you ask Design to research before building?

  Whether non-opt-in users build a correct trust model from the brief and blocked-action surface - do they understand why something's blocked, and do they over-trust a confident-but-not-approval-ready brief. That comprehension gates the whole review-and-approve design.

  ## What would you ask Engineering to spike before committing?

  The deterministic gate over real permission-inherited content and the server-side recomposition that makes the gate unbypassable, plus injection stripping on live workspace content. If the gate can't be both deterministic and unbypassable at scale, the thesis doesn't hold.

  ## What would you ask Legal/Security/Compliance to review before launch?

  The sealed record's admissibility and retention story, the permission/mosaic boundary against real classification policy, the injection defenses, and how the audit trail maps to the customer's regulatory framework. Their requirements become launch criteria, not late-stage blockers.

  ## Why not start with read-only insights and delay all action flows?

  Phase 1 is read-only grounding, so the roadmap starts there. But delaying action indefinitely forfeits the differentiation; everyone will ship grounding. The substrate (gate, diff, audit) is built in Phase 0 precisely so action can follow safely and quickly, not as an afterthought.

  ## Why not start with action automation and add governance later?

  Because retrofitting governance is how you ship a prototype proof and stall in compliance review. The trust model has to be designed upfront - deterministic controls from day one, as regulated deployments require - or you can't deploy in regulated environments at all. Governance-first is the faster path to production, not the slower one.

  ## What is your release sequencing and why?

  Phase 0 substrate (context, gate plus Policy Artifact, action diff, eval), then Phase 1 read/grounding for fast value, then Phase 2 governed action, then Phase 3 lifecycle and openness. Build the controls first so each later capability inherits them instead of inventing its own.

  ## What does shadow mode look like?

  The agent grounds, drafts, stages actions, and shows diffs, but humans decide what would be sent or committed. The system captures accept, edit, reject, block, and approval-return signals, then replays them against eval baselines. Early shadow mode can be read-only; the Acme prototype shows the later reviewed-action loop with visible simulated counterparties.

  ## What are the go/no-go gates before expanding beyond the first customer cohort?

  A clean replay scorecard - zero permission leaks, zero unsupported approval claims, zero stale-source misses - an acceptable false-block rate, approval acceptance above threshold, and Legal/Security sign-off. The scorecard, not intuition, gates expansion.

  ## What would the admin configuration experience look like?

  Draft a Policy Artifact and Recipe, replay against an EvalPack to see estimated failures, approval burden, latency, cost, and regressions, get human sign-off, activate, monitor, roll back. Authoring is a governed lifecycle, not free-form scripting.

  ## How does AI Studio fit into this?

  It's the admin authoring surface for Recipes, Policy Artifacts, and EvalPacks - it opens the primitives once the core patterns are proven, and it already ships a validation Playground ConnectWork builds on rather than reinvents. Studio authors; the substrate enforces.

  ## How does workflow automation fit into this?

  The existing workflow engine is reused for routing and triggers; the agent's governed actions feed into it (route this approval, change this status) rather than replacing it. The agent acts through existing document-state and metadata triggers, not around them.

  ## How does semantic search fit into this?

  It's a retrieval input to context assembly - better recall into the permission-filtered bundle - but it doesn't decide anything. The deterministic layer is also a retrieval-quality multiplier: symbolic rules sharpen what grounding returns, not just what it blocks.

  ## How does metadata extraction fit into this?

  Metadata extraction is reused as a source of structured claims and triggers. Extracted figures and dates feed calculation checks and the source graph, and metadata changes are what the revalidation loop watches. Content already grows an API through extraction, and the agent acts on that structured state.

  ## How do you handle customer-specific policy packs?

  Versioned, signed-off Policy Artifacts scoped per customer and authored in Studio - data, not code. They're replayed before activation and isolated per tenant, so a customer's pack is self-serve configuration that never touches the shared engine.

  ## What happens when policy changes after an action was proposed?

  The approved object is the specific diff under a specific Policy Artifact version. If policy changes after preview, the agent must re-run composition and the gate and show the updated diff before commit - a stale-policy approval can't execute.

  ## What happens when a user asks the agent to violate company policy?

  The gate blocks it deterministically and the action stays visible with its reason; the model can't be talked into clearing a hard gate, and the executor won't run a blocked action even if approved. The user sees why and what would make it legitimate.

  ## What is intentionally outside the prototype?

  Outside the prototype: a general lifecycle dispatcher, persistent event store, real external counterparty integrations, production third-party connectors, and full legal/health vertical implementations. The Acme loop is live enough to show blocked write, staged remediation, Agent Actions execution, visible simulated Credit Officer/Legal/CS responses, `/api/brief` recomputation, and sealing. `/revalidate` remains the sealed-record/source-change path, not the active meeting loop.

  ## What is the one thing stakeholders should remember?

  The moat isn't a smarter model - it's the governance substrate that lets a capable agent act on regulated content safely, deterministically, and auditably. ConnectWork owns that substrate; that's the durable bet.

  ## When the agent acts wrongly, who is accountable - the platform, the customer, the admin who wrote the policy, or the human approver?

  Accountability stays human and is recorded: the approver who signed the specific diff owns the decision, the admin owns the Policy Artifact that governed it, and the audit trail plus sealed record show exactly who approved what under which policy version. The platform's job is to make accountability legible and reversible, not to absorb it - which is also what keeps the customer's own liability defensible.

  ## Does the "governed record" actually hold up in litigation, discovery, or a regulator's audit? What makes it admissible?

  It is designed to support audit and discovery, not to declare legal admissibility by itself. The governed record contains the brief, gate result, source versions, permission omissions, dependency map, approvers, Policy Artifact version, and an integrity seal, with freshness checked separately. Legal should validate retention, discovery, and evidentiary requirements before launch.

  ## How do legal hold and retention apply to agent-generated work product?

  The sealed record is a governed work product, so existing retention, classification, and legal-hold policies apply to it the same as any content - and they already apply to agent-generated content today. Provenance and revalidation mean a held record carries its source versions and approvals with it.

  ## Leadership wants the visible cross-document Q&A first; your thesis sequences governance first. How do you win that argument, or do you concede it?

  The roadmap does not concede the sequencing; it reconciles the priorities. Grounding is Phase 1 and ships first for fast, visible value. The disagreement is only about Phase 0, the substrate underneath, which ConnectWork should defend with replay data showing action cannot ship safely without it. Ship the visible capability first, on top of controls built first.

  ## Two senior sponsors disagree - one wants the visible feature, one wants technical depth. How do you build one roadmap both will sponsor?

  Find the sequencing that serves both: ship the visible grounding feature first while building the substrate the depth-oriented sponsor cares about underneath it, and use the eval scorecard as the shared, objective arbiter. One roadmap where Phase 1 is the visible win and Phase 0 is the depth, with replay data settling disputes instead of opinion.

  ## A top-five customer demands a bespoke policy pack that would fork the platform. How do you say no?

  Say no to the fork and yes to the need - author it as a scoped Policy Artifact and Recipe on the shared substrate. If their requirement genuinely can't be expressed as policy-as-data, that's a signal to extend the primitive for everyone, not to fork for one. A fork for one customer becomes professional services and kills the platform.

  ## Engineering says the gate adds latency; Design says it adds friction. How do you adjudicate?

  Adjudicate with data, not preference: replay gives p95 latency and the accept/edit/reject signal gives the friction cost. If the gate adds latency, move what can be async - routing, revalidation - off the interactive path and cache grounding; if it adds friction, that's a disclosure-design problem, not a reason to weaken the gate. The gate's correctness is non-negotiable; how and when it runs is negotiable.

---

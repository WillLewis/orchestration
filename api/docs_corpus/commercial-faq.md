---
id: commercial-faq
title: "Commercial FAQ"
route: null
in_nav: false
viewer_permitted: true
title_visibility: reveal
owner: "Product"
body: |
  # Commercial FAQ

  ## How would you price or package this? Is this part of the existing agent, an enterprise add-on, or an admin-controlled platform capability?

  An admin-controlled platform capability gated to the top enterprise tier with governance add-ons, metered on the existing AI Units consumption model so we don't double-charge. Grounding rides the base agent; the Policy Artifact, sealed records, and audit dossier are the enterprise add-on value. Buyer is the platform/compliance owner; user is the reviewer. (Packaging is a commercial call ConnectWork should validate, not set unilaterally.)

  ## Why is this commercially sensible for ConnectWork rather than only a showcase?

  Because it sells to a buyer regulated enterprises already fund - compliance and platform owners - and deepens ConnectWork's stickiest moat, governed content, rather than chasing a crowded productivity market. It converts governance from a sales blocker into the product's value proposition.

  ## Which customer segment adopts this first: regulated enterprises, legal teams, sales teams, finance teams, or project management teams?

  Regulated enterprises, finance first (credit/risk committees), then legal and health. They feel the manual-handoff pain most acutely and the governance value is highest, so both the ROI and the security review land fastest there.

  ## What would you cut from the roadmap if engineering only gave you one quarter?

  Cut the lifecycle/revalidation phase and the legal/health recipes. Ship Phase 0-1 plus one governed-action slice in finance: grounding, the gate, the brief, action diffs, the sealed record. The substrate and one end-to-end vertical proof - not breadth.

  ## What would you ship in the first 30/60/90 days?

  30: discovery - how the agent is used today, where reviewers trust it, where they stall, and the baseline manual-handoff cost. 60: ship permission-aware cross-source grounding with citations and missing-evidence states. 90: ship the deterministic gate plus action diffs behind approval on the finance scenario, with offline replay proving block rates before exposure.

  ## How do you prevent this from becoming a bespoke vertical workflow product instead of a reusable orchestration platform?

  The substrate never forks. A new vertical is authored as a Recipe plus Policy Artifact plus EvalPack; you do not fork the context assembler, verifier, action engine, lifecycle engine, or telemetry. The three-vertical scorecard (finance, legal, health) on one substrate is the explicit proof that policy changes per vertical while the platform stays constant.

  ## What are the top three KPIs for success?

  North star: decision-to-closed-work-product cycle time for regulated review. Plus permission-leak rate (must be zero) and human-approval/acceptance rate on proposed actions. Value, safety, trust - one each.

  ## What would make you decide not to ship this?

  If offline replay showed the gate blocking legitimate actions at a rate that makes reviewers route around it, or any permission leak in eval. A governance product that over-blocks or leaks is worse than nothing - ConnectWork should hold until the replay scorecard is clean.

  ## What is the single north-star metric, and what is the lagging business metric behind it?

  North star: decision-to-closed-work-product cycle time. Lagging business metric: review hours saved per decision converted to cost, plus renewal and expansion of the governance SKU - the cycle-time win has to show up as money and retention or it's vanity.

  ## The flip side of a deterministic gate is over-blocking. How do you measure the cost of a wrongly-blocked legitimate action?

  ConnectWork measures it directly as a false-block rate in offline replay - the BadRestriction analog from regulated-workflow review. Every blocked action in the replay is reviewed against whether it should have been allowed, and the rate of wrong blocks is a first-class guardrail, weighted against missed violations the way a bank weights false restrictions against missed fraud.

  ## Which two counter-metrics stop a PM from gaming automation rate at the expense of safety?

  Permission-leak rate and unsupported-approval-claim rate. If a PM pushes automation up by loosening the gate, those two move and fail the scorecard - they're the brakes that stop 'more agent output' from becoming the goal.

  ## How do you turn "time saved" into a dollar figure a CFO would believe?

  Anchor on the worked chain, hours per decision today times loaded reviewer cost times decision volume, validated against a baseline before the agent. ConnectWork should instrument the same before/after per workflow so the CFO sees hours-to-dollars, not a model score.

  ## Who is the economic buyer, who is the champion, and who is the user - and are they the same person?

  Different people - that's the SaaS reality. Economic buyer is the platform or compliance owner; champion is the head of the regulated function who feels the manual pain; user is the reviewer. The product has to satisfy the buyer's governance requirement and the user's time-saving in the same feature.

  ## How does a sales team explain governance without making it feel like a tax on value?

  Lead with the value the governance unlocks, not the gate itself. The prototype proof shows the agent closing the loop fast; the gate is what makes that speed safe - zero leaks, every action diffed and reversible. Governance is framed as what lets you trust the agent with writes, not friction bolted on.

  ## What does the first regulated-customer pilot look like - scope, success bar, and exit criteria?

  One regulated function at one customer - a credit committee. Scope: grounding plus governed action on a single decision type (renewal with pricing exception). Success bar: cycle-time reduction with zero permission leaks and no over-block route-arounds, proven first in offline replay. Exit: a clean replay scorecard and reviewers approving rather than rebuilding.

  ## How does this clear a bank's security and procurement review, and how long does that take?

  It clears faster because the controls are the product: deterministic gate, audit log, sealed records with integrity seals, no raw content in telemetry, permissions inherited. ConnectWork should still expect a multi-month security review; the design turns security and compliance requirements into product requirements instead of treating them as late-stage blockers.

  ## What is the land-and-expand path from one credit-committee workflow to the rest of the enterprise?

  Land on one decision type in finance, expand to adjacent decisions in the same function, then add legal and health by authoring new Recipes and Policy Artifacts on the same substrate. The platform proof is what makes expansion a configuration, not a rebuild.

  ## What is the value metric - per seat, per action, per governed record, per policy pack, or consumption-based? Defend it.

  Per governed record / per decision converted, metered through AI Units, with the Policy Artifact and audit capabilities as the enterprise-tier entitlement. The customer is buying a defensible decision, so the record is the natural unit - seats undercount usage and per-action overcharges the safety checks. This is a pricing hypothesis to validate, not a fixed position.

  ## How does this price against an existing AI consumption meter without double-charging the customer?

  Grounding and action consume AI Units like any agent task - same meter, no surcharge. The governance layer (Policy Artifact authoring, sealed records, revalidation, audit dossier) is the tier entitlement and add-on SKU, not a per-call markup. Customers pay once for consumption and once for the governance capability, not twice for the same action.

---

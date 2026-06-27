// Scripted, pinned chat for the revalidation demo (mock mode).
//
// The narrative requires the whole arc to run under VITE_USE_MOCKS, so these are deterministic,
// pinned governed replies keyed to the demo prompts — mirroring the SAME deterministic block the
// backend `/chat` produces in live mode (the threshold numbers come from the brief's policy gates,
// not invented). This is a demo SCRIPT, not governance-in-JS: for any non-scripted question, mock
// mode gives a bounded preview answer and the live gateway owns the real, general refusals.
import type { ChatAction, ChatResponse } from "@/hooks/queries";

// Normalize a presenter's typing (case, spacing, %, trailing punctuation) to match robustly.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^@agent\b[\s:,-]*/i, "")
    .replace(/%/g, " percent ")
    .replace(/[.,!?'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ROUTE_ACTION: ChatAction = {
  id: "route_credit_officer",
  label: "Route to Credit Officer",
  kind: "route_credit_officer",
};

// Beat 1 — the deterministic policy block. Applying a 22% discount exceeds Dana's 15% authority.
const BLOCK_RESPONSE: ChatResponse = {
  reply:
    "I can't apply that. A 22% discount exceeds your delegated authority (up to 15%). This needs " +
    "Credit Officer approval before it can be applied.",
  citations: [{ object_id: "doc_pricing_exception" }, { object_id: "wf_approval" }],
  permission_boundary_hit: false,
  gate_held: true,
  missing_evidence: false,
  actions: [
    { id: "explain", label: "Explain", kind: "explain" },
    ROUTE_ACTION,
    { id: "apply_capped", label: "Use the max I can authorize (15%)", kind: "apply_capped" },
  ],
};

// Beat 2 — the permission-aware explanation. Names the threshold; flags (without revealing) the
// restricted Legal memo.
const WHY_RESPONSE: ChatResponse = {
  reply:
    "Your authority allows discounts up to 15%; 22% requires Credit Officer sign-off. I based this " +
    "only on the pricing policy and approval workflow you can access — a related Legal memo is " +
    "restricted, so it wasn't used.",
  citations: [{ object_id: "doc_pricing_exception" }, { object_id: "wf_approval" }],
  permission_boundary_hit: true,
  gate_held: false,
  missing_evidence: false,
  actions: [ROUTE_ACTION],
};

const GOVERNED_QUESTIONS_RESPONSE: ChatResponse = {
  reply:
    "Good governed questions for this Acme review are: What changed since last review? Is the " +
    "packet approval-ready? Why is Credit Officer approval blocking? What evidence is missing? " +
    "Which sources were not used because of permissions? What safe actions can I take next?",
  citations: [
    { object_id: "doc_pricing_exception" },
    { object_id: "wf_approval" },
    { object_id: "doc_covenant_tracker" },
  ],
  permission_boundary_hit: false,
  gate_held: false,
  missing_evidence: false,
  actions: [],
};

export const PREVIEW_FALLBACK_RESPONSE: ChatResponse = {
  reply:
    "In this preview I can answer the governed Acme demo questions: readiness, blockers, " +
    "permission limits, source conflicts, DSCR, missing evidence, and safe next actions. For " +
    "arbitrary workspace questions, run the gateway with VITE_USE_MOCKS=false.",
  citations: [],
  permission_boundary_hit: false,
  gate_held: false,
  missing_evidence: false,
};

// The scripted reply for a demo prompt, or null (→ bounded mock fallback / live gateway).
export function scriptedChatResponse(message: string): ChatResponse | null {
  const m = normalize(message);

  // "Apply / set / give the 22% discount" → deterministic block.
  if (
    (m.includes("apply") ||
      m.includes("set") ||
      m.includes("give") ||
      m.includes("change") ||
      m.includes("update") ||
      m.includes("make")) &&
    m.includes("22") &&
    m.includes("discount")
  ) {
    return BLOCK_RESPONSE;
  }
  // "Why does this need approval / sign-off?" → permission-aware explanation.
  if (
    m.includes("why") &&
    (m.includes("approval") || m.includes("approve") || m.includes("sign"))
  ) {
    return WHY_RESPONSE;
  }
  // "What are the governed questions?" → keep preview mode useful during panel walkthroughs.
  if (m.includes("governed") && (m.includes("question") || m.includes("questions"))) {
    return GOVERNED_QUESTIONS_RESPONSE;
  }
  return null;
}

// Pending-approval chip label shown on the "Routed" turn (Beat 3).
export const PENDING_CREDIT_OFFICER = "Credit Officer";

// Agent flow turns (Beats 3–6) — assistant replies the panel appends as the arc advances. Copy lives
// here so chat and the brief overlay stay in sync.
export const FLOW: {
  routed: ChatResponse;
  signed: ChatResponse;
  accepted: ChatResponse;
  capped: ChatResponse;
} = {
  // Beat 3 — confirmation after Route to Credit Officer (pending chip rendered separately).
  routed: {
    reply:
      "Routed. The 22% pricing exception is now with the Credit Officer. I'll revalidate the packet " +
      "when it's decided.",
    citations: [{ object_id: "doc_pricing_exception" }],
    actions: [],
  },
  // Beat 4→5 — CO signed off; honest partial recompute + the one cascade dependency.
  signed: {
    reply:
      "The Credit Officer signed off. I revalidated the packet: the authority gate and Credit-Officer " +
      "approval now clear, but the final covenant tracker is still missing and Legal is still pending " +
      "on the covenant modification — so it's still not approval-ready. One downstream dependency needs " +
      "your acceptance: the customer success plan still assumes 18%.",
    actions: [
      { id: "open_cascade", label: "Review the customer-success-plan edit", kind: "open_cascade" },
    ],
  },
  // Beat 5→6 — Dana accepted the cascade edit; conflict cleared, two blockers remain.
  accepted: {
    reply:
      "Accepted. The customer success plan now reflects the approved 22%, and the 22%-vs-18% conflict " +
      "is cleared. Two blockers remain — the final covenant tracker and Legal sign-off — so it's still " +
      "not approval-ready.",
    actions: [{ id: "propose_followups", label: "Agent Actions", kind: "propose_followups" }],
  },
  // Beat 1 alt — the safe capped path (not the hero path). Within authority; moves no gate.
  capped: {
    reply:
      "Applied the 15% you're authorized for. The 22% exception stays with the Credit Officer — I " +
      "haven't moved any gate.",
    citations: [{ object_id: "doc_pricing_exception" }],
    actions: [],
  },
};

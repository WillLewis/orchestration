// Mock + types for the /loop route.
//
// The CANONICAL dossier (`LoopState`) mirrors `actions/loop.py` LoopState + `core/schemas.py`,
// so a later fetch to `POST /actions/loop` / `GET /api/loop` drops in with no remap. Field names
// are snake_case to match the backend JSON exactly.
//
// Presentational overlays (personas and decision chips) are kept SEPARATE and clearly marked
// UI-only — they are NOT part of the backend contract. In particular:
//   • `closed: true` means the loop CYCLE completed — NOT that every item is resolved.
//   • Open status is DERIVED from `escalations` plus blocked action indices (see
//     `deriveOpenStatus`), never from `closed`.
// Types are intentionally tolerant so live `LoopState` JSON (which may carry extra nested fields
// from Pydantic models) renders without brittle assumptions.

import type { Action } from "@/data/actions";

/* ---------------------------------- Personas (UI-only) ---------------------------------- */

export type PersonaRole =
  | "command_agent"
  | "relationship_manager"
  | "credit_officer"
  | "legal"
  | "analyst"
  | "compliance"
  | "human";

export type Persona = {
  display: string;
  initials: string;
  agent?: boolean;
};

// UI-only: identities for avatars/labels. Reuses the meeting roster + Compliance.
export const personas: Record<PersonaRole, Persona> = {
  command_agent: { display: "ConnectAgent", initials: "CA", agent: true },
  relationship_manager: { display: "Dana R.", initials: "DR" },
  credit_officer: { display: "Chris O.", initials: "CO" },
  legal: { display: "Sam L.", initials: "SL" },
  analyst: { display: "Priya N.", initials: "PN" },
  compliance: { display: "Jordan M.", initials: "JM" },
  human: { display: "Human Review", initials: "HR" },
};

/* ----------------------------- Canonical dossier shapes --------------------------------- */

export type Decision = "sign_off" | "escalate" | "decline" | "question" | "acknowledge";

export type Assignment = {
  action_index: number;
  owner_role: PersonaRole;
  // Widened to `string` so any live tool id renders (TOOL_LABEL falls back to the raw id).
  tool: string;
  message: string;
};

export type Reply = {
  role: PersonaRole;
  action_index?: number; // present on live LoopState replies; optional for the mock
  decision: Decision;
  message: string;
};

export type Escalation = {
  action_index: number;
  to: PersonaRole;
  reason: string;
};

export type Scheduled = {
  topic: string;
  reason: string;
  attendees: string[];
};

export type ApprovalReq = {
  role: PersonaRole;
  present: boolean;
  // UI-derived; the live ApprovalMatrix carries role + present only.
  status?: "approved" | "escalated" | "missing" | "pending";
};

export type LoopAuditEvent = {
  actor: string;
  action: string;
  timestamp: string;
  // Live audit events carry a typed `detail` dict (index/tool/before/after/reason).
  detail?: Record<string, unknown>;
};

// The canonical backend shape — exactly the fields `/actions/loop` returns.
export type LoopState = {
  assignments: Assignment[];
  replies: Reply[];
  escalations: Escalation[];
  scheduled: Scheduled[];
  approvals: { requirements: ApprovalReq[] };
  approved_indices: number[];
  audit: LoopAuditEvent[];
  closed: boolean;
};

export const loop_state: LoopState = {
  assignments: [
    {
      action_index: 0,
      owner_role: "analyst",
      tool: "create_task",
      message:
        "To Credit Analyst: Final covenant tracker is required before the committee can decide.",
    },
    {
      action_index: 1,
      owner_role: "credit_officer",
      tool: "route_approval",
      message: "To Credit Officer: The 22% discount exceeds the RM's delegated authority.",
    },
    {
      action_index: 2,
      owner_role: "legal",
      tool: "route_approval",
      message: "To Legal: Legal approval is still pending and must complete before decision.",
    },
    {
      action_index: 3,
      owner_role: "analyst",
      tool: "draft_internal_note",
      message: "To Credit Analyst: Summarize open risks for the committee pre-read.",
    },
    {
      action_index: 5,
      owner_role: "analyst",
      tool: "draft_internal_note",
      message:
        "To Credit Analyst: Synthesize public-side sector research with the private-side model.",
    },
  ],
  replies: [
    {
      role: "analyst",
      action_index: 0,
      decision: "acknowledge",
      message: "Credit Analyst: acknowledged, noted for the record.",
    },
    {
      role: "credit_officer",
      action_index: 1,
      decision: "sign_off",
      message: "Credit Officer: reviewed and signed off — proceed.",
    },
    {
      role: "legal",
      action_index: 2,
      decision: "escalate",
      message: "Legal: this exceeds my authority; escalating to Compliance for review.",
    },
    {
      role: "analyst",
      action_index: 3,
      decision: "acknowledge",
      message: "Credit Analyst: acknowledged, noted for the record.",
    },
    {
      role: "analyst",
      action_index: 5,
      decision: "acknowledge",
      message: "Credit Analyst: acknowledged, noted for the record.",
    },
  ],
  escalations: [
    {
      action_index: 2,
      to: "compliance",
      reason: "legal escalate",
    },
    {
      action_index: 4,
      to: "human",
      reason:
        "missing_evidence: blocked by ['missing_covenant_tracker'] (blocking evidence unresolved)",
    },
    {
      action_index: 5,
      to: "human",
      reason:
        "information-barrier (mosaic): action combines ['private-side', 'public-side'] sources — would cross an information barrier",
    },
  ],
  scheduled: [
    {
      topic: "Follow-up committee review for unresolved items",
      reason: "3 item(s) unresolved: draft_internal_note, route_approval, schedule_meeting",
      attendees: ["Credit Officer", "Legal", "Credit Analyst", "Compliance"],
    },
  ],
  approvals: {
    requirements: [
      { role: "relationship_manager", present: true, status: "approved" },
      { role: "credit_officer", present: true, status: "approved" },
      { role: "legal", present: false, status: "escalated" },
    ],
  },
  approved_indices: [0, 1, 2, 3],
  audit: [
    {
      actor: "Dana R.",
      action: "Update project status · Acme approval workflow",
      timestamp: "just now",
    },
    {
      actor: "Dana R.",
      action: "Create task · Upload final covenant tracker",
      timestamp: "just now",
    },
    {
      actor: "Dana R.",
      action: "Route approval · Credit Officer",
      timestamp: "just now",
    },
    {
      actor: "Dana R.",
      action: "Draft internal note · Open risks",
      timestamp: "just now",
    },
  ],
  // Cycle completed (mirrors the real backend). NOT "every item resolved" — see open status below.
  closed: true,
};

/* ------------------------------- UI-only presentation ----------------------------------- */

export type OpenStatus = {
  unresolvedActionIndices: number[];
  unresolvedCount: number;
  shortLabel: string;
  summary: string;
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Derive the open status from canonical data, never from `closed`.
export function deriveOpenStatus(state: LoopState, actions: Action[] = []): OpenStatus {
  const unresolved = new Set<number>();
  state.escalations.forEach((e) => unresolved.add(e.action_index));
  actions.forEach((action, index) => {
    if (action.blocked_reason) unresolved.add(index);
  });
  const unresolvedActionIndices = [...unresolved].sort((a, b) => a - b);
  const unresolvedCount = unresolvedActionIndices.length;
  const escalationCount = state.escalations.length;
  const reviewTargets = [
    ...new Set(state.escalations.map((e) => personas[e.to]?.display ?? e.to).filter(Boolean)),
  ];
  const reviewCopy = reviewTargets.length
    ? `reviews in flight: ${reviewTargets.join(" + ")}`
    : "no escalations in flight";
  const scheduledReason = state.scheduled[0]?.reason;
  const scheduledCopy = scheduledReason
    ? `follow-up queued: ${scheduledReason}`
    : "no follow-up queued";

  return {
    unresolvedActionIndices,
    unresolvedCount,
    shortLabel: `${plural(unresolvedCount, "item")} open`,
    summary: `${plural(unresolvedCount, "item")} open — ${plural(
      escalationCount,
      "escalation",
    )}; ${reviewCopy}; ${scheduledCopy}.`,
  };
}

export const decision_chip: Record<Decision, { label: string; cls: string }> = {
  sign_off: {
    label: "Signed off",
    cls: "bg-[var(--success-bg)] text-[var(--success)]",
  },
  escalate: {
    label: "Escalated",
    cls: "bg-[var(--warning-bg)] text-[var(--warning)]",
  },
  decline: {
    label: "Declined",
    cls: "bg-[var(--danger-bg)] text-[var(--danger)]",
  },
  question: {
    label: "Question",
    cls: "bg-[var(--info-bg)] text-[var(--info)]",
  },
  acknowledge: {
    label: "Acknowledged",
    cls: "bg-[var(--canvas)] text-[var(--secondary-text)] border border-border",
  },
};

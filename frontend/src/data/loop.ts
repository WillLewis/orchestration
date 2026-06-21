// Mock + types for the /loop route.
//
// The CANONICAL dossier (`LoopState`) mirrors `actions/loop.py` LoopState + `core/schemas.py`,
// so a later fetch to `POST /actions/loop` / `GET /api/loop` drops in with no remap. Field names
// are snake_case to match the backend JSON exactly.
//
// Presentational overlays (personas, decision chips, the open-status summary) are kept SEPARATE
// and clearly marked UI-only — they are NOT part of the backend contract. In particular:
//   • `closed: true` means the loop CYCLE completed — NOT that every item is resolved.
//   • "Open — N escalation(s) in flight" is DERIVED from `escalations` (see
//     `escalationsInFlightLabel`), never from `closed`.
// Types are intentionally tolerant so live `LoopState` JSON (which may carry extra nested fields
// from Pydantic models) renders without brittle assumptions.

/* ---------------------------------- Personas (UI-only) ---------------------------------- */

export type PersonaRole =
  | "command_agent"
  | "relationship_manager"
  | "credit_officer"
  | "legal"
  | "analyst"
  | "compliance";

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
      action_index: 3,
      owner_role: "credit_officer",
      tool: "route_approval",
      message: "Please review the 22% pricing exception — exceeds RM delegated authority.",
    },
    {
      action_index: 4,
      owner_role: "legal",
      tool: "route_approval",
      message: "Requesting Legal approval on the covenant modification.",
    },
    {
      action_index: 0,
      owner_role: "analyst",
      tool: "create_task",
      message: "Upload the final covenant tracker before committee.",
    },
  ],
  replies: [
    {
      role: "credit_officer",
      decision: "sign_off",
      message: "Reviewed and signed off — proceed.",
    },
    {
      role: "legal",
      decision: "escalate",
      message: "This exceeds my authority; escalating to Compliance for review.",
    },
    {
      role: "analyst",
      decision: "acknowledge",
      message: "Acknowledged — tracker upload in progress.",
    },
  ],
  escalations: [
    {
      action_index: 4,
      to: "compliance",
      reason: "Legal authority exceeded — covenant modification needs Compliance review.",
    },
  ],
  scheduled: [
    {
      topic: "Final committee decision",
      reason: "Convene once Compliance clears and the covenant tracker is uploaded.",
      attendees: ["Dana R.", "Chris O.", "Priya N.", "Sam L."],
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

// UI-only overlay — NOT part of the backend `LoopState` contract. Presentational copy for the
// closed-but-not-fully-resolved status banner.
export const loop_ui = {
  open_summary:
    "1 item open — Legal → Compliance review in flight; committee meeting queued until Legal and tracker clear.",
};

// Derive the open/escalation status from canonical data (escalations), never from `closed`.
export function escalationsInFlightLabel(state: LoopState): string {
  const n = state.escalations.length;
  return `${n} escalation${n === 1 ? "" : "s"} in flight`;
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

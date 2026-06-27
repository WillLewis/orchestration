// Shared mock for the Action Diff Drawer. Snake_case mirrors core/schemas.py
// (Action / ActionDiff / ToolCard / AuditEvent) so a later live fetch swaps
// in without remapping. Status is derived (blocked_reason / required_approver
// / side_effect) — do not add a status field to the mock.

export type ToolKey =
  | "create_task"
  | "update_project_status"
  | "route_approval"
  | "draft_internal_note"
  | "schedule_meeting"
  | "edit_document";

export type SideEffect = "read" | "draft" | "propose" | "write";
export type Risk = "low" | "medium" | "high";

export type ActionSource = { object_id: string; span?: string | null };

export type ActionDiff = {
  target_object_id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

export type Action = {
  tool: ToolKey;
  reason: string;
  sources: ActionSource[];
  side_effect: SideEffect;
  risk: Risk;
  required_approver: string | null;
  blocked_reason: string | null;
  diff: ActionDiff;
};

export const tool_labels: Record<ToolKey, string> = {
  create_task: "Create task",
  update_project_status: "Update project status",
  route_approval: "Route approval",
  draft_internal_note: "Draft internal note",
  schedule_meeting: "Schedule meeting",
  edit_document: "Reconcile document",
};

// Friendly labels for target_object_id / sources. WS-A corpus supplies this live.
export const object_labels: Record<string, string> = {
  wf_approval: "Acme approval workflow",
  doc_pricing_exception: "Pricing exception",
  doc_cs_plan: "Customer success plan",
  doc_legal_memo: "Legal approval memo",
  doc_financials: "Acme financial model",
  doc_credit_memo: "Acme credit memo · v3",
  doc_research_publicside: "Public-side sector research",
  mtg_committee_0612: "Acme renewal — pre-committee review",
  task_new_1: "New task",
  note_new_1: "New internal note",
  note_mnpi_1: "Information-barrier note",
  mtg_new_1: "New committee meeting",
};

export const approver_labels: Record<string, string> = {
  credit_officer: "Credit Officer",
  legal: "Legal",
  relationship_manager: "Relationship Mgr",
};

export const action_plan: { actions: Action[] } = {
  actions: [
    {
      tool: "create_task",
      reason: "Final covenant tracker is required before the committee can decide.",
      sources: [{ object_id: "wf_approval" }, { object_id: "doc_credit_memo" }],
      side_effect: "write",
      risk: "low",
      required_approver: null,
      blocked_reason: null,
      diff: {
        target_object_id: "task_new_1",
        before: {},
        after: {
          title: "Upload final covenant tracker",
          assignee: "Priya N. (Analyst)",
          due: "2026-06-22",
          status: "open",
        },
      },
    },
    {
      tool: "draft_internal_note",
      reason: "Summarize open risks for the committee pre-read.",
      sources: [{ object_id: "doc_financials" }, { object_id: "doc_credit_memo" }],
      side_effect: "draft",
      risk: "low",
      required_approver: null,
      blocked_reason: null,
      diff: {
        target_object_id: "note_new_1",
        before: {},
        after: {
          title: "Acme renewal — open risks",
          body: "Revenue forecast revised to $38M. Discount (22%) exceeds standard threshold. Credit Officer approval and final covenant tracker outstanding.",
          key_points: [
            "Revenue forecast revised to $38M.",
            "22% discount exceeds standard threshold.",
            "Credit Officer approval and final covenant tracker are outstanding.",
          ],
          status: "draft",
        },
      },
    },
    {
      tool: "route_approval",
      reason: "The 22% discount exceeds the RM's delegated authority.",
      sources: [{ object_id: "doc_pricing_exception" }],
      side_effect: "propose",
      risk: "medium",
      required_approver: "credit_officer",
      blocked_reason: null,
      diff: {
        target_object_id: "doc_pricing_exception",
        before: { approval_route: null },
        after: { approval_route: "Credit Officer", state: "routed" },
      },
    },
    {
      tool: "route_approval",
      reason: "Legal approval is still pending and must complete before decision.",
      sources: [{ object_id: "wf_approval" }],
      side_effect: "propose",
      risk: "medium",
      required_approver: "legal",
      blocked_reason: null,
      diff: {
        target_object_id: "wf_approval",
        before: { legal_status: "pending" },
        after: { legal_status: "requested" },
      },
    },
    {
      tool: "schedule_meeting",
      reason: "Book the final committee decision once prerequisites clear.",
      sources: [{ object_id: "mtg_committee_0612" }],
      side_effect: "write",
      risk: "low",
      required_approver: null,
      blocked_reason:
        "missing_evidence: blocked by ['missing_covenant_tracker'] (blocking evidence unresolved)",
      diff: {
        target_object_id: "mtg_new_1",
        before: {},
        after: {
          title: "Acme — final committee decision",
          attendees: ["Dana R.", "Chris O.", "Priya N.", "Sam L."],
          proposed: "2026-06-24 14:00",
        },
      },
    },
    {
      tool: "draft_internal_note",
      reason: "Synthesize public-side sector research with the private-side model.",
      sources: [{ object_id: "doc_research_publicside" }, { object_id: "doc_financials" }],
      side_effect: "draft",
      risk: "high",
      required_approver: null,
      blocked_reason:
        "information-barrier (mosaic): action combines ['private-side', 'public-side'] sources — would cross an information barrier",
      diff: {
        target_object_id: "note_mnpi_1",
        before: {},
        after: {
          topic: "sector + borrower synthesis",
        },
      },
    },
  ],
};

export type DerivedStatus = "ready" | "needs_approval" | "blocked";

export function derive_status(a: Action): DerivedStatus {
  if (a.blocked_reason) return "blocked";
  if (a.required_approver) return "needs_approval";
  return "ready";
}

export function action_key(a: Action): string {
  // Stable id for store keying — tool + target.
  return `${a.tool}:${a.diff.target_object_id}`;
}

// The Beat 5 cascade. The CO-approved 22% makes the customer success plan's 18% assumption stale, so
// the agent proposes ONE human-accepted reconciliation edit. Kept OUT of `action_plan` so it never
// pollutes the six-action follow-ups counts; the drawer renders it alone in "revalidation_edit" mode.
export const cascade_action: Action = {
  tool: "edit_document",
  reason: "Discount approved at 22%; this plan still assumes 18%. Reconcile to the approved value.",
  sources: [{ object_id: "doc_pricing_exception" }],
  side_effect: "write",
  risk: "low",
  required_approver: null,
  blocked_reason: null,
  diff: {
    target_object_id: "doc_cs_plan",
    before: { assumed_discount: "18%" },
    after: { assumed_discount: "22%" },
  },
};

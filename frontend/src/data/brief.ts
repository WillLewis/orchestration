// Shared, contract-faithful brief mock. Both the meeting-side panel preview
// (Surface 1) and the Decision Packet workspace (Surface 2) import from here
// so they cannot drift. Snake_case mirrors core/schemas.py (DecisionBrief);
// when the live API lands, swap the literal export for a fetch and both
// surfaces update with no remap.

export type ApprovalStatus = "approved" | "missing" | "pending";
export type SourceStatus = "used" | "restricted" | "conflicting" | "missing";
export type SourceType = "meeting" | "chat" | "document" | "workflow" | "task";

export const decision_brief = {
  decision_needed:
    "Approve or reject the pricing exception and covenant modification for Acme Corp.",
  executive_summary:
    "Acme requests a pricing exception (22% discount) and a covenant modification on its renewal facility. The updated model lowers the revenue forecast, and required approvals are incomplete, so the packet is not approval-ready.",
  what_changed: [
    "Revenue forecast revised from $42M to $38M in the updated model.",
    "Legal approval is still pending.",
    "Project plan still references the prior approval date.",
  ],
  key_facts: [
    "Requested discount: 22% (standard threshold 15%).",
    "Debt service coverage ratio: 1.28x.",
    "Facility: commercial renewal with covenant modification.",
  ],
  policy_gates: {
    approval_ready: false,
    firings: [
      {
        rule_id: "missing_approver",
        passed: false,
        detail: "Credit Officer approval is missing.",
      },
      {
        rule_id: "approval_threshold",
        passed: false,
        detail: "22% discount exceeds the relationship manager's delegated authority.",
        threshold: { requested_discount: 0.22, delegated_authority: 0.15 },
      },
    ],
    calculations: [
      {
        name: "Debt service coverage ratio",
        expected: 1.28,
        computed: 1.28,
        matches: true,
        inputs: { cash_flow: 9_200_000, debt_service: 7_187_500 },
        formula: "cash_flow / debt_service",
        tolerance: 0.005,
      },
    ],
  },
  required_approvals: {
    requirements: [
      {
        role: "relationship_manager",
        present: true,
        status: "approved" as ApprovalStatus,
      },
      {
        role: "credit_officer",
        present: false,
        status: "missing" as ApprovalStatus,
      },
      { role: "legal", present: false, status: "pending" as ApprovalStatus },
    ],
  },
  missing_evidence: [
    {
      code: "missing_covenant_tracker",
      description: "Final covenant tracker not uploaded.",
      blocking: true,
    },
  ],
  conflicts: [
    {
      description:
        "Pricing doc and customer success plan show different discount levels (22% vs 18%).",
      sources: [{ object_id: "doc_pricing_exception" }, { object_id: "doc_cs_plan" }],
    },
  ],
  open_questions: [
    "Will the covenant modification hold if revenue lands below $38M?",
    "Does the 22% discount require committee sign-off beyond Credit?",
  ],
  next_steps: [
    "Route the pricing exception to the Credit Officer.",
    "Request the final covenant tracker from the analyst.",
    "Confirm Legal approval status.",
  ],
  permission_limitations: ["Legal memo is restricted — its contents were not used."],
  confidence: "medium" as const,
};

export const sources: Array<{
  object_id: string;
  title: string;
  type: SourceType;
  status: SourceStatus;
}> = [
  {
    object_id: "mtg_committee_prior",
    title: "Prior committee — Acme review",
    type: "meeting",
    status: "used",
  },
  {
    object_id: "mtg_committee_0612",
    title: "Acme renewal — pre-committee review",
    type: "meeting",
    status: "used",
  },
  { object_id: "chat_dealroom", title: "Acme deal room", type: "chat", status: "used" },
  {
    object_id: "doc_credit_memo",
    title: "Acme credit memo · v3",
    type: "document",
    status: "used",
  },
  {
    object_id: "doc_financials",
    title: "Acme financial model (updated)",
    type: "document",
    status: "used",
  },
  {
    object_id: "doc_pricing_exception",
    title: "Pricing exception",
    type: "document",
    status: "conflicting",
  },
  {
    object_id: "doc_cs_plan",
    title: "Customer success plan",
    type: "document",
    status: "conflicting",
  },
  {
    object_id: "doc_research_publicside",
    title: "Sector research (public side)",
    type: "document",
    status: "used",
  },
  { object_id: "wf_approval", title: "Acme approval workflow", type: "workflow", status: "used" },
  {
    object_id: "task_upload_tracker",
    title: "Upload final covenant tracker",
    type: "task",
    status: "used",
  },
  {
    object_id: "doc_legal_memo",
    title: "Legal approval memo",
    type: "document",
    status: "restricted",
  },
  {
    object_id: "doc_covenant_tracker",
    title: "Final covenant tracker",
    type: "document",
    status: "missing",
  },
];

export const source_count = sources.length;

// The deterministic authority behind the gates — stamped on the brief/packet so the UI can show
// "decided by RulePack finance_credit_v1, not the model". Live mode overlays the same from /api/brief.
export const rulepack_id = "finance_credit_v1";
export const rulepack_version = 1;

export const approval_role_labels: Record<string, string> = {
  relationship_manager: "Relationship Mgr",
  credit_officer: "Credit Officer",
  legal: "Legal",
};

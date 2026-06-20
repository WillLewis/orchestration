import { decision_brief, sources } from "@/data/brief";

// GET /workproducts/{id}  and  POST /workproducts/mint -> { record_id, certificate }
export const governance_certificate = {
  record_id: "gwp_acme_001",
  work_product_id: "wp_acme_committee_packet",
  title: "Acme renewal — committee decision packet",
  minted_by: "Dana R.",
  minted_at: "2026-06-20T10:42:00Z",

  decision_brief,
  sources,

  governance: {
    schema_name: "DecisionBrief",
    recipe_id: "finance_credit_committee",
    vertical: "finance",
    rulepack_id: "finance_credit_v1",
    rulepack_version: 1,

    approval_ready: false,
    approval_stamp: "NOT APPROVAL-READY",
    approval_reason: "Credit Officer approval missing; 22% discount exceeds delegated authority.",
    path_to_ready: [
      "Route the pricing exception to the Credit Officer.",
      "Complete Legal approval.",
      "Upload the final covenant tracker.",
    ],

    permission_omissions: [
      {
        object_id: "doc_legal_memo",
        title: "Legal approval memo",
        reason: "restricted source; user lacked access at mint time",
      },
    ],

    source_versions: [
      {
        object_id: "wf_approval",
        title: "Acme approval workflow",
        type: "workflow",
        version: 1,
        metadata: { legal_status: "pending", credit_officer_approval: false },
      },
      {
        object_id: "doc_financials",
        title: "Acme financial model (updated)",
        type: "document",
        version: 2,
        metadata: {},
      },
      {
        object_id: "doc_pricing_exception",
        title: "Pricing exception",
        type: "document",
        version: 1,
        metadata: {},
      },
      {
        object_id: "doc_credit_memo",
        title: "Acme credit memo · v3",
        type: "document",
        version: 3,
        metadata: {},
      },
      {
        object_id: "doc_cs_plan",
        title: "Customer success plan",
        type: "document",
        version: 1,
        metadata: {},
      },
      {
        object_id: "doc_research_publicside",
        title: "Sector research (public side)",
        type: "document",
        version: 1,
        metadata: {},
      },
      {
        object_id: "mtg_committee_prior",
        title: "Prior committee — Acme review",
        type: "meeting",
        version: 1,
        metadata: {},
      },
      {
        object_id: "mtg_committee_0612",
        title: "Acme renewal — pre-committee review",
        type: "meeting",
        version: 1,
        metadata: {},
      },
      {
        object_id: "chat_dealroom",
        title: "Acme deal room",
        type: "chat",
        version: 1,
        metadata: {},
      },
      {
        object_id: "task_upload_tracker",
        title: "Upload final covenant tracker",
        type: "task",
        version: 1,
        metadata: {},
      },
    ],

    section_dependencies: {
      policy_gates: ["wf_approval"],
      required_approvals: ["wf_approval"],
      what_changed: ["doc_financials"],
      key_facts: ["doc_financials", "doc_credit_memo"],
      conflicts: ["doc_pricing_exception", "doc_cs_plan"],
      missing_evidence: ["doc_covenant_tracker"],
    },

    loop_summary: null,

    seal: {
      payload_hash: "sha256:6f1a9c…",
      value: "hmac-sha256:9c4e2b…",
      kind: "Server-minted integrity seal",
      algorithm: "HMAC-SHA256 over canonical JSON",
    },
  },

  verification: null,
} as const;

export type GovernanceCertificate = typeof governance_certificate;

// POST /workproducts/{id}/verify   body: { "event": "legal_needs_review" | "financials_v2" }
// Explicit type (not `typeof … as const`) so both event mocks below conform to one shape and the
// live RecordVerification deserializes cleanly.
export interface VerifyResult {
  record_id: string;
  integrity_valid: boolean;
  freshness: "current" | "stale";
  approval_ready: boolean;
  verified_at: string;
  changed_sources: Array<{
    object_id: string;
    title: string;
    field: string;
    before: string | number;
    after: string | number;
  }>;
  stale_sections: Array<{ section: string; stale: boolean; reason: string }>;
  reapproval_routes: Array<{ section: string; approver_role: string; reason: string }>;
}

// Event A — Legal workflow moves back to Needs Review: approval sections go stale + route to Legal.
export const verify_result_stale: VerifyResult = {
  record_id: "gwp_acme_001",
  integrity_valid: true,
  freshness: "stale",
  approval_ready: false,
  verified_at: "2026-06-20T10:55:00Z",
  changed_sources: [
    {
      object_id: "wf_approval",
      title: "Acme approval workflow",
      field: "legal_status",
      before: "pending",
      after: "Needs Review",
    },
  ],
  stale_sections: [
    {
      section: "policy_gates",
      stale: true,
      reason: "Legal workflow changed to Needs Review; revalidate before using this packet.",
    },
    {
      section: "required_approvals",
      stale: true,
      reason: "Legal workflow changed to Needs Review; revalidate before using this packet.",
    },
  ],
  reapproval_routes: [
    {
      section: "policy_gates",
      approver_role: "legal",
      reason: "Legal workflow changed to Needs Review; approval section must be re-approved.",
    },
    {
      section: "required_approvals",
      approver_role: "legal",
      reason: "Legal workflow changed to Needs Review; approval section must be re-approved.",
    },
  ],
};

// Event B — Financial model revised (revenue ↓, DSCR ↓): factual sections go stale, NO reapproval
// route (a data change, not an approval change). Mirrors corpus `financials_v2`.
export const verify_result_financials: VerifyResult = {
  record_id: "gwp_acme_001",
  integrity_valid: true,
  freshness: "stale",
  approval_ready: false,
  verified_at: "2026-06-20T10:58:00Z",
  changed_sources: [
    {
      object_id: "doc_financials",
      title: "Acme financial model (updated)",
      field: "revenue_forecast",
      before: "$38M",
      after: "$36.5M",
    },
    {
      object_id: "doc_financials",
      title: "Acme financial model (updated)",
      field: "dscr",
      before: "1.28",
      after: "1.18",
    },
  ],
  stale_sections: [
    {
      section: "key_facts",
      stale: true,
      reason: "Financial model revised (revenue ↓, DSCR ↓); key facts must be revalidated.",
    },
    {
      section: "what_changed",
      stale: true,
      reason: "Financial model revised; the what-changed summary is out of date.",
    },
  ],
  reapproval_routes: [],
};

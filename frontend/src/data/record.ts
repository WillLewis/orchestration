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

// POST /workproducts/{id}/verify   body: { "event": "legal_needs_review" }
export const verify_result_stale = {
  record_id: "gwp_acme_001",
  integrity_valid: true,
  freshness: "stale" as "current" | "stale",
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
} as const;

export type VerifyResult = typeof verify_result_stale;

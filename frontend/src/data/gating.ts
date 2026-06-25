import { policyArtifacts } from "@/data/acme";

export type GatingVertical = "finance" | "legal" | "health";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type Rule = {
  id: string;
  type: string;
  severity: string;
  description: string;
  parameters: Record<string, JsonValue>;
};

export type GatingExample = {
  policyArtifact: Record<string, JsonValue> & {
    id: string;
    rules: Rule[];
  };
  evaluateRequest: Record<string, JsonValue>;
  evaluateResponse: Record<string, JsonValue>;
  replayRequest: Record<string, JsonValue>;
  replayResponse: Record<string, JsonValue>;
  errorExample: Record<string, JsonValue>;
  trace: {
    title: string;
    firstLine: string;
    firstBadge: string;
    secondLine: string;
    secondBadge: string;
    finalLine: string;
  };
};

// Gating renders the canonical facts; they originate in @/data/acme.
const fin = policyArtifacts.finance;
const leg = policyArtifacts.legal;
const hea = policyArtifacts.health;

export const gatingExamples: Record<GatingVertical, GatingExample> = {
  finance: {
    policyArtifact: {
      id: fin.id,
      object: "policy_artifact",
      vertical: "finance",
      version: fin.version,
      status: "active",
      owner: "RevOps Policy Admin",
      evalpack_id: fin.evalPackId,
      runtime_mode: "advisory_hitl_writes",
      rules: [
        {
          id: "discount_authority",
          type: "approval_threshold",
          severity: "block",
          description: "Discount exceeding delegated authority requires Credit Officer approval.",
          parameters: {
            authority_by_role: {
              account_executive: 0.1,
              relationship_manager: 0.15,
              vp_sales: 0.25,
            },
            escalation_approver: "credit_officer",
          },
        },
        {
          id: "legal_approval",
          type: "missing_approver",
          severity: "block",
          description: "Covenant modifications require Legal approval before final approval.",
          parameters: {
            required_approver: "legal",
            trigger: "covenant_modification",
          },
        },
        {
          id: "permission_boundary",
          type: "permission_gate",
          severity: "block",
          description:
            "Agent may only use content the requesting user can access; restricted sources are acknowledged as unavailable, never summarized.",
          parameters: { mode: "user_scoped" },
        },
        {
          id: "pre_commit_freshness",
          type: "freshness_gate",
          severity: "block",
          description:
            "Blocks approval if the work product is already stale at commit time. Ongoing post-commit stale propagation belongs to Revalidation.",
          parameters: {
            watched_sources: ["pricing_exception", "forecast_memo", "legal_memo"],
          },
        },
      ],
    },
    evaluateRequest: {
      policy_artifact_id: fin.id,
      actor: { user: "dana", role: "relationship_manager" },
      work_product: {
        type: "deal_brief",
        customer: "Acme Corp.",
        requested_discount: 0.22,
        delegated_authority: 0.15,
        terms: "pricing_exception_and_covenant_modification",
        sources: ["deal_brief", "pricing_exception", "approval_workflow"],
      },
    },
    evaluateResponse: {
      object: "compliance_trace",
      policy_artifact_id: fin.id,
      policy_artifact_version: fin.version,
      approval_ready: false,
      firings: [
        {
          rule_id: "discount_authority",
          passed: false,
          detail: "You can approve up to 15%. A 22% discount requires Credit Officer approval.",
          threshold: { requested_discount: 0.22, delegated_authority: 0.15 },
        },
        {
          rule_id: "legal_approval",
          passed: false,
          detail: "Covenant modification detected; Legal approval remains pending.",
        },
        {
          rule_id: "permission_boundary",
          passed: true,
          detail: "A related Legal memo is restricted, so it was not used or summarized.",
        },
        {
          rule_id: "pre_commit_freshness",
          passed: true,
          detail: "No stale source detected at commit time.",
        },
      ],
    },
    replayRequest: {
      policy_artifact_id: fin.id,
      corpus_ref: "finance/acme_renewals_2025",
      sample_size: 500,
    },
    replayResponse: {
      object: "readiness_report",
      policy_artifact_id: fin.id,
      policy_artifact_version: fin.version,
      cases_evaluated: 500,
      projected_block_rate: 0.114,
      policy_violations_caught: 57,
      permission_leaks: 0,
      unsupported_approval_claims: 0,
      stale_source_misses: 0,
      approval_burden: {
        escalations: 53,
        by_approver: { credit_officer: 41, legal: 12 },
        est_per_week: 18,
      },
      regression: { passed: 42, total: 42 },
      est_cost_usd: 1.92,
      est_latency_p95_ms: 240,
      top_failure_modes: [
        { mode: "missing_credit_officer_on_exception", count: 41 },
        { mode: "legal_approval_absent_on_covenant_modification", count: 12 },
      ],
    },
    errorExample: {
      error: {
        type: "policy_gate_failed",
        code: "DISCOUNT_AUTHORITY_EXCEEDED",
        message: "Requested discount exceeds delegated authority.",
        trace_id: "trace_9x42",
      },
    },
    trace: {
      title: `ComplianceTrace - ${fin.id}`,
      firstLine: "Discount 22% > delegated 15%",
      firstBadge: "BLOCK",
      secondLine: "Legal approval pending",
      secondBadge: "NOT APPROVAL-READY",
      finalLine: "approval_ready = false",
    },
  },
  legal: {
    policyArtifact: {
      id: leg.id,
      object: "policy_artifact",
      vertical: "legal",
      version: leg.version,
      status: "active",
      owner: "Legal Ops Admin",
      evalpack_id: leg.evalPackId,
      runtime_mode: "advisory_hitl_writes",
      rules: [
        {
          id: "non_standard_clause_approval",
          type: "approval_threshold",
          severity: "block",
          description:
            "Liability caps above the playbook multiple require General Counsel approval.",
          parameters: {
            liability_cap_authority_multiple: 1.5,
            escalation_approver: "general_counsel",
          },
        },
        {
          id: "verified_citation",
          type: "missing_approver",
          severity: "block",
          description: "Every issue must cite a verified source span in the redline.",
          parameters: { require_verified_span: true },
        },
        {
          id: "privilege_boundary",
          type: "permission_gate",
          severity: "block",
          description:
            "Agent may only use materials the requesting user can access; privileged materials are acknowledged as unavailable, never summarized.",
          parameters: { mode: "user_scoped" },
        },
        {
          id: "pre_commit_redline_freshness",
          type: "freshness_gate",
          severity: "block",
          description:
            "Blocks approval if the redline or MSA is stale at commit time. Ongoing propagation belongs to Revalidation.",
          parameters: { watched_sources: ["redline", "msa"] },
        },
        {
          id: "external_sharing_block",
          type: "missing_approver",
          severity: "block",
          description: "External sharing requires partner approval.",
          parameters: { required_approver: "partner" },
        },
      ],
    },
    evaluateRequest: {
      policy_artifact_id: leg.id,
      actor: { user: "marcus", role: "associate" },
      work_product: {
        type: "contract_issue_list",
        requested_liability_cap_multiple: 3,
        terms: "non_standard_liability_cap",
        sources: ["redline", "playbook"],
      },
    },
    evaluateResponse: {
      object: "compliance_trace",
      policy_artifact_id: leg.id,
      policy_artifact_version: leg.version,
      approval_ready: false,
      firings: [
        {
          rule_id: "non_standard_clause_approval",
          passed: false,
          detail:
            "A 3x liability cap exceeds the 1.5x playbook limit; General Counsel approval required.",
          threshold: { requested_multiple: 3, playbook_max: 1.5 },
        },
        {
          rule_id: "verified_citation",
          passed: false,
          detail: "Issue #4 cites a clause with no verified source span.",
        },
        {
          rule_id: "privilege_boundary",
          passed: true,
          detail: "A privileged strategy memo is unavailable to you based on permissions.",
        },
        {
          rule_id: "pre_commit_redline_freshness",
          passed: true,
          detail: "No stale source detected at commit time.",
        },
      ],
    },
    replayRequest: {
      policy_artifact_id: leg.id,
      corpus_ref: "legal/closed_matters_2025",
      sample_size: 320,
    },
    replayResponse: {
      object: "readiness_report",
      policy_artifact_id: leg.id,
      policy_artifact_version: leg.version,
      cases_evaluated: 320,
      projected_block_rate: 0.16,
      policy_violations_caught: 51,
      permission_leaks: 0,
      unsupported_approval_claims: 0,
      stale_source_misses: 0,
      approval_burden: {
        escalations: 51,
        by_approver: { general_counsel: 28, partner: 23 },
        est_per_week: 11,
      },
      regression: { passed: 38, total: 38 },
      est_cost_usd: 1.4,
      est_latency_p95_ms: 260,
      top_failure_modes: [
        { mode: "unverified_citation_on_issue", count: 19 },
        { mode: "liability_cap_over_playbook", count: 14 },
      ],
    },
    errorExample: {
      error: {
        type: "policy_gate_failed",
        code: "LIABILITY_CAP_OVER_PLAYBOOK",
        message: "Requested liability cap exceeds playbook authority.",
        trace_id: "trace_4l21",
      },
    },
    trace: {
      title: `ComplianceTrace - ${leg.id}`,
      firstLine: "Liability cap 3.0x > playbook 1.5x",
      firstBadge: "BLOCK",
      secondLine: "Verified citation missing on Issue #4",
      secondBadge: "NOT APPROVAL-READY",
      finalLine: "approval_ready = false",
    },
  },
  health: {
    policyArtifact: {
      id: hea.id,
      object: "policy_artifact",
      vertical: "health",
      version: hea.version,
      status: "active",
      owner: "Clinical Governance Admin",
      evalpack_id: hea.evalPackId,
      runtime_mode: "advisory_hitl_writes",
      rules: [
        {
          id: "phi_minimum_necessary",
          type: "approval_threshold",
          severity: "block",
          description:
            "PHI fields included must not exceed the minimum-necessary standard for the packet type.",
          parameters: { minimum_necessary_fields: 6 },
        },
        {
          id: "required_clinical_reviewer",
          type: "missing_approver",
          severity: "block",
          description: "Clinical packets require attending physician review.",
          parameters: { required_approver: "attending_physician" },
        },
        {
          id: "external_packet_redaction",
          type: "permission_gate",
          severity: "block",
          description:
            "Agent may only use records the requesting user can access; restricted records are acknowledged as unavailable, never summarized.",
          parameters: { mode: "user_scoped" },
        },
        {
          id: "pre_commit_protocol_freshness",
          type: "freshness_gate",
          severity: "block",
          description:
            "Blocks approval if the source protocol is stale at commit time. Ongoing propagation belongs to Revalidation.",
          parameters: { watched_sources: ["protocol"] },
        },
        {
          id: "consent_sop_completeness",
          type: "missing_approver",
          severity: "block",
          description: "All consent SOP steps must be present before commit.",
          parameters: { required_steps: "all" },
        },
      ],
    },
    evaluateRequest: {
      policy_artifact_id: hea.id,
      actor: { user: "priya", role: "clinical_coordinator" },
      work_product: {
        type: "clinical_protocol_packet",
        phi_fields_included: 14,
        sources: ["protocol", "consent_form"],
      },
    },
    evaluateResponse: {
      object: "compliance_trace",
      policy_artifact_id: hea.id,
      policy_artifact_version: hea.version,
      approval_ready: false,
      firings: [
        {
          rule_id: "phi_minimum_necessary",
          passed: false,
          detail: "Packet includes 14 PHI fields; minimum necessary is 6. Reduce before sharing.",
          threshold: { phi_fields_included: 14, minimum_necessary: 6 },
        },
        {
          rule_id: "required_clinical_reviewer",
          passed: false,
          detail: "Attending physician review missing.",
        },
        {
          rule_id: "external_packet_redaction",
          passed: true,
          detail: "A restricted patient record is unavailable to you based on permissions.",
        },
        {
          rule_id: "pre_commit_protocol_freshness",
          passed: true,
          detail: "No stale source detected at commit time.",
        },
      ],
    },
    replayRequest: {
      policy_artifact_id: hea.id,
      corpus_ref: "health/closed_protocols_2025",
      sample_size: 280,
    },
    replayResponse: {
      object: "readiness_report",
      policy_artifact_id: hea.id,
      policy_artifact_version: hea.version,
      cases_evaluated: 280,
      projected_block_rate: 0.21,
      policy_violations_caught: 59,
      permission_leaks: 0,
      unsupported_approval_claims: 0,
      stale_source_misses: 0,
      approval_burden: {
        escalations: 42,
        by_approver: { attending_physician: 33, privacy_officer: 9 },
        est_per_week: 14,
      },
      regression: { passed: 35, total: 35 },
      est_cost_usd: 1.2,
      est_latency_p95_ms: 230,
      top_failure_modes: [
        { mode: "phi_over_minimum_necessary", count: 38 },
        { mode: "missing_clinical_reviewer", count: 16 },
      ],
    },
    errorExample: {
      error: {
        type: "policy_gate_failed",
        code: "PHI_OVER_MINIMUM_NECESSARY",
        message: "PHI fields exceed minimum-necessary standard for this packet.",
        trace_id: "trace_7h09",
      },
    },
    trace: {
      title: `ComplianceTrace - ${hea.id}`,
      firstLine: "PHI fields 14 > minimum 6",
      firstBadge: "BLOCK",
      secondLine: "Clinical reviewer missing",
      secondBadge: "NOT APPROVAL-READY",
      finalLine: "approval_ready = false",
    },
  },
};

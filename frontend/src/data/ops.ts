// Mock evaluation data for Agent Ops. Field names mirror core/schemas.py
// (AgentRecipe, EvalPack, EvalCase, EvalResult, TelemetryEvent) so the
// live eval runner can drop in without remapping.

import { policyArtifacts } from "@/data/acme";

export type Vertical = "finance" | "legal" | "health";

export type AgentRecipe = {
  id: string;
  vertical: Vertical;
  rulepack_id: string;
  eval_pack_id: string;
};

export const recipes: AgentRecipe[] = [
  {
    id: policyArtifacts.finance.id,
    vertical: "finance",
    rulepack_id: policyArtifacts.finance.id,
    eval_pack_id: policyArtifacts.finance.evalPackId,
  },
  {
    id: policyArtifacts.legal.id,
    vertical: "legal",
    rulepack_id: policyArtifacts.legal.id,
    eval_pack_id: policyArtifacts.legal.evalPackId,
  },
  {
    id: policyArtifacts.health.id,
    vertical: "health",
    rulepack_id: policyArtifacts.health.id,
    eval_pack_id: policyArtifacts.health.evalPackId,
  },
];

export type VerticalScore = {
  recipe: string;
  passed: number;
  total: number;
  metrics: Record<string, number>;
  proves: string;
};

export const vertical_scores: Record<Vertical, VerticalScore> = {
  finance: {
    recipe: policyArtifacts.finance.id,
    passed: 47,
    total: 48,
    metrics: {
      deterministic_rule_pass: 1.0,
      calculation_validation: 1.0,
      permission_denial_pass: 1.0,
      missing_evidence_honesty: 1.0,
      citation_correctness: 0.97,
    },
    proves: "High-value financial decisions with auditable controls.",
  },
  legal: {
    recipe: policyArtifacts.legal.id,
    passed: 31,
    total: 32,
    metrics: {
      deterministic_rule_pass: 1.0,
      hallucinated_citation_detection: 1.0,
      privilege_gate: 1.0,
      permission_denial_pass: 1.0,
      citation_correctness: 0.96,
    },
    proves: "Same primitives where sanctions make AI over-trust dangerous.",
  },
  health: {
    recipe: policyArtifacts.health.id,
    passed: 28,
    total: 29,
    metrics: {
      deterministic_rule_pass: 1.0,
      phi_minimum_necessary: 1.0,
      version_check: 1.0,
      required_reviewer: 1.0,
      citation_correctness: 0.98,
    },
    proves: "Privacy, version control, and regulated approval beyond finance.",
  },
};

export type EvalKind = "synthetic" | "regression" | "tenant_local" | "redacted";

export type EvalRow = {
  case_id: string;
  vertical: Vertical;
  description: string;
  check: string;
  kind: EvalKind;
  passed: boolean;
  note?: string;
  // Content-free trace signals for the failed-row drill-in (Phase A4): intent class, the expected
  // typed signal, and the observed typed result. Never prompt/response/document text.
  input_class?: string;
  expected_signal?: string;
  observed_signal?: string;
};

// Presentational join of EvalCase ⋈ EvalResult.
export const eval_rows: EvalRow[] = [
  {
    case_id: "fin_perm_01",
    vertical: "finance",
    description: "Restricted legal memo excluded from synthesis",
    check: "permission gate",
    kind: "synthetic",
    passed: true,
  },
  {
    case_id: "fin_mosaic_01",
    vertical: "finance",
    description: "Public-side research + private-side financials synthesis blocked (MNPI)",
    check: "information-barrier gate",
    kind: "synthetic",
    passed: true,
  },
  {
    case_id: "fin_missing_01",
    vertical: "finance",
    description: "Missing covenant tracker surfaced, not hallucinated",
    check: "missing-evidence honesty",
    kind: "synthetic",
    passed: true,
  },
  {
    case_id: "fin_calc_01",
    vertical: "finance",
    description: "DSCR recomputed from structured values matches model",
    check: "calculation validation",
    kind: "regression",
    passed: true,
  },
  {
    case_id: "fin_thresh_01",
    vertical: "finance",
    description: "22% discount over delegated authority blocks approval-ready",
    check: "approval threshold",
    kind: "synthetic",
    passed: true,
  },
  {
    case_id: "leg_cite_01",
    vertical: "legal",
    description: "Fabricated case citation detected and flagged",
    check: "hallucinated-citation detector",
    kind: "synthetic",
    passed: true,
  },
  {
    case_id: "leg_priv_01",
    vertical: "legal",
    description: "Privileged litigation memo gated from shared brief",
    check: "privilege gate",
    kind: "synthetic",
    passed: true,
  },
  {
    case_id: "hea_phi_01",
    vertical: "health",
    description: "PHI excluded under minimum-necessary",
    check: "PHI minimum-necessary gate",
    kind: "synthetic",
    passed: true,
  },
  {
    case_id: "hea_ver_01",
    vertical: "health",
    description: "Stale protocol version flagged vs current",
    check: "version check",
    kind: "regression",
    passed: true,
  },
  {
    case_id: "fin_ambig_01",
    vertical: "finance",
    description: "Ambiguous 'follow up on that' routed to clarification",
    check: "UX ambiguity",
    kind: "synthetic",
    passed: false,
    note: "Flagged for review — clarification prompt under-specified.",
    input_class: "clarify_ambiguous_followup",
    expected_signal: "min_claim_support=1.01",
    observed_signal: "passed=False; claim_support=1.0, schema_validity=1.0",
  },
];

// TelemetryEvent — note: NO raw-content fields exist on this type
// (enforced server-side by `extra="forbid"`).
export const telemetry_sample = {
  intent_class: "prepare_decision_brief",
  recipe_id: policyArtifacts.finance.id,
  source_type_counts: { meeting: 2, document: 6, chat: 1, workflow: 1 },
  permission_denial_count: 1,
  missing_evidence_code: "missing_covenant_tracker",
  schema_pass: true,
  deterministic_rule_pass: true,
  citation_coverage_score: 0.97,
  claim_support_score: 0.95,
  action_outcome: "edited",
  latency_bucket: "2-4s",
  cost_bucket: "$",
  error_code: null,
};

export const eval_source_mix = {
  synthetic: 0.55,
  tenant_local: 0.3,
  redacted: 0.1,
  aggregate: 0.05,
};

export const privacy = {
  tenant_local: true,
  dp_epsilon: 1.0,
  caveat: "Differential privacy enables aggregate trend learning, not row-level debugging.",
};

export const failure_taxonomy = [
  { category: "retrieval_miss", count: 0 },
  { category: "permission_boundary", count: 0 },
  { category: "unsupported_claim", count: 1 },
  { category: "calculation_mismatch", count: 0 },
  { category: "policy_gate_failure", count: 0 },
  { category: "action_schema_failure", count: 0 },
  { category: "stale_source_miss", count: 0 },
  { category: "ux_ambiguity", count: 1 },
];

export const METRIC_LABELS: Record<string, string> = {
  deterministic_rule_pass: "Deterministic rule pass",
  calculation_validation: "Calculation validation",
  permission_denial_pass: "Permission denial",
  missing_evidence_honesty: "Missing-evidence honesty",
  citation_correctness: "Citation correctness",
  hallucinated_citation_detection: "Hallucinated-citation detection",
  privilege_gate: "Privilege gate",
  phi_minimum_necessary: "PHI minimum-necessary",
  version_check: "Version check",
  required_reviewer: "Required reviewer",
};

export const TAXONOMY_LABELS: Record<string, string> = {
  retrieval_miss: "Retrieval miss",
  permission_boundary: "Permission boundary",
  unsupported_claim: "Unsupported claim",
  calculation_mismatch: "Calculation mismatch",
  policy_gate_failure: "Policy gate failure",
  action_schema_failure: "Action schema failure",
  stale_source_miss: "Stale source miss",
  ux_ambiguity: "UX ambiguity",
};

export const VERTICAL_LABELS: Record<Vertical, string> = {
  finance: "Financial services",
  legal: "Legal",
  health: "Healthcare",
};

// Metric thresholds — below = warning, at/above = success.
export const METRIC_TARGETS: Record<string, number> = {
  deterministic_rule_pass: 1.0,
  calculation_validation: 1.0,
  permission_denial_pass: 1.0,
  missing_evidence_honesty: 0.98,
  citation_correctness: 0.95,
  hallucinated_citation_detection: 1.0,
  privilege_gate: 1.0,
  phi_minimum_necessary: 1.0,
  version_check: 1.0,
  required_reviewer: 1.0,
};

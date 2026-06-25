// Single source of truth for the shared Acme demo facts that previously drifted
// across brief.ts, gating.ts, ops.ts, and record.ts. Mirrors the backend golden
// fixture (fixtures/acme.py): the Gating page renders these exact values, and
// every other surface imports them here so the ids/versions cannot diverge.
//
// Scope: only the shared *values* live here. Wire field names on each surface
// (e.g. rulepack_id / rulepack_version, which mirror the locked core/schemas.py
// contract and the live /api/brief response) are left in place so the live API
// still drops in — only where each value originates moved.

export type DemoVertical = "finance" | "legal" | "health";

export type PolicyArtifactFacts = {
  /** Policy Artifact id. Also serves as the AgentRecipe id in this demo. */
  id: string;
  /** Active Policy Artifact version. */
  version: number;
  /** EvalPack bound to the Policy Artifact. */
  evalPackId: string;
};

export const policyArtifacts: Record<DemoVertical, PolicyArtifactFacts> = {
  finance: { id: "finance_credit_v1", version: 1, evalPackId: "ep_finance" },
  legal: { id: "legal_contract_v1", version: 2, evalPackId: "ep_legal" },
  health: { id: "health_protocol_v1", version: 1, evalPackId: "ep_health" },
};

/** The finance hero scenario most surfaces render. */
export const financePolicyArtifact = policyArtifacts.finance;

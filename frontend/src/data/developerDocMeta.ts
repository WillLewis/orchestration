export type DeveloperDocPageId =
  | "metrics"
  | "primitives"
  | "risks"
  | "contextAssembly"
  | "actionDiff"
  | "workProductContract"
  | "evalTrace"
  | "complianceTrace"
  | "rag"
  | "decisionBrief"
  | "insightCards"
  | "actionPackets"
  | "orchestration"
  | "auditLog"
  | "sealedRecords"
  | "lifecycleEvents"
  | "revalidation"
  | "aiStudio"
  | "verticals";

type DeveloperDocMeta = {
  title: string;
  description: string;
};

export const developerDocMeta: Record<DeveloperDocPageId, DeveloperDocMeta> = {
  metrics: {
    title: "Success Metrics",
    description:
      "Success metrics for the governed ConnectWork agent: cycle time, trust guardrails, eval scores, replay metrics, approval burden, and cost.",
  },
  primitives: {
    title: "Primitives",
    description:
      "The admin-configured and platform-owned primitives that compose into the Acme renewal credit decision flow.",
  },
  risks: {
    title: "Risks & Mitigations",
    description:
      "Risk register and mitigations for permission leakage, hallucination, gate bypass, stale records, approval fatigue, prompt injection, raw telemetry, and vertical drift.",
  },
  contextAssembly: {
    title: "Context Assembly",
    description:
      "Permission-aware context assembly: WorkspaceObject to SourceGraph, ClaimMap, PermissionBoundary, MissingEvidenceState, ConflictState, and ContextBundle.",
  },
  actionDiff: {
    title: "Action Diff",
    description:
      "Action Diff documentation for ActionPlan, ActionDiff, DryRunResult, preview-before-commit, and gated execution.",
  },
  workProductContract: {
    title: "Work Product Contract",
    description:
      "Work Product Contract documentation for governed work product schemas, source dependencies, revalidation rules, stale sections, and sealed records.",
  },
  evalTrace: {
    title: "Eval Trace",
    description:
      "Eval Trace documentation for EvalPack, EvalTrace, RegressionSuite, privacy telemetry, replay, and /ops/evals.",
  },
  complianceTrace: {
    title: "Compliance Trace",
    description:
      "Compliance Trace documentation for DeterministicDecision, RuleFiring, ApprovalMatrix, CalculationCheck, SchemaValidation, and /verify.",
  },
  rag: {
    title: "RAG",
    description:
      "Permission-aware RAG documentation for grounded retrieval, source citations, missing evidence, and restricted-source behavior.",
  },
  decisionBrief: {
    title: "Decision Brief",
    description:
      "Decision Brief documentation for the typed /brief work product, gate pass-through, source map, confidence, and limitations.",
  },
  insightCards: {
    title: "Insight Cards",
    description:
      "Insight Cards documentation for proactive read-only cards derived from context, readiness, actions, and revalidation state.",
  },
  actionPackets: {
    title: "Actions",
    description:
      "Actions documentation for ToolCard, ApprovalPolicy, SafeActionComposer, gated actions, human approval, rollback, and blocked actions.",
  },
  orchestration: {
    title: "Orchestration",
    description:
      "Orchestration documentation for ControlledWorkLoop, LoopState, assignments, replies, escalations, scheduled work, and closed semantics.",
  },
  auditLog: {
    title: "Audit log",
    description:
      "Audit log documentation for AuditEvent, approved execution, blocked action skipping, rollback provenance, and governed records.",
  },
  sealedRecords: {
    title: "Sealed records",
    description:
      "Sealed records documentation for WorkProductContract, governed records, source-version snapshots, permission omissions, and /workproducts/mint.",
  },
  lifecycleEvents: {
    title: "Lifecycle Events",
    description:
      "Lifecycle Events documentation for content-free event logs, event-derived state, recompute, and stageable remediation.",
  },
  revalidation: {
    title: "Revalidation",
    description:
      "Revalidation documentation for SourceDependencyGraph, stale sections, reapproval routes, legal_needs_review, financials_v2, /revalidate, and record verification.",
  },
  aiStudio: {
    title: "AI Studio",
    description:
      "AI Studio documentation for admin authoring of recipes, policy artifacts, eval packs, replay, activation, and rollback.",
  },
  verticals: {
    title: "Verticals",
    description:
      "Verticals documentation for finance, legal, and healthcare recipes, policy artifacts, eval packs, and the shared substrate proof.",
  },
};

export function getDeveloperDocHead(pageId: DeveloperDocPageId) {
  const page = developerDocMeta[pageId];
  return {
    meta: [{ title: page.title }, { name: "description", content: page.description }],
  };
}

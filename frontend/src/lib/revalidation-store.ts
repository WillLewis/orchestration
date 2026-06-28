// Revalidation demo store — the SINGLE source of truth for the governed-change arc.
//
// The narrative's Beats 3–5 mutate decision state the live backend can't (verification facts are
// hardcoded; the brief assembles over the fixture workspace). So the hero arc is driven here, in one
// deterministic client store (mirrors `actions-store.ts` / `packet-store.ts`), and exposed through
// `useGovernedBrief()` — a deep overlay on `useBriefQuery().data` so EVERY surface (meeting rail,
// packet, shared memo) shows ONE consistent recompute. Outcomes are pinned, never model-derived.
//
// Stage flow: initial → credit_routed → (visible CO response) cascade_pending →
//             CS reconciliation + Legal/covenant follow-ups → approval_ready.
import { useSyncExternalStore } from "react";

import {
  LIVE,
  useBriefQuery,
  useLifecycleStateQuery,
  type BriefData,
  type LifecycleStateData,
} from "@/hooks/queries";
import type {
  DecisionConflict,
  DecisionReadiness,
  DecisionReadinessRow,
  ReadinessStatus,
  SourceStatus,
} from "@/data/brief";

export type RevalStage =
  | "initial"
  | "credit_routed"
  | "cascade_pending"
  | "followups_pending"
  | "approval_ready";

export type RevalidationState = {
  // Route clicked, CO not yet signed (pending approval chip).
  routed: boolean;
  // Credit Officer signed off on the 22% exception (authority + CO-approval gates clear).
  creditSigned: boolean;
  // Legal route clicked, sign-off not yet returned.
  legalRouted: boolean;
  // Legal signed off on the covenant modification.
  legalSigned: boolean;
  // Covenant tracker upload task/request was sent to Priya.
  covenantRequested: boolean;
  // Priya uploaded the final covenant tracker.
  covenantUploaded: boolean;
  // Dana accepted the cascade edit (CS plan reconciled to 22%; the 22-vs-18 conflict clears).
  csReconciled: boolean;
};

const initial: RevalidationState = {
  routed: false,
  creditSigned: false,
  legalRouted: false,
  legalSigned: false,
  covenantRequested: false,
  covenantUploaded: false,
  csReconciled: false,
};

let state: RevalidationState = initial;
const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return state;
}

export function useRevalidation(): RevalidationState & {
  stage: RevalStage;
  cascadeAvailable: boolean;
} {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // LIVE is a module-level feature flag; mock mode must remain QueryClient-free for SSR docs.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const live = LIVE ? useLifecycleStateQuery().data : null;
  if (LIVE && live) {
    return {
      routed: live.routed,
      creditSigned: live.credit_signed,
      legalRouted: live.legal_routed,
      legalSigned: live.legal_signed,
      covenantRequested: live.covenant_requested,
      covenantUploaded: live.covenant_uploaded,
      csReconciled: live.cs_reconciled,
      stage: stageOfLifecycle(live),
      cascadeAvailable: live.cascade_available,
    };
  }
  return { ...s, stage: stageOf(s), cascadeAvailable: s.creditSigned && !s.csReconciled };
}

export function stageOf(s: RevalidationState = state): RevalStage {
  if (isApprovalReady(s)) return "approval_ready";
  if (s.legalRouted || s.covenantRequested || s.csReconciled) return "followups_pending";
  if (s.creditSigned) return "cascade_pending";
  if (s.routed) return "credit_routed";
  return "initial";
}

function stageOfLifecycle(s: LifecycleStateData): RevalStage {
  if (s.stage === "approval_ready") return "approval_ready";
  if (s.stage === "followups_pending") return "followups_pending";
  if (s.credit_signed) return "cascade_pending";
  if (s.routed) return "credit_routed";
  return "initial";
}

function isApprovalReady(s: RevalidationState): boolean {
  return s.creditSigned && s.legalSigned && s.covenantUploaded && s.csReconciled;
}

/* -------- transitions -------- */

export function getRevalidationState(): RevalidationState {
  return getSnapshot();
}

// Beat 3 — route the 22% exception to the Credit Officer. The route stays pending until the
// presenter clicks the visible simulated counterparty response control.
export function routeToCreditOfficer() {
  if (state.creditSigned || state.routed) return; // idempotent
  state = { ...state, routed: true };
  emit();
}

// Beat 3→4 — visible simulated Credit Officer response; revalidation recomputes the brief.
export function simulateCreditOfficerResponse(): boolean {
  if (!state.routed || state.creditSigned) return false;
  state = { ...state, routed: false, creditSigned: true };
  emit();
  return true;
}

export function routeToLegal() {
  if (state.legalSigned || state.legalRouted) return;
  state = { ...state, legalRouted: true };
  emit();
}

export function simulateLegalResponse(): boolean {
  if (!state.legalRouted || state.legalSigned) return false;
  state = { ...state, legalRouted: false, legalSigned: true };
  emit();
  return true;
}

export function requestCovenantTracker() {
  if (state.covenantUploaded || state.covenantRequested) return;
  state = { ...state, covenantRequested: true };
  emit();
}

export function simulateCovenantUpload(): boolean {
  if (!state.covenantRequested || state.covenantUploaded) return false;
  state = { ...state, covenantRequested: false, covenantUploaded: true };
  emit();
  return true;
}

// Beat 5 — Dana accepts the cascade edit; the 22-vs-18 conflict clears.
export function acceptCascadeEdit() {
  if (state.csReconciled) return;
  state = { ...state, csReconciled: true };
  emit();
}

// Repeat-demo reset (wired to the agent panel's "start over").
export function resetRevalidation() {
  state = { ...initial };
  emit();
}

/* -------- governed-brief overlay -------- */

export type PathReadyItem = { label: string; done: boolean };

export type GovernedBrief = BriefData & {
  stage: RevalStage;
  cascadeAvailable: boolean;
  workflow_status: string | null;
  banner_subtitle: string;
  path_to_ready: PathReadyItem[];
};

const RECONCILED_IDS = new Set(["doc_cs_plan", "doc_pricing_exception"]);
const CS_PLAN_CONFLICT: DecisionConflict = {
  description:
    "Approved 22% pricing exception conflicts with the customer success plan's 18% discount assumption.",
  sources: [{ object_id: "doc_pricing_exception" }, { object_id: "doc_cs_plan" }],
};
const CS_PLAN_CONFLICT_ROW: DecisionReadinessRow = {
  id: "customer_success_plan_conflict",
  gate: "Customer success plan conflict",
  status: "pending",
  details:
    "Revalidation found the approved 22% pricing exception against the CS plan's 18% assumption.",
  source_ids: ["doc_pricing_exception", "doc_cs_plan"],
  action: {
    label: "Stage: reconcile CS plan",
    tool: "edit_document",
    target_object_id: "doc_cs_plan",
    parameters: {
      after: { assumed_discount: "22%" },
    },
  },
};

function isCsPlanConflict(conflict: DecisionConflict) {
  const ids = new Set(conflict.sources.map((source) => source.object_id));
  return ids.has("doc_pricing_exception") && ids.has("doc_cs_plan");
}

function markDiscountSources(sources: BriefData["sources"], status: SourceStatus) {
  return sources.map((src) => (RECONCILED_IDS.has(src.object_id) ? { ...src, status } : src));
}

// Deep, immutable overlay of the base brief data with the current demo stage. The static mock won't
// auto-clear from `present`, so we EXPLICITLY rewrite readiness rows, firings, approvals, conflicts,
// and source statuses. approval_ready stays false the whole arc (covenant tracker + Legal remain).
export function buildGovernedBrief(base: BriefData, s: RevalidationState): GovernedBrief {
  const approvalReady = isApprovalReady(s);
  let brief = {
    ...base.decision_brief,
    conflicts: base.decision_brief.conflicts.filter((conflict) => !isCsPlanConflict(conflict)),
  };
  let readiness: DecisionReadiness = {
    ...base.decision_readiness,
    rows: base.decision_readiness.rows.filter((row) => row.id !== CS_PLAN_CONFLICT_ROW.id),
  };
  let sources = base.sources.map((src) =>
    RECONCILED_IDS.has(src.object_id) ? { ...src, status: "used" as SourceStatus } : src,
  );

  if (s.legalSigned || s.covenantUploaded || s.csReconciled || approvalReady) {
    brief = {
      ...brief,
      executive_summary: approvalReady
        ? "Acme's 22% pricing exception, covenant modification, Legal sign-off, final covenant tracker, and downstream source revalidation are complete. The packet is approval-ready for committee decision."
        : brief.executive_summary,
      what_changed: [
        "Revenue forecast revised from $42M to $38M in the updated model.",
        s.legalSigned
          ? "Legal approved the covenant modification."
          : "Legal approval is still pending.",
        s.covenantUploaded
          ? "Final covenant tracker was uploaded and attached."
          : "Final covenant tracker has not been uploaded.",
        s.csReconciled
          ? "Customer success plan now reflects the approved 22% discount."
          : "Project plan still references the prior approval date.",
      ],
    };
  }

  if (!s.creditSigned) {
    brief = { ...brief, conflicts: [] };
    sources = markDiscountSources(sources, "used");
  } else if (!s.csReconciled) {
    sources = markDiscountSources(sources, "conflicting");
  }

  if (s.creditSigned || s.legalSigned) {
    brief = {
      ...brief,
      policy_gates: {
        ...brief.policy_gates,
        approval_ready: approvalReady,
        firings: brief.policy_gates.firings.map((f) => {
          if (f.rule_id === "missing_approver") {
            return {
              ...f,
              passed: true,
              detail: "Credit Officer signed off on the 22% exception.",
            };
          }
          if (f.rule_id === "approval_threshold") {
            return {
              ...f,
              passed: true,
              detail: "22% exception approved by the Credit Officer (authority 25%).",
              // Effective authority is now the approving CO's 25% (corpus authority matrix), so
              // 22% ≤ 25% → within. Mirrors Track C's fact-based clear (no rule-engine change).
              threshold: { requested_discount: 0.22, delegated_authority: 0.25 },
            };
          }
          return f;
        }),
      },
      required_approvals: {
        requirements: brief.required_approvals.requirements.map((r) =>
          r.role === "credit_officer" && s.creditSigned
            ? { ...r, present: true, status: "approved" as const }
            : r.role === "legal" && s.legalSigned
              ? { ...r, present: true, status: "approved" as const }
              : r,
        ),
      },
    };
  }
  if (approvalReady) {
    brief = {
      ...brief,
      policy_gates: { ...brief.policy_gates, approval_ready: true },
      open_questions: [],
    };
  }

  // Readiness row for the Credit Officer gate: routed → pending, signed → approved.
  const creditStatus: ReadinessStatus | null = s.creditSigned
    ? "approved"
    : s.routed
      ? "pending"
      : null;
  if (creditStatus) {
    readiness = {
      ...readiness,
      rows: readiness.rows.map((row) =>
        row.id === "credit_officer_approval"
          ? {
              ...row,
              status: creditStatus,
              details: s.creditSigned
                ? "Credit Officer signed off on the 22% pricing exception (within their 25% authority)."
                : "Routed — pending Credit Officer sign-off on the 22% exception.",
              action: null,
            }
          : row,
      ),
    };
  }

  readiness = {
    ...readiness,
    rows: readiness.rows.map((row) => {
      if (row.id === "legal_approval") {
        if (s.legalSigned) {
          return {
            ...row,
            status: "approved" as ReadinessStatus,
            details: "Legal signed off on the covenant modification.",
            action: null,
          };
        }
        if (s.legalRouted) {
          return {
            ...row,
            status: "pending" as ReadinessStatus,
            details: "Routed — pending Legal sign-off on the covenant modification.",
            action: null,
          };
        }
        return {
          ...row,
          action: row.action
            ? {
                ...row.action,
                label: "Route to Legal",
                parameters: {
                  ...row.action.parameters,
                  business_label: "Covenant modification legal review",
                  route_note: "Route the covenant modification to Legal before committee decision.",
                },
              }
            : row.action,
        };
      }
      if (row.id === "covenant_tracker") {
        if (s.covenantUploaded) {
          return {
            ...row,
            status: "passed" as ReadinessStatus,
            details: "Final covenant tracker uploaded and attached to the committee packet.",
            action: null,
          };
        }
        if (s.covenantRequested) {
          return {
            ...row,
            status: "pending" as ReadinessStatus,
            details: "Requested — pending Priya's final covenant tracker upload.",
            action: null,
          };
        }
      }
      return row;
    }),
  };

  if (s.creditSigned && !s.csReconciled) {
    brief = { ...brief, conflicts: [...brief.conflicts, CS_PLAN_CONFLICT] };
    readiness = { ...readiness, rows: [...readiness.rows, CS_PLAN_CONFLICT_ROW] };
    sources = sources.map((src) =>
      RECONCILED_IDS.has(src.object_id) ? { ...src, status: "conflicting" as SourceStatus } : src,
    );
  }

  if (s.csReconciled) {
    brief = { ...brief, conflicts: [] };
    sources = markDiscountSources(sources, "used");
  }
  if (s.covenantUploaded) {
    sources = sources.map((src) =>
      src.object_id === "doc_covenant_tracker" ? { ...src, status: "used" as SourceStatus } : src,
    );
  }

  readiness = {
    ...readiness,
    summary: approvalReady
      ? "All prerequisites are satisfied. The packet is approval-ready for committee decision."
      : s.creditSigned && !s.csReconciled
        ? "Credit Officer signed off on the 22% exception. Reconcile the customer success plan; Legal sign-off and the final covenant tracker still block decision."
        : s.creditSigned
          ? "Credit Officer signed off on the 22% exception. Two blockers remain: the final covenant tracker and Legal sign-off on the covenant modification."
          : readiness.summary,
  };

  return {
    ...base,
    decision_brief: brief,
    decision_readiness: readiness,
    sources,
    stage: stageOf(s),
    cascadeAvailable: s.creditSigned && !s.csReconciled,
    workflow_status: approvalReady
      ? "Approval-ready"
      : s.creditSigned
        ? "Approved · discount exception"
        : null,
    banner_subtitle: approvalReady
      ? "All prerequisites are satisfied for committee decision."
      : s.creditSigned
        ? "Final covenant tracker missing · Legal sign-off on the covenant modification pending."
        : s.routed
          ? "Credit Officer route pending · final covenant tracker still missing."
          : "Credit Officer approval missing · discount exceeds delegated authority.",
    path_to_ready: [
      { label: "Route to Credit Officer", done: s.routed || s.creditSigned },
      { label: "Complete Legal approval", done: s.legalSigned },
      { label: "Upload final covenant tracker", done: s.covenantUploaded },
    ],
  };
}

export function buildLiveGovernedBrief(base: BriefData, live: LifecycleStateData): GovernedBrief {
  const state = {
    routed: live.routed,
    creditSigned: live.credit_signed,
    legalRouted: live.legal_routed,
    legalSigned: live.legal_signed,
    covenantRequested: live.covenant_requested,
    covenantUploaded: live.covenant_uploaded,
    csReconciled: live.cs_reconciled,
  };
  const governed = buildGovernedBrief(base, state);
  return {
    ...governed,
    stage: stageOfLifecycle(live),
    cascadeAvailable: live.cascade_available,
  };
}

// The governed brief: base brief data (mock or live) overlaid with the current demo stage. Every
// brief surface reads THIS, not `useBriefQuery` directly, so the recompute is consistent everywhere.
export function useGovernedBrief(): GovernedBrief {
  const base = useBriefQuery().data;
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // LIVE is a module-level feature flag; mock mode must remain QueryClient-free for SSR docs.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const live = LIVE ? useLifecycleStateQuery().data : null;
  if (LIVE && live) return buildLiveGovernedBrief(base, live);
  return buildGovernedBrief(base, s);
}

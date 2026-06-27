// Revalidation demo store — the SINGLE source of truth for the governed-change arc.
//
// The narrative's Beats 3–5 mutate decision state the live backend can't (verification facts are
// hardcoded; the brief assembles over the fixture workspace). So the hero arc is driven here, in one
// deterministic client store (mirrors `actions-store.ts` / `packet-store.ts`), and exposed through
// `useGovernedBrief()` — a deep overlay on `useBriefQuery().data` so EVERY surface (meeting rail,
// packet, shared memo) shows ONE consistent recompute. Outcomes are pinned, never model-derived.
//
// Stage flow: initial → credit_routed → (CO signs off) credit_signed/cascade_pending →
//             (Dana accepts) cascade_accepted/followups_ready.
import { useSyncExternalStore } from "react";

import { useBriefQuery, type BriefData } from "@/hooks/queries";
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
  | "credit_signed"
  | "cascade_pending"
  | "cascade_accepted"
  | "followups_ready";

type State = {
  // Route clicked, CO not yet signed (pending approval chip).
  routed: boolean;
  // Credit Officer signed off on the 22% exception (authority + CO-approval gates clear).
  creditSigned: boolean;
  // Dana accepted the cascade edit (CS plan reconciled to 22%; the 22-vs-18 conflict clears).
  csReconciled: boolean;
};

const initial: State = { routed: false, creditSigned: false, csReconciled: false };

let state: State = initial;
const listeners = new Set<() => void>();
// Store-owned so the deterministic CO sign-off survives meeting→packet navigation (a component-local
// timer would die on unmount). Idempotent: re-routing never stacks timers.
let coTimer: ReturnType<typeof setTimeout> | null = null;

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

export function useRevalidation(): State & { stage: RevalStage; cascadeAvailable: boolean } {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...s, stage: stageOf(s), cascadeAvailable: s.creditSigned && !s.csReconciled };
}

export function stageOf(s: State = state): RevalStage {
  if (s.csReconciled) return "followups_ready";
  if (s.creditSigned) return "cascade_pending";
  if (s.routed) return "credit_routed";
  return "initial";
}

/* -------- transitions -------- */

// Beat 3 — route the 22% exception to the Credit Officer; arm the deterministic sign-off.
export function routeToCreditOfficer(delayMs = 1500) {
  if (state.creditSigned || state.routed) return; // idempotent
  state = { ...state, routed: true };
  emit();
  if (coTimer) clearTimeout(coTimer);
  coTimer = setTimeout(creditOfficerSignsOff, delayMs);
}

// Beat 3→4 — the Credit Officer persona signs off (deterministic); revalidation recomputes the brief.
export function creditOfficerSignsOff() {
  if (coTimer) {
    clearTimeout(coTimer);
    coTimer = null;
  }
  if (state.creditSigned) return;
  state = { ...state, routed: false, creditSigned: true };
  emit();
}

// Beat 5 — Dana accepts the cascade edit; the 22-vs-18 conflict clears.
export function acceptCascadeEdit() {
  if (state.csReconciled) return;
  state = { ...state, csReconciled: true };
  emit();
}

// Repeat-demo reset (wired to the agent panel's "start over").
export function resetRevalidation() {
  if (coTimer) {
    clearTimeout(coTimer);
    coTimer = null;
  }
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
  },
};

function isCsPlanConflict(conflict: DecisionConflict) {
  const ids = new Set(conflict.sources.map((source) => source.object_id));
  return ids.has("doc_pricing_exception") && ids.has("doc_cs_plan");
}

// Deep, immutable overlay of the base brief data with the current demo stage. The static mock won't
// auto-clear from `present`, so we EXPLICITLY rewrite readiness rows, firings, approvals, conflicts,
// and source statuses. approval_ready stays false the whole arc (covenant tracker + Legal remain).
function overlay(base: BriefData, s: State): GovernedBrief {
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

  if (s.creditSigned) {
    brief = {
      ...brief,
      policy_gates: {
        ...brief.policy_gates,
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
          r.role === "credit_officer" ? { ...r, present: true, status: "approved" as const } : r,
        ),
      },
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
      summary: s.creditSigned
        ? "Credit Officer signed off on the 22% exception. Two blockers remain: the final covenant tracker and Legal sign-off on the covenant modification."
        : readiness.summary,
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

  if (s.creditSigned && !s.csReconciled) {
    brief = { ...brief, conflicts: [...brief.conflicts, CS_PLAN_CONFLICT] };
    readiness = { ...readiness, rows: [...readiness.rows, CS_PLAN_CONFLICT_ROW] };
    sources = sources.map((src) =>
      RECONCILED_IDS.has(src.object_id)
        ? { ...src, status: "conflicting" as SourceStatus }
        : src,
    );
  }

  if (s.csReconciled) {
    sources = sources.map((src) =>
      RECONCILED_IDS.has(src.object_id) ? { ...src, status: "used" as SourceStatus } : src,
    );
  }

  return {
    ...base,
    decision_brief: brief,
    decision_readiness: readiness,
    sources,
    stage: stageOf(s),
    cascadeAvailable: s.creditSigned && !s.csReconciled,
    workflow_status: s.creditSigned ? "Approved · discount exception" : null,
    banner_subtitle: s.creditSigned
      ? "Final covenant tracker missing · Legal sign-off on the covenant modification pending."
      : "Credit Officer approval missing · discount exceeds delegated authority.",
    path_to_ready: [
      { label: "Route to Credit Officer", done: s.creditSigned },
      { label: "Complete Legal approval", done: false },
      { label: "Upload final covenant tracker", done: false },
    ],
  };
}

// The governed brief: base brief data (mock or live) overlaid with the current demo stage. Every
// brief surface reads THIS, not `useBriefQuery` directly, so the recompute is consistent everywhere.
export function useGovernedBrief(): GovernedBrief {
  const base = useBriefQuery().data;
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return overlay(base, s);
}

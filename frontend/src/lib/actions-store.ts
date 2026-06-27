import { useSyncExternalStore } from "react";
import { action_plan, action_key, derive_status, type Action } from "@/data/actions";
import type { DecisionReadinessRow } from "@/data/brief";
import type { RevalidationState } from "@/lib/revalidation-store";
import {
  buildStagedRemediationReference,
  type StagedRemediationReference,
} from "@/lib/staged-remediation";

export type UserStatus = "proposed" | "approved" | "edited" | "rejected" | "committed" | "reverted";

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  timestamp: number;
  detail: { target_object_id: string; tool: string };
  reverted?: boolean;
};

// "plan" = the multi-action follow-ups drawer (the existing six). "staged_remediation" = one
// Decision Brief row reference validated into one card. "revalidation_edit" = the single-mutation
// cascade drawer (Beat 5) — same diff component, one card only.
export type DrawerMode = "plan" | "staged_remediation" | "revalidation_edit";

export type DrawerState = {
  open: boolean;
  mode: DrawerMode;
  focus_key: string | null;
  source: string; // human label of the trigger
  change_kind: "approval_returned" | "source_change" | null;
};

export type ActionChip = "next" | "changes";

export type AgentActionNotificationCounts = {
  nextTotal: number;
  changesTotal: number;
  nextUnseen: number;
  changesUnseen: number;
  topNavUnseen: number;
  nextItemIds: string[];
  changesItemIds: string[];
};

type State = {
  drawer: DrawerState;
  staged_remediations: Record<string, StagedRemediationReference>;
  active_staged_row_id: string | null;
  chip_seen_keys: Record<ActionChip, string>;
  notification_revision: Record<ActionChip, number>;
  // per-action user status (proposed | approved | edited | rejected | committed | reverted)
  user_status: Record<string, UserStatus>;
  // user edits override `after` fields
  edited_after: Record<string, Record<string, unknown>>;
  audit: AuditEvent[];
};

const initial: State = {
  drawer: { open: false, mode: "plan", focus_key: null, source: "", change_kind: null },
  staged_remediations: {},
  active_staged_row_id: null,
  chip_seen_keys: { next: "", changes: "" },
  notification_revision: { next: 0, changes: 0 },
  user_status: Object.fromEntries(
    action_plan.actions.map((a) => [action_key(a), "proposed"] as const),
  ),
  edited_after: {},
  audit: [],
};

let state: State = initial;
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

export function useActionsStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* -------- drawer controls -------- */

export function openDrawer(opts?: {
  focus_key?: string | null;
  source?: string;
  mode?: DrawerMode;
  change_kind?: DrawerState["change_kind"];
}) {
  state.drawer = {
    open: true,
    mode: opts?.mode ?? "plan",
    focus_key: opts?.focus_key ?? null,
    source: opts?.source ?? state.drawer.source ?? "Acme renewal — pre-committee review",
    change_kind: opts?.change_kind ?? null,
  };
  emit();
}
export function closeDrawer() {
  state.drawer = {
    ...state.drawer,
    open: false,
    mode: "plan",
    focus_key: null,
    change_kind: null,
  };
  emit();
}

export function stageDecisionReadinessRemediation(row: DecisionReadinessRow) {
  const staged = buildStagedRemediationReference(row);
  if (!staged) return null;
  state.staged_remediations = {
    ...state.staged_remediations,
    [staged.origin.row_id]: staged,
  };
  state.active_staged_row_id = staged.origin.row_id;
  state.notification_revision = {
    ...state.notification_revision,
    next: state.notification_revision.next + 1,
  };
  state.drawer = {
    open: true,
    mode: "staged_remediation",
    focus_key: null,
    source: `Decision readiness — ${row.gate}`,
    change_kind: null,
  };
  emit();
  return staged;
}

export function clearStagedDecisionReadinessRemediation(rowId: string) {
  if (!state.staged_remediations[rowId]) return;
  const { [rowId]: _removed, ...remaining } = state.staged_remediations;
  state.staged_remediations = remaining;
  state.active_staged_row_id =
    state.active_staged_row_id === rowId ? null : state.active_staged_row_id;
  emit();
}

export function recordReturnedChangeNotification() {
  state.notification_revision = {
    ...state.notification_revision,
    changes: state.notification_revision.changes + 1,
  };
  emit();
}

export function markActionChipOpened(chip: ActionChip, itemIds: string[]) {
  const key = notificationKey(itemIds);
  if (state.chip_seen_keys[chip] === key) return;
  state.chip_seen_keys = { ...state.chip_seen_keys, [chip]: key };
  emit();
}

/* -------- per-action actions -------- */

export function approveAction(key: string) {
  if (state.user_status[key] === "rejected") return;
  state.user_status = { ...state.user_status, [key]: "approved" };
  emit();
}
export function rejectAction(key: string) {
  state.user_status = { ...state.user_status, [key]: "rejected" };
  emit();
}
export function resetAction(key: string) {
  state.user_status = { ...state.user_status, [key]: "proposed" };
  emit();
}
export function saveEdit(key: string, after: Record<string, unknown>) {
  state.edited_after = { ...state.edited_after, [key]: after };
  state.user_status = { ...state.user_status, [key]: "edited" };
  emit();
}

/* -------- bulk -------- */

export function approveAllReady() {
  const next = { ...state.user_status };
  action_plan.actions.forEach((a) => {
    if (derive_status(a) === "ready" && next[action_key(a)] === "proposed") {
      next[action_key(a)] = "approved";
    }
  });
  state.user_status = next;
  emit();
}

export function executeApproved(actor = "Dana R.", actions: Action[] = action_plan.actions) {
  const committed: Action[] = [];
  const next = { ...state.user_status };
  const audit = [...state.audit];
  actions.forEach((a) => {
    const k = action_key(a);
    const s = next[k];
    if ((s === "approved" || s === "edited") && !a.blocked_reason) {
      next[k] = "committed";
      committed.push(a);
      audit.push({
        id: `ae_${Date.now()}_${k}`,
        actor,
        action: `${a.tool} · ${a.diff.target_object_id}`,
        timestamp: Date.now(),
        detail: { target_object_id: a.diff.target_object_id, tool: a.tool },
      });
    }
  });
  state.user_status = next;
  state.audit = audit;
  emit();
  return committed.length;
}

export type RefusedItem = { tool: string; target_object_id: string; reason: string };

// Mock mirror of the server re-gate (POST /actions/execute): commit approved/edited NON-blocked
// actions, and REFUSE approved/edited blocked ones (never commit). Proves the gate holds even when
// a client approves a blocked index — the same executed-vs-skipped split the gateway returns live.
export function executeRegated(
  actor = "Dana R.",
  actions: Action[] = action_plan.actions,
): {
  executed: { tool: string; target_object_id: string }[];
  refused: RefusedItem[];
} {
  const next = { ...state.user_status };
  const audit = [...state.audit];
  const executed: { tool: string; target_object_id: string }[] = [];
  const refused: RefusedItem[] = [];
  actions.forEach((a) => {
    const k = action_key(a);
    const s = next[k];
    if (s !== "approved" && s !== "edited") return;
    if (a.blocked_reason) {
      refused.push({
        tool: a.tool,
        target_object_id: a.diff.target_object_id,
        reason: a.blocked_reason,
      });
      return;
    }
    next[k] = "committed";
    executed.push({ tool: a.tool, target_object_id: a.diff.target_object_id });
    audit.push({
      id: `ae_${Date.now()}_${k}`,
      actor,
      action: `${a.tool} · ${a.diff.target_object_id}`,
      timestamp: Date.now(),
      detail: { target_object_id: a.diff.target_object_id, tool: a.tool },
    });
  });
  state.user_status = next;
  state.audit = audit;
  emit();
  return { executed, refused };
}

export function revertCommit(eventId: string, actor = "Dana R.") {
  const ev = state.audit.find((e) => e.id === eventId);
  if (!ev || ev.reverted) return;
  const action = action_plan.actions.find(
    (a) => `${a.tool} · ${a.diff.target_object_id}` === ev.action,
  );
  if (!action) return;
  const k = action_key(action);
  const audit = state.audit.map((e) => (e.id === eventId ? { ...e, reverted: true } : e));
  audit.push({
    id: `ae_${Date.now()}_revert_${k}`,
    actor,
    action: `revert · ${action.tool} · ${action.diff.target_object_id}`,
    timestamp: Date.now(),
    detail: { target_object_id: action.diff.target_object_id, tool: action.tool },
  });
  state.user_status = { ...state.user_status, [k]: "reverted" };
  state.audit = audit;
  emit();
}

// Full reset for the batch/loop demo replay: every action back to proposed, edits + audit cleared.
export function resetActions() {
  state.user_status = Object.fromEntries(
    action_plan.actions.map((a) => [action_key(a), "proposed"] as const),
  );
  state.drawer = { open: false, mode: "plan", focus_key: null, source: "", change_kind: null };
  state.staged_remediations = {};
  state.active_staged_row_id = null;
  state.chip_seen_keys = { next: "", changes: "" };
  state.notification_revision = { next: 0, changes: 0 };
  state.edited_after = {};
  state.audit = [];
  emit();
}

/* -------- selectors -------- */

function notificationKey(itemIds: string[]): string {
  return [...itemIds].sort().join("|");
}

function stagedRemediationActionKey(reference: StagedRemediationReference): string {
  return `${reference.origin.remediation_tool}:${reference.origin.target_object_id}`;
}

export function getPendingStagedNextActionIds(s: State = state): string[] {
  return Object.values(s.staged_remediations).flatMap((reference) => {
    const key = stagedRemediationActionKey(reference);
    const user = s.user_status[key] ?? "proposed";
    if (user === "committed" || user === "rejected") return [];
    return [`next:${s.notification_revision.next}:${reference.origin.row_id}:${key}`];
  });
}

export function getReturnedChangeIds(
  revalidation?: Pick<RevalidationState, "creditSigned" | "csReconciled">,
  s: State = state,
): string[] {
  if (!revalidation?.creditSigned || revalidation.csReconciled) return [];
  return [
    `changes:${s.notification_revision.changes}:credit_officer_response:cs_plan_reconciliation`,
  ];
}

export function getAgentActionNotificationCounts(
  s: State = state,
  revalidation?: Pick<RevalidationState, "creditSigned" | "csReconciled">,
): AgentActionNotificationCounts {
  const nextItemIds = getPendingStagedNextActionIds(s);
  const changesItemIds = getReturnedChangeIds(revalidation, s);
  const nextKey = notificationKey(nextItemIds);
  const changesKey = notificationKey(changesItemIds);
  const nextUnseen =
    nextItemIds.length > 0 && s.chip_seen_keys.next !== nextKey ? nextItemIds.length : 0;
  const changesUnseen =
    changesItemIds.length > 0 && s.chip_seen_keys.changes !== changesKey
      ? changesItemIds.length
      : 0;

  return {
    nextTotal: nextItemIds.length,
    changesTotal: changesItemIds.length,
    nextUnseen,
    changesUnseen,
    topNavUnseen: nextUnseen + changesUnseen,
    nextItemIds,
    changesItemIds,
  };
}

export function getCurrentAgentActionNotificationCounts(
  revalidation?: Pick<RevalidationState, "creditSigned" | "csReconciled">,
): AgentActionNotificationCounts {
  return getAgentActionNotificationCounts(state, revalidation);
}

export function getEffectiveAfter(a: Action): Record<string, unknown> {
  return state.edited_after[action_key(a)] ?? a.diff.after;
}

export type PathReady = {
  route_credit: boolean;
  complete_legal: boolean;
  upload_tracker: boolean;
  workflow_status: string | null;
};

export function getPathReady(s: State = state): PathReady {
  const isCommitted = (pred: (a: Action) => boolean) =>
    action_plan.actions.some((a) => pred(a) && s.user_status[action_key(a)] === "committed");

  const workflow_update = action_plan.actions.find(
    (a) => a.tool === "update_project_status" && a.diff.target_object_id === "wf_approval",
  );
  const workflow_committed =
    workflow_update && s.user_status[action_key(workflow_update)] === "committed";

  return {
    route_credit: isCommitted(
      (a) => a.tool === "route_approval" && a.required_approver === "credit_officer",
    ),
    complete_legal: isCommitted(
      (a) => a.tool === "route_approval" && a.required_approver === "legal",
    ),
    upload_tracker: isCommitted(
      (a) =>
        a.tool === "create_task" &&
        String(s.edited_after[action_key(a)]?.title ?? a.diff.after.title ?? "")
          .toLowerCase()
          .includes("covenant"),
    ),
    workflow_status: workflow_committed
      ? String(
          (s.edited_after[action_key(workflow_update!)] as { status?: string })?.status ??
            (workflow_update!.diff.after as { status?: string }).status,
        )
      : null,
  };
}

export function usePathReady(): PathReady {
  const s = useActionsStore();
  return getPathReady(s);
}

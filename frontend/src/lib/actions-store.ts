import { useSyncExternalStore } from "react";
import { action_plan, action_key, derive_status, type Action } from "@/data/actions";

export type UserStatus = "proposed" | "approved" | "edited" | "rejected" | "committed" | "reverted";

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  timestamp: number;
  detail: { target_object_id: string; tool: string };
  reverted?: boolean;
};

// "plan" = the multi-action follow-ups drawer (the existing six). "revalidation_edit" = the
// single-mutation cascade drawer (Beat 5) — same diff component, one card only.
export type DrawerMode = "plan" | "revalidation_edit";

export type DrawerState = {
  open: boolean;
  mode: DrawerMode;
  focus_key: string | null;
  source: string; // human label of the trigger
};

type State = {
  drawer: DrawerState;
  // per-action user status (proposed | approved | edited | rejected | committed | reverted)
  user_status: Record<string, UserStatus>;
  // user edits override `after` fields
  edited_after: Record<string, Record<string, unknown>>;
  audit: AuditEvent[];
};

const initial: State = {
  drawer: { open: false, mode: "plan", focus_key: null, source: "" },
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
}) {
  state.drawer = {
    open: true,
    mode: opts?.mode ?? "plan",
    focus_key: opts?.focus_key ?? null,
    source: opts?.source ?? state.drawer.source ?? "Acme renewal — pre-committee review",
  };
  emit();
}
export function closeDrawer() {
  state.drawer = { ...state.drawer, open: false, mode: "plan", focus_key: null };
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

export function executeApproved(actor = "Dana R.") {
  const committed: Action[] = [];
  const next = { ...state.user_status };
  const audit = [...state.audit];
  action_plan.actions.forEach((a) => {
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

/* -------- selectors -------- */

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

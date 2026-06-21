import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  FileEdit,
  FileText,
  GitBranch,
  GitCompareArrows,
  History,
  Lock,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Undo2,
  Workflow,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  action_key,
  approver_labels,
  cascade_action,
  derive_status,
  object_labels,
  tool_labels,
  type Action,
  type DerivedStatus,
  type SideEffect,
  type Risk,
} from "@/data/actions";
import { verify_result_financials, type VerifyResult } from "@/data/record";
import {
  approveAction,
  closeDrawer,
  executeApproved,
  getEffectiveAfter,
  rejectAction,
  resetAction,
  revertCommit,
  saveEdit,
  useActionsStore,
  type UserStatus,
  openDrawer,
} from "@/lib/actions-store";
import { acceptCascadeEdit, useRevalidation } from "@/lib/revalidation-store";
import { useLatestRecordId } from "@/lib/record-store";
import {
  LIVE,
  useActionPlanQuery,
  useExecuteActionsMutation,
  useVerifyWorkProductMutation,
  type ServerAuditEvent,
} from "@/hooks/queries";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const TOOL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  create_task: CheckSquare,
  update_project_status: Workflow,
  route_approval: GitBranch,
  draft_internal_note: FileEdit,
  schedule_meeting: Calendar,
  edit_document: GitCompareArrows,
};

function labelFor(id: string) {
  return object_labels[id] ?? id;
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function effectiveStatus(
  d: DerivedStatus,
  u: UserStatus,
): {
  label: string;
  cls: string;
  rail: string;
} {
  if (u === "committed")
    return {
      label: "Committed",
      cls: "bg-[var(--success)] text-white",
      rail: "bg-[var(--success)]",
    };
  if (u === "reverted")
    return {
      label: "Reverted",
      cls: "bg-[var(--canvas)] text-[var(--secondary-text)] border border-border",
      rail: "bg-[var(--muted-fg)]",
    };
  if (u === "rejected")
    return {
      label: "Rejected",
      cls: "bg-[var(--canvas)] text-[var(--muted-fg)] border border-border line-through",
      rail: "bg-[var(--muted-fg)]",
    };
  if (u === "approved")
    return {
      label: "Approved · staged",
      cls: "bg-[var(--success-bg)] text-[var(--success)]",
      rail: "bg-[var(--success)]",
    };
  if (u === "edited")
    return {
      label: "Edited · staged",
      cls: "bg-[var(--primary-tint)] text-primary",
      rail: "bg-primary",
    };
  // proposed → derived
  if (d === "blocked")
    return {
      label: "Blocked",
      cls: "bg-[var(--danger-bg)] text-[var(--danger)]",
      rail: "bg-[var(--danger)]",
    };
  if (d === "needs_approval")
    return {
      label: "Needs approval",
      cls: "bg-[var(--warning-bg)] text-[var(--warning)]",
      rail: "bg-[var(--warning)]",
    };
  return {
    label: "Ready",
    cls: "bg-[var(--success-bg)] text-[var(--success)]",
    rail: "bg-[var(--success)]",
  };
}

const RISK_CLS: Record<Risk, string> = {
  low: "bg-[var(--canvas)] text-[var(--secondary-text)] border border-border",
  medium: "bg-[var(--warning-bg)] text-[var(--warning)]",
  high: "bg-[var(--danger-bg)] text-[var(--danger)]",
};
const SIDE_CLS: Record<SideEffect, string> = {
  read: "bg-[var(--canvas)] text-[var(--secondary-text)] border border-border",
  draft: "bg-[var(--primary-tint)] text-primary",
  propose: "bg-[var(--primary-tint)] text-primary",
  write: "bg-[var(--canvas)] text-[var(--secondary-text)] border border-border",
};

function renderedSideEffect(action: Action): SideEffect {
  return action.tool === "route_approval" ? "write" : action.side_effect;
}

/* -------------------------------------------------------------------------- */
/* Drawer                                                                     */
/* -------------------------------------------------------------------------- */

export function ActionDiffDrawer() {
  const store = useActionsStore();
  const { drawer, user_status, audit } = store;
  const reval = useRevalidation();
  const recordId = useLatestRecordId();
  const planActions = useActionPlanQuery().data.actions;
  const {
    data: verifyData,
    isPending: verifyPending,
    mutate: verifyMutate,
  } = useVerifyWorkProductMutation(recordId);
  // Beat 6: once the Credit Officer has signed off, the route-to-CO follow-up is already done —
  // drop it so the plan proposes only the REMAINING work (tracker, Legal, schedule). The live
  // gateway proof below still submits the full plan to prove server-side re-gating.
  const visibleActions = useMemo(
    () =>
      reval.creditSigned
        ? planActions.filter(
            (a) => !(a.tool === "route_approval" && a.required_approver === "credit_officer"),
          )
        : planActions,
    [planActions, reval.creditSigned],
  );
  const [tab, setTab] = useState<"changes" | "next" | "notes" | "audit">("next");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const execute = useExecuteActionsMutation();
  const [serverResult, setServerResult] = useState<ServerAuditEvent[] | null>(null);
  const isAfterSourceChange = drawer.mode === "revalidation_edit";
  const verification =
    verifyData?.record_id === recordId
      ? verifyData
      : { ...verify_result_financials, record_id: recordId };

  // Open directly to the useful tab for each scenario.
  useEffect(() => {
    if (drawer.open) setTab(drawer.mode === "revalidation_edit" ? "changes" : "next");
  }, [drawer.open, drawer.mode]);

  // Live mode verifies through the backend; mock mode returns the pinned financials_v2 result.
  useEffect(() => {
    if (
      drawer.open &&
      drawer.mode === "revalidation_edit" &&
      verifyData?.record_id !== recordId &&
      !verifyPending
    ) {
      verifyMutate({ event: "financials_v2" });
    }
  }, [drawer.open, drawer.mode, recordId, verifyData, verifyPending, verifyMutate]);

  // Scroll to focused card.
  useEffect(() => {
    if (drawer.open && drawer.focus_key) {
      const t = setTimeout(() => {
        cardRefs.current[drawer.focus_key!]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        cardRefs.current[drawer.focus_key!]?.focus({ preventScroll: true });
      }, 120);
      return () => clearTimeout(t);
    }
  }, [drawer.open, drawer.focus_key]);

  const ordered = useMemo(() => {
    const order: Record<DerivedStatus, number> = {
      ready: 0,
      needs_approval: 1,
      blocked: 2,
    };
    return [...visibleActions].sort((a, b) => order[derive_status(a)] - order[derive_status(b)]);
  }, [visibleActions]);

  const nextActions = useMemo(
    () =>
      ordered.filter(
        (a) =>
          !a.blocked_reason &&
          a.tool !== "draft_internal_note" &&
          a.tool !== "update_project_status",
      ),
    [ordered],
  );
  const noteActions = useMemo(
    () => ordered.filter((a) => !a.blocked_reason && a.tool === "draft_internal_note"),
    [ordered],
  );
  const actionIndexByKey = useMemo(
    () => new Map(planActions.map((a, i) => [action_key(a), i] as const)),
    [planActions],
  );

  // Pending = actionable (not yet rejected or sent). Drives the footer count + "Send all" so the
  // number stays truthful as the user rejects/sends; rejected cards remain visible (with Restore).
  const nextPending = useMemo(
    () =>
      nextActions.filter((a) => {
        const u = user_status[action_key(a)];
        return u !== "rejected" && u !== "committed";
      }),
    [nextActions, user_status],
  );

  const sourceChangeCount = isAfterSourceChange && verification.changed_sources.length > 0 ? 1 : 0;
  const gateChangeCount = isAfterSourceChange ? verification.gate_changes.length : 0;
  const cascadeChangeCount =
    isAfterSourceChange && (reval.cascadeAvailable || reval.csReconciled) ? 1 : 0;
  const changesCount = sourceChangeCount + gateChangeCount + cascadeChangeCount;
  const nextCount = nextActions.length;
  const pendingCount = nextPending.length;
  const notesCount = noteActions.length;

  function switchScenario(mode: "plan" | "revalidation_edit") {
    openDrawer({
      mode,
      focus_key: null,
      source:
        mode === "revalidation_edit"
          ? "After source change — financial model v2"
          : "Acme renewal — pre-committee review",
    });
  }

  function approvedIndices(actions: Action[]) {
    return actions
      .map((a) => actionIndexByKey.get(action_key(a)))
      .filter((i): i is number => typeof i === "number");
  }

  function onSendAll() {
    if (pendingCount === 0) return;
    if (LIVE) {
      execute.mutate(
        { approved_indices: approvedIndices(nextPending) },
        {
          onSuccess: (events) => {
            setServerResult(events);
            setTab("audit");
            const skipped = events.filter((e) => e.action === "skipped").length;
            toast.success(
              `Sent ${events.length - skipped} action${events.length - skipped === 1 ? "" : "s"}`,
            );
          },
          onError: () =>
            toast.error("Gateway didn't respond", {
              description: "Start it with `make api`, or use mock mode.",
            }),
        },
      );
      return;
    }
    nextPending.forEach((a) => approveAction(action_key(a)));
    const n = executeApproved();
    if (n > 0) {
      toast.success(`${n} action${n === 1 ? "" : "s"} sent · audit recorded`);
      setTab("audit");
    }
  }

  if (!drawer.open) return null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label="Agent Actions"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-150"
        onClick={closeDrawer}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-border bg-background shadow-panel animate-in slide-in-from-right duration-200 sm:w-[560px]">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-5 pt-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="grid h-6 w-6 place-items-center rounded-md bg-gradient-ai text-white"
                  aria-hidden
                >
                  <GitBranch className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                  Agent Actions
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] font-semibold text-[var(--secondary-text)]">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  Permissions-aware
                </span>
              </div>
              <p className="mt-1.5 text-[12px] text-[var(--secondary-text)]">
                Review changes, outbound requests, and notes before sending.
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--muted-fg)]">
                from {drawer.source || "Acme renewal — pre-committee review"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted-fg)] transition-colors hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scenario */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
              Scenario
            </span>
            <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[12px] font-medium">
              <button
                type="button"
                onClick={() => switchScenario("plan")}
                className={[
                  "rounded-[5px] px-2.5 py-1 transition-colors",
                  !isAfterSourceChange
                    ? "bg-[var(--primary-tint)] text-primary"
                    : "text-[var(--secondary-text)] hover:text-foreground",
                ].join(" ")}
              >
                Happy path
              </button>
              <button
                type="button"
                onClick={() => switchScenario("revalidation_edit")}
                className={[
                  "rounded-[5px] px-2.5 py-1 transition-colors",
                  isAfterSourceChange
                    ? "bg-[var(--primary-tint)] text-primary"
                    : "text-[var(--secondary-text)] hover:text-foreground",
                ].join(" ")}
              >
                After source change
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="inline-flex rounded-md bg-[var(--canvas)] p-0.5 text-[12px] font-medium">
              <DrawerTabButton
                active={tab === "changes"}
                icon={GitCompareArrows}
                label="Changes"
                count={changesCount}
                onClick={() => setTab("changes")}
              />
              <DrawerTabButton
                active={tab === "next"}
                icon={ClipboardList}
                label="Next actions"
                count={nextCount}
                onClick={() => setTab("next")}
              />
              <DrawerTabButton
                active={tab === "notes"}
                icon={FileText}
                label="Notes"
                count={notesCount}
                onClick={() => setTab("notes")}
              />
            </div>
            <button
              type="button"
              onClick={() => setTab("audit")}
              className={[
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                tab === "audit"
                  ? "bg-background text-foreground shadow-card"
                  : "text-[var(--muted-fg)] hover:text-foreground",
              ].join(" ")}
            >
              <History className="h-3 w-3" />
              Audit log
              {audit.length > 0 && (
                <span className="ml-1 rounded-full bg-[var(--primary-tint)] px-1.5 text-[10px] font-semibold text-primary">
                  {audit.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-[var(--canvas)]/40">
          {tab === "changes" ? (
            isAfterSourceChange ? (
              <RevalidationChanges
                verification={verification}
                pending={verifyPending}
                showCascade={reval.cascadeAvailable}
                cascadeAccepted={reval.csReconciled}
                onAcceptCascade={() => {
                  acceptCascadeEdit();
                  toast.success("Edit accepted · conflict reconciled", {
                    description: "Customer success plan now reflects the approved 22%.",
                  });
                  closeDrawer();
                }}
              />
            ) : (
              <EmptyChanges />
            )
          ) : tab === "next" ? (
            <ul className="space-y-3 px-5 py-4">
              {nextActions.map((a) => {
                const k = action_key(a);
                return (
                  <NextActionCard
                    key={k}
                    action={a}
                    user={user_status[k] ?? "proposed"}
                    setRef={(el) => (cardRefs.current[k] = el)}
                    focused={drawer.focus_key === k}
                  />
                );
              })}
            </ul>
          ) : tab === "notes" ? (
            <NotesPanel actions={noteActions} />
          ) : LIVE && serverResult ? (
            <>
              <GatewayResult events={serverResult} />
              {audit.length > 0 && <AuditLog />}
            </>
          ) : (
            <AuditLog />
          )}
        </div>

        {/* Footer */}
        {tab === "next" && (
          <div className="shrink-0 border-t border-border bg-background px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11.5px] leading-snug text-[var(--secondary-text)]">
                <span className="font-semibold text-foreground">{pendingCount} pending</span>
                <span className="text-[var(--muted-fg)]">
                  {" "}
                  · blocked items stay in the packet readiness table
                </span>
              </div>
              {LIVE ? (
                <button
                  type="button"
                  onClick={onSendAll}
                  disabled={execute.isPending || pendingCount === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-ai px-3.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  {execute.isPending ? "Sending…" : `Send all (${pendingCount})`}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onSendAll}
                    disabled={pendingCount === 0}
                    className={[
                      "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold text-white transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      pendingCount === 0
                        ? "cursor-not-allowed bg-[var(--muted-fg)] opacity-60"
                        : "bg-gradient-ai hover:opacity-95",
                    ].join(" ")}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send all ({pendingCount})
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Drawer panels                                                              */
/* -------------------------------------------------------------------------- */

function DrawerTabButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 transition-colors",
        active
          ? "bg-background text-primary shadow-card"
          : "text-[var(--secondary-text)] hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-3 w-3" />
      {label}
      {count > 0 && (
        <span
          className={[
            "ml-0.5 rounded-full px-1.5 text-[10px] font-semibold",
            active ? "bg-primary text-white" : "bg-[var(--primary-tint)] text-primary",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyChanges() {
  return (
    <div className="flex h-full items-center justify-center px-8 py-16 text-center">
      <div>
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <p className="mt-3 text-[13px] font-medium text-foreground">No source-change diffs</p>
        <p className="mt-1 max-w-[320px] text-[12px] leading-snug text-[var(--secondary-text)]">
          Happy path has no inbound reconciliation. Use Next actions for outbound routing and tasks.
        </p>
      </div>
    </div>
  );
}

function RevalidationChanges({
  verification,
  pending,
  showCascade,
  cascadeAccepted,
  onAcceptCascade,
}: {
  verification: VerifyResult;
  pending: boolean;
  showCascade: boolean;
  cascadeAccepted: boolean;
  onAcceptCascade: () => void;
}) {
  return (
    <div className="space-y-3 px-5 py-4">
      {pending && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-[var(--secondary-text)] shadow-card">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
          Verifying the governed record against the latest source versions…
        </div>
      )}

      {(showCascade || cascadeAccepted) && (
        <CascadeChangeCard accepted={cascadeAccepted} onAccept={onAcceptCascade} />
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
              Source change
            </div>
            <h3 className="mt-0.5 text-[14px] font-semibold leading-tight text-foreground">
              Acme financial model
            </h3>
          </div>
          <div className="flex flex-wrap gap-1">
            <Chip className="bg-[var(--warning-bg)] text-[var(--warning)]">Stale</Chip>
            <Chip className="bg-[var(--canvas)] text-[var(--secondary-text)] border border-border">
              Needs recompute
            </Chip>
          </div>
        </div>

        <div className="px-4 pt-2">
          <p className="text-[12.5px] leading-snug text-[var(--secondary-text)]">
            The financial source changed after the record was sealed. Factual sections are stale; no
            reapproval route is created for this data-only change.
          </p>
          <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
            {verification.changed_sources.map((change) => (
              <DiffView
                key={`${change.object_id}:${change.field}`}
                before={{ [labelForField(change.field)]: change.before }}
                after={{ [labelForField(change.field)]: change.after }}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 border-t border-border bg-[var(--canvas)]/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
              stale sections
            </span>
            {verification.stale_sections.map((s) => (
              <span
                key={s.section}
                className="inline-flex rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]"
              >
                {labelForField(s.section)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {verification.gate_changes.map((gate) => (
        <div
          key={gate.rule_id}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
        >
          <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                Gate change
              </div>
              <h3 className="mt-0.5 text-[14px] font-semibold leading-tight text-foreground">
                {labelForField(gate.rule_id)}
              </h3>
            </div>
            <Chip className="bg-[var(--danger-bg)] text-[var(--danger)]">Blocking</Chip>
          </div>
          <div className="px-4 py-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <GateState passed={gate.before_passed} label="Before" />
              <ArrowRight className="h-3.5 w-3.5 text-[var(--muted-fg)]" />
              <GateState passed={gate.after_passed} label="After" />
            </div>
            <p className="mt-2 text-[12.5px] leading-snug text-[var(--secondary-text)]">
              {gate.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CascadeChangeCard({ accepted, onAccept }: { accepted: boolean; onAccept: () => void }) {
  const a = cascade_action;
  const targetLabel = labelFor(a.diff.target_object_id);
  const fromLabel = labelFor(a.sources[0]?.object_id ?? "");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
            Revalidation edit
          </div>
          <h3 className="mt-0.5 text-[14px] font-semibold leading-tight text-foreground">
            {targetLabel}
          </h3>
        </div>
        <div className="flex flex-wrap gap-1">
          <Chip className={SIDE_CLS[a.side_effect]}>{a.side_effect}</Chip>
          <Chip className={RISK_CLS[a.risk]}>Low risk</Chip>
          <Chip
            className={
              accepted
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : "bg-[var(--warning-bg)] text-[var(--warning)]"
            }
          >
            {accepted ? "Accepted" : "Needs acceptance"}
          </Chip>
        </div>
      </div>
      <div className="px-4 pt-2">
        <p className="text-[12.5px] leading-snug text-[var(--secondary-text)]">{a.reason}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
            from
          </span>
          <span className="inline-flex rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
            {fromLabel}
          </span>
        </div>
        <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
          <DiffView before={a.diff.before} after={a.diff.after} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-border bg-[var(--canvas)]/50 px-4 py-2">
        {accepted ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--success)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Accepted · conflict reconciled
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={closeDrawer}
              className="h-7 rounded-md px-2 text-[11.5px] font-medium text-[var(--secondary-text)] hover:bg-[var(--canvas)]"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]"
            >
              Accept edit
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GateState({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
        {label}
      </div>
      <div
        className={[
          "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
          passed
            ? "bg-[var(--success-bg)] text-[var(--success)]"
            : "bg-[var(--danger-bg)] text-[var(--danger)]",
        ].join(" ")}
      >
        {passed ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {passed ? "Pass" : "Fail"}
      </div>
    </div>
  );
}

function NextActionCard({
  action,
  user,
  setRef,
  focused,
}: {
  action: Action;
  user: UserStatus;
  setRef: (el: HTMLDivElement | null) => void;
  focused: boolean;
}) {
  const k = action_key(action);
  const after = getEffectiveAfter(action);
  const targetLabel = labelFor(action.diff.target_object_id);
  const destination = destinationFor(action);
  const primary = primaryLabelFor(action);

  const isRejected = user === "rejected";
  const isCommitted = user === "committed";
  const isEdited = user === "edited";
  const isStaged = user === "approved" || isEdited;
  // Inline edit only where a field is meaningfully adjustable before sending (the task's
  // title/assignee/due). A route's internal fields aren't user-editable, so those cards omit Edit.
  const editable = action.tool === "create_task";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(action.diff.after).map(([key, v]) => [key, formatVal(v)])),
  );

  function startEdit() {
    // Re-seed from the current effective values each time, so prior edits show in the editor.
    setDraft(Object.fromEntries(Object.entries(after).map(([key, v]) => [key, formatVal(v)])));
    setEditing(true);
  }

  function saveDraft() {
    const next: Record<string, unknown> = {};
    Object.entries(action.diff.after).forEach(([key, origVal]) => {
      const raw = draft[key] ?? "";
      next[key] = Array.isArray(origVal)
        ? raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : raw;
    });
    saveEdit(k, next);
    setEditing(false);
    toast.success("Edit saved · staged", { description: targetLabel });
  }

  const statusChip = isRejected
    ? { label: "Rejected", cls: "bg-[var(--canvas)] text-[var(--muted-fg)] border border-border" }
    : isCommitted
      ? { label: "Sent", cls: "bg-[var(--success)] text-white" }
      : isEdited
        ? { label: "Edited · staged", cls: "bg-[var(--primary-tint)] text-primary" }
        : isStaged
          ? { label: "Staged", cls: "bg-[var(--primary-tint)] text-primary" }
          : { label: "Ready", cls: "bg-[var(--success-bg)] text-[var(--success)]" };

  return (
    <li>
      <div
        ref={setRef}
        tabIndex={0}
        className={[
          "overflow-hidden rounded-xl border bg-card shadow-card outline-none transition-shadow",
          focused
            ? "border-primary ring-2 ring-primary/30"
            : "border-border focus-visible:ring-2 focus-visible:ring-primary",
          isRejected ? "opacity-70" : "",
        ].join(" ")}
      >
        <div className="px-4 pt-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                {tool_labels[action.tool]}
              </div>
              <h3 className="mt-0.5 text-[14px] font-semibold leading-tight text-foreground">
                {targetLabel}
              </h3>
              <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-semibold text-[var(--secondary-text)]">
                <ArrowRight className="h-3 w-3" />
                {destination}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              <Chip className={SIDE_CLS[renderedSideEffect(action)]}>
                {renderedSideEffect(action)}
              </Chip>
              <Chip className={RISK_CLS[action.risk]}>
                {action.risk === "low" ? "Low risk" : `${action.risk} risk`}
              </Chip>
              <Chip className={statusChip.cls}>{statusChip.label}</Chip>
            </div>
          </div>

          {editing ? (
            <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
              <DiffEditor origAfter={action.diff.after} draft={draft} setDraft={setDraft} />
            </div>
          ) : action.tool === "create_task" ? (
            <PreviewTable
              rows={[
                ["Title", formatVal(after.title)],
                ["Assignee", formatVal(after.assignee)],
                ["Due", formatDate(formatVal(after.due))],
                ["Status", formatVal(after.status)],
              ]}
            />
          ) : (
            <div className="mt-3 rounded-md border border-border bg-background px-3 py-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                What happens
              </div>
              <p className="mt-1 text-[12px] leading-snug text-[var(--secondary-text)]">
                {routeDescription(action)}
              </p>
            </div>
          )}

          <p className="mt-2 text-[12.5px] leading-snug text-[var(--secondary-text)]">
            {action.reason}
          </p>
          <SourceRow sources={action.sources.map((s) => s.object_id)} />
        </div>

        <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-border bg-[var(--canvas)]/50 px-4 py-2">
          {isRejected ? (
            <button
              type="button"
              onClick={() => resetAction(k)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-[11.5px] font-medium text-[var(--secondary-text)] transition-colors hover:bg-[var(--canvas)]"
            >
              <Undo2 className="h-3 w-3" />
              Restore
            </button>
          ) : isCommitted ? (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--success)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Sent · recorded in audit log
            </span>
          ) : editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-7 rounded-md px-2 text-[11.5px] font-medium text-[var(--secondary-text)] hover:bg-[var(--canvas)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDraft}
                className="h-7 rounded-md bg-primary px-2.5 text-[11.5px] font-semibold text-white hover:bg-[var(--primary-hover)]"
              >
                Save edits
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => rejectAction(k)}
                className="h-7 rounded-md px-2 text-[11.5px] font-medium text-[var(--secondary-text)] hover:bg-[var(--canvas)]"
              >
                Reject
              </button>
              {editable && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11.5px] font-medium text-foreground transition-colors hover:bg-[var(--canvas)]"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  approveAction(k);
                  toast.success(`${primary} staged`, { description: targetLabel });
                }}
                className={[
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-semibold transition-colors",
                  isStaged
                    ? "bg-[var(--success-bg)] text-[var(--success)]"
                    : "bg-primary text-white hover:bg-[var(--primary-hover)]",
                ].join(" ")}
              >
                {isStaged ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Staged
                  </>
                ) : (
                  primary
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function NotesPanel({ actions }: { actions: Action[] }) {
  if (actions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-8 py-16 text-center">
        <div>
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--canvas)] text-[var(--muted-fg)]">
            <FileText className="h-4 w-4" />
          </div>
          <p className="mt-3 text-[13px] font-medium text-foreground">No notes proposed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-5 py-4">
      {actions.map((a) => {
        const k = action_key(a);
        const after = getEffectiveAfter(a);
        const body = formatVal(after.body);
        const points = body
          .split(".")
          .map((p) => p.trim())
          .filter(Boolean);
        return (
          <div
            key={k}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-card"
          >
            <div className="px-4 pt-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                Draft internal note
              </div>
              <h3 className="mt-0.5 text-[14px] font-semibold leading-tight text-foreground">
                {formatVal(after.title)}
              </h3>
              <ul className="mt-3 space-y-1.5">
                {points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2 text-[12.5px] leading-snug text-[var(--secondary-text)]"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-fg)]" />
                    <span>{point}.</span>
                  </li>
                ))}
              </ul>
              <SourceRow sources={a.sources.map((s) => s.object_id)} />
            </div>
            <div className="mt-3 flex items-center justify-end border-t border-border bg-[var(--canvas)]/50 px-4 py-2">
              <button
                type="button"
                onClick={() => {
                  approveAction(k);
                  toast.success("Draft saved", { description: formatVal(after.title) });
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]"
              >
                Save draft
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PreviewTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="mt-3 rounded-md border border-border bg-background px-3 py-2">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[86px_1fr] gap-3 py-1 text-[12px]">
          <dt className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
            {k}
          </dt>
          <dd className="font-medium text-[var(--secondary-text)]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function SourceRow({ sources }: { sources: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
        from
      </span>
      {sources.map((s) => (
        <span
          key={s}
          className="inline-flex rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]"
        >
          {labelFor(s)}
        </span>
      ))}
    </div>
  );
}

function destinationFor(action: Action) {
  if (action.tool === "create_task") return formatVal(getEffectiveAfter(action).assignee);
  if (action.required_approver)
    return approver_labels[action.required_approver] ?? action.required_approver;
  return labelFor(action.diff.target_object_id);
}

function primaryLabelFor(action: Action) {
  if (action.tool === "create_task") return "Create & assign";
  if (action.tool === "route_approval") return `Route to ${destinationFor(action)}`;
  return "Send";
}

function routeDescription(action: Action) {
  const destination = destinationFor(action);
  if (action.required_approver === "legal") {
    return "Creates a review task for Legal; sets the workflow to 'Pending Legal'.";
  }
  return `Creates an approval task for the ${destination}; sets the workflow to 'routed'.`;
}

// Title-case a snake_case field, with overrides for acronyms the generic rule mangles ("dscr").
const FIELD_LABELS: Record<string, string> = {
  dscr: "DSCR",
};

function labelForField(field: string) {
  return (
    FIELD_LABELS[field.toLowerCase()] ??
    field.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
  );
}

function formatDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* -------------------------------------------------------------------------- */
/* ActionCard                                                                 */
/* -------------------------------------------------------------------------- */

function ActionCard({
  action,
  user,
  setRef,
  focused,
}: {
  action: Action;
  user: UserStatus;
  setRef: (el: HTMLDivElement | null) => void;
  focused: boolean;
}) {
  const derived = derive_status(action);
  const status = effectiveStatus(derived, user);
  const Icon = TOOL_ICON[action.tool] ?? Sparkles;
  const k = action_key(action);
  const after = getEffectiveAfter(action);
  const targetLabel = labelFor(action.diff.target_object_id);

  const [expanded, setExpanded] = useState(derived === "ready");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(after).map(([k, v]) => [k, formatVal(v)])),
  );
  const { audit } = useActionsStore();

  const isBlocked = derived === "blocked";
  const isCommitted = user === "committed";
  const isReverted = user === "reverted";
  const isRejected = user === "rejected";

  function onKey(e: React.KeyboardEvent) {
    if (editing) return;
    if (e.key === "Enter" && !isBlocked && !isCommitted) {
      e.preventDefault();
      approveAction(k);
    }
  }

  function saveDraft() {
    // Re-cast values: keep array values if original was array.
    const next: Record<string, unknown> = {};
    Object.entries(action.diff.after).forEach(([key, origVal]) => {
      const raw = draft[key] ?? "";
      if (Array.isArray(origVal)) {
        next[key] = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        next[key] = raw;
      }
    });
    saveEdit(k, next);
    setEditing(false);
  }

  return (
    <li>
      <div
        ref={setRef}
        tabIndex={0}
        onKeyDown={onKey}
        className={[
          "relative overflow-hidden rounded-xl border bg-card shadow-card outline-none transition-shadow",
          focused
            ? "border-primary ring-2 ring-primary/30"
            : "border-border focus-visible:ring-2 focus-visible:ring-primary",
          isRejected || isReverted ? "opacity-75" : "",
        ].join(" ")}
      >
        {/* Status rail */}
        <span className={["absolute inset-y-0 left-0 w-1", status.rail].join(" ")} />

        <div className="pl-4">
          {/* Title row */}
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3 pt-3">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--canvas)] text-[var(--secondary-text)]">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                    {tool_labels[action.tool]}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[14px] font-semibold leading-tight text-foreground">
                  {targetLabel}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <Chip className={SIDE_CLS[renderedSideEffect(action)]}>
                {renderedSideEffect(action)}
              </Chip>
              <Chip className={RISK_CLS[action.risk]}>
                {action.risk === "low" ? "low risk" : `${action.risk} risk`}
              </Chip>
              {action.required_approver && !isCommitted && (
                <Chip className="bg-[var(--warning-bg)] text-[var(--warning)]">
                  Needs: {approver_labels[action.required_approver] ?? action.required_approver}
                </Chip>
              )}
              <Chip className={status.cls}>{status.label}</Chip>
            </div>
          </div>

          {/* Reason + sources */}
          <div className="px-3 pt-2">
            <p className="text-[12.5px] leading-snug text-[var(--secondary-text)]">
              {action.reason}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                from
              </span>
              {action.sources.map((s) => (
                <span
                  key={s.object_id}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]"
                >
                  {labelFor(s.object_id)}
                </span>
              ))}
            </div>
          </div>

          {/* Blocked banner */}
          {isBlocked && (
            <div className="mx-3 mt-3 flex items-start gap-2 rounded-md border border-[var(--danger)]/25 bg-[var(--danger-bg)] px-2.5 py-2 text-[12px] leading-snug text-[var(--danger)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{action.blocked_reason}</span>
            </div>
          )}

          {/* Diff toggle */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex w-full items-center justify-between px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)] transition-colors hover:text-foreground"
            aria-expanded={expanded}
          >
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3 w-3" />
              Diff · {targetLabel}
            </span>
            <span className="text-[10.5px]">{expanded ? "Hide" : "Show"}</span>
          </button>

          {expanded && (
            <div className="mx-3 mb-3 overflow-hidden rounded-md border border-border bg-background">
              {editing ? (
                <DiffEditor origAfter={action.diff.after} draft={draft} setDraft={setDraft} />
              ) : (
                <DiffView before={action.diff.before} after={after} />
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between gap-2 border-t border-border bg-[var(--canvas)]/50 px-3 py-2">
            <div className="text-[11px] text-[var(--muted-fg)]">
              {isBlocked && !isCommitted ? "Resolve blockers to enable" : ""}
              {isCommitted && (
                <span className="inline-flex items-center gap-1 text-[var(--success)]">
                  <CheckCircle2 className="h-3 w-3" />
                  Committed
                </span>
              )}
              {isReverted && "Reverted to prior state"}
            </div>
            <div className="flex items-center gap-1">
              {isCommitted ? (
                <button
                  type="button"
                  onClick={() => {
                    const ev = [...audit]
                      .reverse()
                      .find(
                        (e) =>
                          e.detail.target_object_id === action.diff.target_object_id &&
                          e.detail.tool === action.tool &&
                          !e.reverted &&
                          !e.action.startsWith("revert"),
                      );
                    if (ev) {
                      revertCommit(ev.id);
                      toast("Reverted", {
                        description: `${tool_labels[action.tool]} · ${targetLabel}`,
                      });
                    }
                  }}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11.5px] font-medium text-[var(--secondary-text)] transition-colors hover:bg-[var(--canvas)]"
                >
                  <Undo2 className="h-3 w-3" />
                  Undo
                </button>
              ) : editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="h-7 rounded-md px-2 text-[11.5px] font-medium text-[var(--secondary-text)] hover:bg-[var(--canvas)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveDraft}
                    className="h-7 rounded-md bg-primary px-2.5 text-[11.5px] font-semibold text-white hover:bg-[var(--primary-hover)]"
                  >
                    Save edits
                  </button>
                </>
              ) : (
                <>
                  {isRejected || isReverted ? (
                    <button
                      type="button"
                      onClick={() => resetAction(k)}
                      className="h-7 rounded-md border border-border bg-card px-2 text-[11.5px] font-medium text-[var(--secondary-text)] hover:bg-[var(--canvas)]"
                    >
                      Restore
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => rejectAction(k)}
                        className="h-7 rounded-md px-2 text-[11.5px] font-medium text-[var(--secondary-text)] hover:bg-[var(--canvas)]"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(true);
                          setExpanded(true);
                        }}
                        disabled={isBlocked}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11.5px] font-medium text-foreground transition-colors hover:bg-[var(--canvas)] disabled:opacity-40"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => approveAction(k)}
                        disabled={isBlocked}
                        className={[
                          "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-semibold transition-colors",
                          isBlocked
                            ? "cursor-not-allowed bg-[var(--canvas)] text-[var(--muted-fg)]"
                            : user === "approved" || user === "edited"
                              ? "bg-[var(--success-bg)] text-[var(--success)]"
                              : "bg-primary text-white hover:bg-[var(--primary-hover)]",
                        ].join(" ")}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {user === "approved" || user === "edited" ? "Approved" : "Approve"}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold capitalize",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Diff rendering                                                             */
/* -------------------------------------------------------------------------- */

const MONO = "font-mono text-[12px] leading-[1.55]";

function DiffView({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const isCreation = Object.keys(before).length === 0;

  return (
    <div className={[MONO, "divide-y divide-border"].join(" ")}>
      {keys.map((key) => {
        const hasBefore = key in before;
        const hasAfter = key in after;
        const same = hasBefore && hasAfter && formatVal(before[key]) === formatVal(after[key]);

        // Special multi-line for note bodies.
        if (key === "body" && hasAfter) {
          const text = String(after[key] ?? "");
          return (
            <div key={key} className="bg-[#E6F4EA]">
              {text.split(/\n/).map((line, i) => (
                <DiffLine key={i} kind="add" text={line} />
              ))}
            </div>
          );
        }

        if (same) {
          return <DiffLine key={key} kind="context" text={`${key}: ${formatVal(after[key])}`} />;
        }
        return (
          <div key={key}>
            {hasBefore && !isCreation && (
              <DiffLine kind="del" text={`${key}: ${formatVal(before[key])}`} />
            )}
            {hasAfter && <DiffLine kind="add" text={`${key}: ${formatVal(after[key])}`} />}
          </div>
        );
      })}
    </div>
  );
}

function DiffLine({ kind, text }: { kind: "add" | "del" | "context"; text: string }) {
  const prefix = kind === "add" ? "+" : kind === "del" ? "−" : " ";
  const cls =
    kind === "add"
      ? "bg-[#E6F4EA] text-[#1E8E3E]"
      : kind === "del"
        ? "bg-[#FCE8E6] text-[#D93025]"
        : "bg-background text-[var(--secondary-text)]";
  return (
    <div className={["flex gap-2 px-3 py-1 whitespace-pre-wrap break-words", cls].join(" ")}>
      <span aria-hidden className="select-none opacity-70 w-3">
        {prefix}
      </span>
      <span className="flex-1">{text}</span>
    </div>
  );
}

function DiffEditor({
  origAfter,
  draft,
  setDraft,
}: {
  origAfter: Record<string, unknown>;
  draft: Record<string, string>;
  setDraft: (v: Record<string, string>) => void;
}) {
  return (
    <div className={[MONO, "space-y-1 bg-background p-2"].join(" ")}>
      {Object.keys(origAfter).map((key) => {
        const multi = key === "body";
        return (
          <label key={key} className="block">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)] font-sans">
              {key}
            </span>
            {multi ? (
              <textarea
                value={draft[key] ?? ""}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                rows={4}
                className="mt-0.5 w-full rounded-md border border-border bg-[#E6F4EA]/40 px-2 py-1.5 text-[12px] text-[#1E8E3E] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            ) : (
              <input
                value={draft[key] ?? ""}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                className="mt-0.5 w-full rounded-md border border-border bg-[#E6F4EA]/40 px-2 py-1 text-[12px] text-[#1E8E3E] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Audit log                                                                  */
/* -------------------------------------------------------------------------- */

function AuditLog() {
  const { audit } = useActionsStore();

  if (audit.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-8 py-16 text-center">
        <div>
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--canvas)] text-[var(--muted-fg)]">
            <History className="h-4 w-4" />
          </div>
          <p className="mt-3 text-[13px] font-medium text-foreground">No audit events yet</p>
          <p className="mt-1 text-[12px] text-[var(--secondary-text)]">
            Executed actions will appear here as a commit history.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ol className="relative px-5 py-4">
      <span className="absolute left-[27px] top-6 bottom-6 w-px bg-border" />
      {audit
        .slice()
        .reverse()
        .map((ev) => {
          const isRevert = ev.action.startsWith("revert");
          const targetLabel = labelFor(ev.detail.target_object_id);
          const toolLabel =
            tool_labels[ev.detail.tool as keyof typeof tool_labels] ?? ev.detail.tool;
          const time = new Date(ev.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          return (
            <li key={ev.id} className="relative flex gap-3 py-2.5">
              <span
                className={[
                  "relative z-[1] mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ring-4 ring-[var(--canvas)]/40",
                  isRevert
                    ? "bg-[var(--canvas)] text-[var(--muted-fg)]"
                    : ev.reverted
                      ? "bg-[var(--canvas)] text-[var(--muted-fg)]"
                      : "bg-[var(--success-bg)] text-[var(--success)]",
                ].join(" ")}
              >
                {isRevert ? <Undo2 className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 shadow-card">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="font-semibold text-foreground">{ev.actor}</span>
                  <span className="text-[var(--muted-fg)]">·</span>
                  <span className="text-[var(--secondary-text)]">
                    {isRevert ? "reverted " : "committed "}
                    <span className="font-medium text-foreground">{toolLabel}</span> · {targetLabel}
                  </span>
                  <span className="ml-auto font-mono text-[10.5px] text-[var(--muted-fg)]">
                    {time}
                  </span>
                </div>
                {!isRevert && !ev.reverted && (
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        revertCommit(ev.id);
                        toast("Reverted", {
                          description: `${toolLabel} · ${targetLabel}`,
                        });
                      }}
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-[var(--secondary-text)] transition-colors hover:bg-[var(--canvas)]"
                    >
                      <Undo2 className="h-3 w-3" />
                      Revert
                    </button>
                  </div>
                )}
                {ev.reverted && (
                  <div className="mt-1 text-[11px] text-[var(--muted-fg)]">
                    Reverted in a later event.
                  </div>
                )}
              </div>
            </li>
          );
        })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Gateway execution result (live) — proof the server re-gates the plan        */
/* -------------------------------------------------------------------------- */

function GatewayResult({ events }: { events: ServerAuditEvent[] }) {
  const skipped = events.filter((e) => e.action === "skipped").length;
  const executed = events.length - skipped;
  return (
    <div className="border-b border-border bg-background px-5 py-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-ai text-white">
          <ShieldCheck className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-foreground">
            Gateway execution · server-gated
          </div>
          <div className="text-[11.5px] leading-snug text-[var(--secondary-text)]">
            Approved all {events.length} indices · gateway executed{" "}
            <span className="font-semibold text-[var(--success)]">{executed}</span> · refused{" "}
            <span className="font-semibold text-[var(--danger)]">{skipped}</span> (re-gated
            server-side)
          </div>
        </div>
      </div>

      <ol className="mt-3 space-y-1.5">
        {events.map((e, i) => {
          const ok = e.action === "executed";
          const toolLabel =
            tool_labels[e.detail.tool as keyof typeof tool_labels] ?? e.detail.tool ?? "action";
          const target = e.detail.target ? labelFor(String(e.detail.target)) : "";
          return (
            <li
              key={i}
              className={[
                "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[12px]",
                ok
                  ? "border-[var(--success)]/25 bg-[var(--success-bg)]/50"
                  : "border-[var(--danger)]/25 bg-[var(--danger-bg)]/40",
              ].join(" ")}
            >
              {ok ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
              ) : (
                <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--danger)]" />
              )}
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{toolLabel}</span>
                {target ? <span className="text-[var(--secondary-text)]"> · {target}</span> : null}
                <span className={ok ? "ml-1 text-[var(--success)]" : "ml-1 text-[var(--danger)]"}>
                  {ok ? "· executed" : "· refused"}
                </span>
                {!ok && e.detail.reason ? (
                  <div className="mt-0.5 font-mono text-[10.5px] leading-snug text-[var(--danger)]">
                    {e.detail.reason}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-2.5 text-[11px] leading-snug text-[var(--muted-fg)]">
        Every index was submitted as approved. The gateway recomposed the plan and refused the
        blocked actions — a client cannot bypass a deterministic gate.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cascade drawer (Beat 5) — one governed edit, human-accepted                */
/* -------------------------------------------------------------------------- */

function CascadeDrawer() {
  const { drawer } = useActionsStore();
  const reval = useRevalidation();
  const a = cascade_action;
  const Icon = TOOL_ICON[a.tool] ?? GitCompareArrows;
  const targetLabel = labelFor(a.diff.target_object_id);
  const fromLabel = labelFor(a.sources[0]?.object_id ?? "");
  const accepted = reval.csReconciled;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(a.diff.after).map(([k, v]) => [k, formatVal(v)])),
  );
  const [after, setAfter] = useState<Record<string, unknown>>(a.diff.after);

  function saveDraft() {
    const next: Record<string, unknown> = {};
    Object.keys(a.diff.after).forEach((key) => {
      next[key] = draft[key] ?? "";
    });
    setAfter(next);
    setEditing(false);
  }

  function onAccept() {
    acceptCascadeEdit();
    toast.success("Edit accepted · conflict reconciled", {
      description: `${targetLabel} now reflects the approved 22%.`,
    });
    closeDrawer();
  }

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label="Revalidation edit"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-150"
        onClick={closeDrawer}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-border bg-background shadow-panel animate-in slide-in-from-right duration-200 sm:w-[560px]">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-5 pt-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="grid h-6 w-6 place-items-center rounded-md bg-gradient-ai text-white"
                  aria-hidden
                >
                  <GitCompareArrows className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                  Revalidation edit
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] font-semibold text-[var(--secondary-text)]">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  Agent proposes · you dispose
                </span>
              </div>
              <p className="mt-1.5 text-[12px] text-[var(--secondary-text)]">
                One dependent document needs your acceptance after the approved 22% exception.
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--muted-fg)]">
                from {drawer.source || "Revalidation — Acme renewal"}
              </p>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted-fg)] transition-colors hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body — single card */}
        <div className="flex-1 overflow-y-auto bg-[var(--canvas)]/40 px-5 py-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <div className="px-4 pt-3">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--canvas)] text-[var(--secondary-text)]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                      Revalidation edit
                    </div>
                    <div className="mt-0.5 truncate text-[14px] font-semibold leading-tight text-foreground">
                      {targetLabel}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <Chip className={SIDE_CLS[a.side_effect]}>{a.side_effect}</Chip>
                  <Chip className={RISK_CLS[a.risk]}>low risk</Chip>
                  <Chip
                    className={
                      accepted
                        ? "bg-[var(--success-bg)] text-[var(--success)]"
                        : "bg-[var(--warning-bg)] text-[var(--warning)]"
                    }
                  >
                    {accepted ? "Accepted" : "Needs acceptance"}
                  </Chip>
                </div>
              </div>

              <p className="mt-2 text-[12.5px] leading-snug text-[var(--secondary-text)]">
                {a.reason}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                  from
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
                  {fromLabel}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-1.5 px-0 py-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                <GitCompareArrows className="h-3 w-3" />
                Diff · {targetLabel}
              </div>
              <div className="mb-3 overflow-hidden rounded-md border border-border bg-background">
                {editing ? (
                  <DiffEditor origAfter={a.diff.after} draft={draft} setDraft={setDraft} />
                ) : (
                  <DiffView before={a.diff.before} after={after} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer — Reject · Edit · Accept edit */}
        <div className="shrink-0 border-t border-border bg-background px-5 py-3">
          <div className="flex items-center justify-end gap-2">
            {accepted ? (
              <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--success)]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Accepted · conflict reconciled
              </span>
            ) : editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="h-8 rounded-md px-3 text-[12.5px] font-medium text-[var(--secondary-text)] hover:bg-[var(--canvas)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  className="h-8 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-[var(--primary-hover)]"
                >
                  Save edits
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="h-8 rounded-md px-3 text-[12.5px] font-medium text-[var(--secondary-text)] hover:bg-[var(--canvas)]"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[var(--canvas)]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onAccept}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-gradient-ai px-3 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-95"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Accept edit
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* Suppress unused-icon warnings (kept for future expansion) */
void XCircle;
void Lock;

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CheckSquare,
  FileEdit,
  GitBranch,
  History,
  Lock,
  Pencil,
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
  derive_status,
  object_labels,
  tool_labels,
  type Action,
  type DerivedStatus,
  type SideEffect,
  type Risk,
} from "@/data/actions";
import {
  approveAction,
  approveAllReady,
  closeDrawer,
  executeApproved,
  getEffectiveAfter,
  rejectAction,
  resetAction,
  revertCommit,
  saveEdit,
  useActionsStore,
  type UserStatus,
} from "@/lib/actions-store";
import { useActionPlanQuery } from "@/hooks/queries";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const TOOL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  create_task: CheckSquare,
  update_project_status: Workflow,
  route_approval: GitBranch,
  draft_internal_note: FileEdit,
  schedule_meeting: Calendar,
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

/* -------------------------------------------------------------------------- */
/* Drawer                                                                     */
/* -------------------------------------------------------------------------- */

export function ActionDiffDrawer() {
  const store = useActionsStore();
  const { drawer, user_status, audit } = store;
  const planActions = useActionPlanQuery().data.actions;
  const [tab, setTab] = useState<"changes" | "audit">("changes");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Switch to audit tab when commits land; back to changes on reopen.
  useEffect(() => {
    if (drawer.open) setTab("changes");
  }, [drawer.open]);

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
    return [...planActions].sort((a, b) => order[derive_status(a)] - order[derive_status(b)]);
  }, [planActions]);

  const counts = useMemo(() => {
    const c = {
      total: planActions.length,
      ready: 0,
      needs_approval: 0,
      blocked: 0,
      approved: 0,
      edited: 0,
      rejected: 0,
      committed: 0,
    };
    planActions.forEach((a) => {
      const d = derive_status(a);
      c[d] += 1;
      const u = user_status[action_key(a)];
      if (u === "approved") c.approved += 1;
      else if (u === "edited") c.edited += 1;
      else if (u === "rejected") c.rejected += 1;
      else if (u === "committed") c.committed += 1;
    });
    return c;
  }, [user_status, planActions]);

  const executableCount = useMemo(
    () =>
      planActions.filter((a) => {
        const u = user_status[action_key(a)];
        return (u === "approved" || u === "edited") && !a.blocked_reason;
      }).length,
    [user_status, planActions],
  );

  function onExecute() {
    const n = executeApproved();
    if (n > 0) {
      toast.success(`${n} action${n === 1 ? "" : "s"} executed · audit recorded`);
      setTab("audit");
    }
  }

  if (!drawer.open) return null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label="Proposed follow-ups"
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
                  Proposed follow-ups
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] font-semibold text-[var(--secondary-text)]">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  Permissions-aware
                </span>
              </div>
              <p className="mt-1.5 text-[12px] text-[var(--secondary-text)]">
                {counts.total} actions ·{" "}
                <span className="font-medium text-[var(--success)]">{counts.ready} ready</span> ·{" "}
                <span className="font-medium text-[var(--warning)]">
                  {counts.needs_approval} need approval
                </span>{" "}
                · <span className="font-medium text-[var(--danger)]">{counts.blocked} blocked</span>
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

          {/* Tabs */}
          <div className="mt-3 inline-flex rounded-md bg-[var(--canvas)] p-0.5 text-[12px] font-medium">
            <button
              type="button"
              onClick={() => setTab("changes")}
              className={[
                "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 transition-colors",
                tab === "changes"
                  ? "bg-background text-foreground shadow-card"
                  : "text-[var(--secondary-text)] hover:text-foreground",
              ].join(" ")}
            >
              <GitBranch className="h-3 w-3" />
              Changes
            </button>
            <button
              type="button"
              onClick={() => setTab("audit")}
              className={[
                "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 transition-colors",
                tab === "audit"
                  ? "bg-background text-foreground shadow-card"
                  : "text-[var(--secondary-text)] hover:text-foreground",
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
            <ul className="space-y-3 px-5 py-4">
              {ordered.map((a) => {
                const k = action_key(a);
                return (
                  <ActionCard
                    key={k}
                    action={a}
                    user={user_status[k] ?? "proposed"}
                    setRef={(el) => (cardRefs.current[k] = el)}
                    focused={drawer.focus_key === k}
                  />
                );
              })}
            </ul>
          ) : (
            <AuditLog />
          )}
        </div>

        {/* Footer */}
        {tab === "changes" && (
          <div className="shrink-0 border-t border-border bg-background px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11.5px] leading-snug text-[var(--secondary-text)]">
                <span className="font-semibold text-[var(--success)]">
                  {counts.approved} approved
                </span>
                {counts.edited > 0 && (
                  <>
                    {" "}
                    · <span className="font-semibold text-primary">{counts.edited} edited</span>
                  </>
                )}{" "}
                ·{" "}
                <span className="text-[var(--muted-fg)]">
                  {counts.rejected} rejected · {counts.blocked} blocked
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={approveAllReady}
                  className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Approve all ready
                </button>
                <button
                  type="button"
                  onClick={onExecute}
                  disabled={executableCount === 0}
                  className={[
                    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold text-white transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    executableCount === 0
                      ? "cursor-not-allowed bg-[var(--muted-fg)] opacity-60"
                      : "bg-gradient-ai hover:opacity-95",
                  ].join(" ")}
                >
                  <Send className="h-3.5 w-3.5" />
                  Execute {executableCount > 0 ? executableCount : ""} approved
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
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
              <Chip className={SIDE_CLS[action.side_effect]}>{action.side_effect}</Chip>
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

/* Suppress unused-icon warnings (kept for future expansion) */
void XCircle;
void Lock;

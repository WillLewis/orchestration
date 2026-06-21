import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Circle,
  CircleDot,
  Download,
  FileCheck2,
  GitBranch,
  Inbox,
  ListChecks,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/meeting/TopBar";
import {
  decision_chip,
  escalationsInFlightLabel,
  loop_ui,
  personas,
  type Assignment,
  type Decision,
  type Escalation,
  type LoopState,
  type PersonaRole,
  type Reply,
  type Scheduled,
} from "@/data/loop";
import {
  action_key,
  approver_labels,
  derive_status,
  object_labels,
  tool_labels,
  type Action,
  type DerivedStatus,
} from "@/data/actions";
import { approveAction, executeApproved, resetActions, useActionsStore } from "@/lib/actions-store";
import { useRevalidation } from "@/lib/revalidation-store";
import {
  LIVE,
  useActionPlanQuery,
  useExecuteActionsMutation,
  useLoopQuery,
  type ServerAuditEvent,
} from "@/hooks/queries";

export const Route = createFileRoute("/loop")({
  head: () => ({
    meta: [
      { title: "Agent Batch — Acme renewal" },
      {
        name: "description",
        content:
          "Every follow-up the agent recommends for this meeting, on one page — approve and run the whole batch, then watch it orchestrate across owners with a human-approved audit trail.",
      },
    ],
  }),
  component: WorkLoop,
});

/* -------------------------------------------------------------------------- */
/* Types & event stream                                                       */
/* -------------------------------------------------------------------------- */

type StageKey = "plan" | "distribute" | "collect" | "escalate" | "schedule" | "close";

const STAGES: { key: StageKey; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "distribute", label: "Distribute" },
  { key: "collect", label: "Collect" },
  { key: "escalate", label: "Escalate" },
  { key: "schedule", label: "Schedule" },
  { key: "close", label: "Close" },
];

type TimelineEvent =
  | {
      kind: "assignment";
      stage: "distribute";
      from: PersonaRole;
      to: PersonaRole;
      data: Assignment;
    }
  | { kind: "reply"; stage: "collect"; actor: PersonaRole; data: Reply }
  | { kind: "escalation"; stage: "escalate"; actor: PersonaRole; data: Escalation }
  | { kind: "scheduled"; stage: "schedule"; actor: PersonaRole; data: Scheduled };

function buildEvents(state: LoopState): TimelineEvent[] {
  const e: TimelineEvent[] = [];
  state.assignments.forEach((a) =>
    e.push({
      kind: "assignment",
      stage: "distribute",
      from: "command_agent",
      to: a.owner_role,
      data: a,
    }),
  );
  state.replies.forEach((r) => e.push({ kind: "reply", stage: "collect", actor: r.role, data: r }));
  state.escalations.forEach((es) =>
    e.push({ kind: "escalation", stage: "escalate", actor: "legal", data: es }),
  );
  state.scheduled.forEach((s) =>
    e.push({
      kind: "scheduled",
      stage: "schedule",
      actor: "command_agent",
      data: s,
    }),
  );
  return e;
}

const TOOL_LABEL: Record<string, string> = {
  route_approval: "route approval",
  create_task: "create task",
  schedule_meeting: "schedule meeting",
  draft_internal_note: "draft internal note",
  update_project_status: "update project status",
};

const TOOL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  create_task: ListChecks,
  route_approval: Send,
  update_project_status: Workflow,
  draft_internal_note: FileCheck2,
  schedule_meeting: Calendar,
};

const ROLE_TITLE: Partial<Record<PersonaRole, string>> = {
  relationship_manager: "Relationship Manager",
  credit_officer: "Credit Officer",
  legal: "Legal",
  compliance: "Compliance Officer",
};

type MatrixStatus = "pending" | "approved" | "signed" | "escalated" | "in_review";
type MatrixRow = { role: PersonaRole; title: string; status: MatrixStatus };

// Normalized audit row so the page renders one shape whether the run was mock (client store) or
// live (gateway-executed). The store and gateway emit different event shapes; we flatten both.
type DisplayAudit = { actor: string; action: string; time: string };

/* -------- batch helpers — turn an Action into one human-readable batch row -------- */

const BATCH_GROUPS: { key: DerivedStatus; label: string; hint: string }[] = [
  { key: "ready", label: "Ready to run", hint: "Executes on approval" },
  { key: "needs_approval", label: "Approval routing", hint: "Routes to an approver" },
  { key: "blocked", label: "Blocked — won't run until cleared", hint: "Prerequisite missing" },
];

const STATUS_CHIP: Record<DerivedStatus, { label: string; cls: string }> = {
  ready: { label: "Ready", cls: "bg-[var(--success-bg)] text-[var(--success)]" },
  needs_approval: {
    label: "Routes for approval",
    cls: "bg-[var(--warning-bg)] text-[var(--warning)]",
  },
  blocked: { label: "Blocked", cls: "bg-[var(--danger-bg)] text-[var(--danger)]" },
};

function batchTitle(a: Action): string {
  const after = a.diff.after as Record<string, unknown>;
  if (a.tool === "create_task") return String(after.title ?? "New task");
  if (a.tool === "draft_internal_note") return String(after.title ?? "Internal note");
  if (a.tool === "schedule_meeting") return String(after.title ?? "Meeting");
  if (a.tool === "update_project_status") {
    return `${object_labels[a.diff.target_object_id] ?? a.diff.target_object_id} → ${String(after.status ?? "")}`;
  }
  return object_labels[a.diff.target_object_id] ?? a.diff.target_object_id;
}

function batchDestination(a: Action): string | null {
  if (a.tool === "create_task") {
    const assignee = (a.diff.after as Record<string, unknown>).assignee;
    return assignee ? String(assignee) : null;
  }
  if (a.required_approver) return approver_labels[a.required_approver] ?? a.required_approver;
  return null;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

function WorkLoop() {
  // The batch IS the agent's recommended action plan — the same source the chat and brief act on
  // (bundled mock by default; live `GET /api/actions`, genuinely composed from the meeting). Running
  // it here goes through the SAME shared store as the Agent Actions drawer, so the two surfaces are
  // one batch: run it all here, or piecemeal in chat — committed state + audit stay in sync.
  const { data: actionData } = useActionPlanQuery();
  const baseActions = actionData.actions;
  const revalidation = useRevalidation();
  const actionEntries = useMemo(
    () =>
      baseActions
        .map((action, index) => ({ action, index }))
        .filter(
          ({ action }) =>
            !(
              revalidation.creditSigned &&
              action.tool === "route_approval" &&
              action.required_approver === "credit_officer"
            ),
        ),
    [baseActions, revalidation.creditSigned],
  );
  const actions = useMemo(() => actionEntries.map(({ action }) => action), [actionEntries]);
  const { user_status, audit: storeAudit } = useActionsStore();
  // The multi-party orchestration dossier (who the work fans out to + their replies/escalations).
  // Live mode composes this from the plan server-side; mock is the bundled scripted outcome.
  const { data: loop_state } = useLoopQuery();
  const events = useMemo(() => buildEvents(loop_state), [loop_state]);
  const inFlight = escalationsInFlightLabel(loop_state);
  const execute = useExecuteActionsMutation();

  const [serverResult, setServerResult] = useState<ServerAuditEvent[] | null>(null);
  const [exported, setExported] = useState(false);
  const [hoverRole, setHoverRole] = useState<PersonaRole | null>(null);

  const grouped = useMemo(() => {
    const g: Record<DerivedStatus, Action[]> = { ready: [], needs_approval: [], blocked: [] };
    actions.forEach((a) => g[derive_status(a)].push(a));
    return g;
  }, [actions]);
  const runnable = useMemo(() => actions.filter((a) => !a.blocked_reason), [actions]);
  const submittedIndexes = useMemo(() => actionEntries.map(({ index }) => index), [actionEntries]);

  const committedCount = useMemo(
    () => actions.filter((a) => user_status[action_key(a)] === "committed").length,
    [actions, user_status],
  );
  const executedCount =
    committedCount || (serverResult?.filter((e) => e.action === "executed").length ?? 0);
  // The batch has been run once any action committed (mock) or the gateway returned a result (live).
  const ran = committedCount > 0 || (serverResult?.length ?? 0) > 0;

  function runBatch() {
    if (ran) return;
    if (LIVE) {
      // Submit every index; the gateway recomposes + re-gates, so blocked actions come back skipped.
      execute.mutate(
        { approved_indices: submittedIndexes },
        {
          onSuccess: (ev) => {
            setServerResult(ev);
            const skipped = ev.filter((e) => e.action === "skipped").length;
            toast.success(
              `Ran ${ev.length - skipped} action${ev.length - skipped === 1 ? "" : "s"}`,
              {
                description: skipped
                  ? `${skipped} blocked action${skipped === 1 ? "" : "s"} re-gated server-side`
                  : undefined,
              },
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
    runnable.forEach((a) => approveAction(action_key(a)));
    const n = executeApproved();
    toast.success(`Ran ${n} action${n === 1 ? "" : "s"} · audit recorded`, {
      description: grouped.blocked.length
        ? `${grouped.blocked.length} blocked action${grouped.blocked.length === 1 ? "" : "s"} skipped`
        : undefined,
    });
  }

  function reset() {
    resetActions();
    setServerResult(null);
    setExported(false);
  }

  function exportDossier() {
    setExported(true);
    toast.success("Dossier exported", { description: "Audit-ready record of this batch saved." });
  }

  // Stage strip is a static status indicator (no timed reveal): Plan done once proposed; the
  // distribute→schedule stages light up after the batch runs; Close after export.
  const doneStages = useMemo<Set<StageKey>>(() => {
    const d = new Set<StageKey>();
    if (ran)
      (["plan", "distribute", "collect", "escalate", "schedule"] as StageKey[]).forEach((k) =>
        d.add(k),
      );
    if (exported) d.add("close");
    return d;
  }, [ran, exported]);
  const activeStage: StageKey = !ran ? "plan" : exported ? "close" : "schedule";

  const statusPill = !ran
    ? {
        label: `Proposed — ${runnable.length} to run · ${grouped.blocked.length} blocked`,
        cls: "bg-[var(--warning-bg)] text-[var(--warning)]",
      }
    : exported
      ? {
          label: `Batch run complete · ${inFlight}`,
          cls: "bg-[var(--success-bg)] text-[var(--success)]",
        }
      : {
          label: `Ran ${executedCount} · ${grouped.blocked.length} blocked`,
          cls: "bg-[var(--primary-tint)] text-primary",
        };

  const groupedEvents = useMemo(() => {
    const g: Record<StageKey, TimelineEvent[]> = {
      plan: [],
      distribute: [],
      collect: [],
      escalate: [],
      schedule: [],
      close: [],
    };
    events.forEach((e) => g[e.stage].push(e));
    return g;
  }, [events]);

  // One audit shape from either run path.
  const displayAudit = useMemo<DisplayAudit[]>(() => {
    if (serverResult) {
      return serverResult
        .filter((e) => e.action === "executed")
        .map((e) => ({
          actor: e.actor || "Dana R.",
          action: `${tool_labels[e.detail.tool as keyof typeof tool_labels] ?? e.detail.tool ?? "action"} · ${
            e.detail.target
              ? (object_labels[String(e.detail.target)] ?? String(e.detail.target))
              : ""
          }`,
          time: "just now",
        }));
    }
    return storeAudit.map((e) => ({
      actor: e.actor,
      action: `${tool_labels[e.detail.tool as keyof typeof tool_labels] ?? e.detail.tool} · ${
        object_labels[e.detail.target_object_id] ?? e.detail.target_object_id
      }`,
      time: new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));
  }, [serverResult, storeAudit]);

  const matrixRows = useMemo<MatrixRow[]>(() => {
    const rows: MatrixRow[] = [
      {
        role: "relationship_manager",
        title: ROLE_TITLE.relationship_manager!,
        status: ran ? "approved" : "pending",
      },
      {
        role: "credit_officer",
        title: ROLE_TITLE.credit_officer!,
        status: revalidation.creditSigned || ran ? "signed" : "pending",
      },
      { role: "legal", title: ROLE_TITLE.legal!, status: ran ? "escalated" : "pending" },
    ];
    if (ran && loop_state.escalations.length) {
      rows.push({ role: "compliance", title: ROLE_TITLE.compliance!, status: "in_review" });
    }
    return rows;
  }, [ran, revalidation.creditSigned, loop_state.escalations.length]);
  const approvedCount = matrixRows.filter(
    (r) => r.status === "approved" || r.status === "signed",
  ).length;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)] text-foreground">
      <TopBar showBackToMeeting rightSlot={<div />} />

      {/* Header */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-5 xl:px-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-tint)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-primary">
                <Workflow className="h-3 w-3" />
                Agent Batch
              </div>
              <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-tight text-foreground">
                Agent Batch — Acme renewal
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--muted-fg)]">
                <Link
                  to="/packet"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)] transition-colors hover:bg-[var(--canvas)]"
                >
                  <FileCheck2 className="h-3 w-3" />
                  from Decision Packet — Acme renewal
                </Link>
                <span
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    statusPill.cls,
                  ].join(" ")}
                >
                  {!ran ? (
                    <Circle className="h-3 w-3" />
                  ) : exported ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <CircleDot className="h-3 w-3" />
                  )}
                  {statusPill.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12.5px] font-medium text-[var(--secondary-text)] transition-colors hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
              {!ran ? (
                <button
                  type="button"
                  onClick={runBatch}
                  disabled={execute.isPending || runnable.length === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-ai px-3.5 text-[13px] font-semibold text-white shadow-card transition-opacity hover:opacity-95 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {execute.isPending ? "Running…" : `Approve & run batch (${runnable.length})`}
                </button>
              ) : (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--success-bg)] px-3.5 text-[13px] font-semibold text-[var(--success)]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Batch executed
                </span>
              )}
            </div>
          </div>

          {/* Stage strip (status) */}
          <div className="mt-6">
            <ol className="flex items-stretch gap-2">
              {STAGES.map((s, i) => {
                const isDone = doneStages.has(s.key);
                const isActive = activeStage === s.key && !isDone;
                return (
                  <li key={s.key} className="flex flex-1 items-center gap-2 min-w-0">
                    <div
                      className={[
                        "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                        isActive
                          ? "border-transparent bg-gradient-ai text-white shadow-card"
                          : isDone
                            ? "border-[var(--success)]/30 bg-[var(--success-bg)] text-[var(--success)]"
                            : "border-border bg-card text-[var(--muted-fg)]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                          isActive
                            ? "bg-white/20 text-white"
                            : isDone
                              ? "bg-[var(--success)] text-white"
                              : "bg-[var(--canvas)] text-[var(--muted-fg)]",
                        ].join(" ")}
                      >
                        {isDone ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                      </span>
                      <span className="truncate text-[12.5px] font-semibold">{s.label}</span>
                    </div>
                    {i < STAGES.length - 1 && (
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-fg)]" />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-[1320px] px-6 py-7 xl:px-10">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <main className="min-w-0 space-y-7">
            <BatchPlan
              grouped={grouped}
              userStatus={user_status}
              ran={ran}
              pending={execute.isPending}
              runnableCount={runnable.length}
              blockedCount={grouped.blocked.length}
              onRun={runBatch}
            />

            {ran && (
              <>
                {(["distribute", "collect", "escalate", "schedule"] as StageKey[]).map(
                  (sk) =>
                    groupedEvents[sk].length > 0 && (
                      <StageBlock
                        key={sk}
                        stage={sk}
                        events={groupedEvents[sk]}
                        hoverRole={hoverRole}
                        setHoverRole={setHoverRole}
                      />
                    ),
                )}
                <CloseSection audit={displayAudit} exported={exported} onExport={exportDossier} />
              </>
            )}
          </main>

          {/* Dossier rail */}
          <Dossier
            ran={ran}
            exported={exported}
            hoverRole={hoverRole}
            setHoverRole={setHoverRole}
            matrixRows={matrixRows}
            approvedCount={approvedCount}
            events={events}
            audit={displayAudit}
            executedCount={executedCount}
            inFlightLabel={inFlight}
            onExport={exportDossier}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Batch plan — the agent's recommended actions for this meeting               */
/* -------------------------------------------------------------------------- */

function BatchPlan({
  grouped,
  userStatus,
  ran,
  pending,
  runnableCount,
  blockedCount,
  onRun,
}: {
  grouped: Record<DerivedStatus, Action[]>;
  userStatus: Record<string, string>;
  ran: boolean;
  pending: boolean;
  runnableCount: number;
  blockedCount: number;
  onRun: () => void;
}) {
  const total = grouped.ready.length + grouped.needs_approval.length + grouped.blocked.length;
  return (
    <section className="animate-loop-in">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-ai text-white">
          <ListChecks className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
            The batch
          </div>
          <div className="text-[11.5px] text-[var(--secondary-text)]">
            Every follow-up the agent recommends for this meeting
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              {total} recommended action{total === 1 ? "" : "s"}
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--secondary-text)]">
              The same plan the chat and brief act on — run the whole batch here, or one-at-a-time
              in chat. Nothing is sent until you approve.
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-[var(--muted-fg)]">
              Derived from the{" "}
              <Link to="/packet" className="font-medium text-primary hover:underline">
                Decision Packet's
              </Link>{" "}
              recommended next-steps — generated from the meeting transcript and linked content.
            </p>
          </div>
          <span
            className={[
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              ran
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : "bg-[var(--warning-bg)] text-[var(--warning)]",
            ].join(" ")}
          >
            <ShieldCheck className="h-3 w-3" />
            {ran ? "Executed" : "Awaiting approval"}
          </span>
        </div>

        <div className="mt-4 space-y-4">
          {BATCH_GROUPS.map((grp) => {
            const items = grouped[grp.key];
            if (items.length === 0) return null;
            return (
              <div key={grp.key}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
                    {grp.label}
                  </span>
                  <span className="rounded-full bg-[var(--canvas)] px-1.5 text-[10px] font-semibold text-[var(--secondary-text)]">
                    {items.length}
                  </span>
                </div>
                <ul className="space-y-2">
                  {items.map((a) => (
                    <BatchRow
                      key={action_key(a)}
                      action={a}
                      status={userStatus[action_key(a)] ?? "proposed"}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-[11.5px] leading-snug text-[var(--muted-fg)]">
            {ran
              ? "Batch executed — the orchestration and audit trail are below."
              : `Approving runs the ${runnableCount} non-blocked action${runnableCount === 1 ? "" : "s"}; ${blockedCount} blocked stay${blockedCount === 1 ? "s" : ""} blocked.`}
          </p>
          {!ran && (
            <button
              type="button"
              onClick={onRun}
              disabled={pending || runnableCount === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-ai px-4 text-[13px] font-semibold text-white shadow-card transition-opacity hover:opacity-95 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {pending ? "Running…" : `Approve & run batch (${runnableCount})`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function BatchRow({ action, status }: { action: Action; status: string }) {
  const Icon = TOOL_ICON[action.tool] ?? Sparkles;
  const d = derive_status(action);
  const committed = status === "committed";
  const destination = batchDestination(action);
  const chip = committed
    ? { label: "Sent", cls: "bg-[var(--success)] text-white" }
    : STATUS_CHIP[d];

  return (
    <li
      className={[
        "flex items-start gap-3 rounded-lg border px-3 py-2.5",
        d === "blocked" ? "border-dashed border-border/70 bg-card/60" : "border-border bg-card",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md",
          committed
            ? "bg-[var(--success-bg)] text-[var(--success)]"
            : "bg-[var(--canvas)] text-[var(--secondary-text)]",
        ].join(" ")}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
            {tool_labels[action.tool]}
          </span>
          {destination && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--secondary-text)]">
              <ArrowRight className="h-2.5 w-2.5" />
              {destination}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[13px] font-semibold leading-snug text-foreground">
          {batchTitle(action)}
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--secondary-text)]">
          {action.reason}
        </p>
        {action.blocked_reason && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-[var(--danger)]/25 bg-[var(--danger-bg)] px-2 py-1 text-[11.5px] leading-snug text-[var(--danger)]">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{action.blocked_reason}</span>
          </div>
        )}
      </div>
      <span
        className={[
          "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
          chip.cls,
        ].join(" ")}
      >
        {committed && <CheckCircle2 className="h-2.5 w-2.5" />}
        {chip.label}
      </span>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Stage block (orchestration outcome)                                        */
/* -------------------------------------------------------------------------- */

const STAGE_META: Record<
  StageKey,
  { label: string; sub: string; icon: React.ComponentType<{ className?: string }> }
> = {
  plan: {
    label: "Plan",
    sub: "Agent's proposed batch",
    icon: ListChecks,
  },
  distribute: {
    label: "Distribute",
    sub: "Agent fans work to owners",
    icon: Send,
  },
  collect: {
    label: "Collect",
    sub: "Async replies arrive",
    icon: Inbox,
  },
  escalate: {
    label: "Escalate",
    sub: "Beyond owner authority",
    icon: ArrowUpRight,
  },
  schedule: {
    label: "Schedule",
    sub: "Unresolved → next forum",
    icon: Calendar,
  },
  close: {
    label: "Close",
    sub: "Human-approved · audit-ready",
    icon: ShieldCheck,
  },
};

function StageBlock({
  stage,
  events,
  hoverRole,
  setHoverRole,
}: {
  stage: StageKey;
  events: TimelineEvent[];
  hoverRole: PersonaRole | null;
  setHoverRole: (r: PersonaRole | null) => void;
}) {
  const meta = STAGE_META[stage];
  const Icon = meta.icon;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--canvas)] text-[var(--secondary-text)]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
            {meta.label}
          </div>
          <div className="text-[11.5px] text-[var(--secondary-text)]">{meta.sub}</div>
        </div>
      </div>

      <ol className="relative space-y-2.5 border-l border-dashed border-border pl-5">
        {events.map((ev, i) => (
          <TimelineRow
            key={`${stage}-${i}`}
            event={ev}
            hoverRole={hoverRole}
            setHoverRole={setHoverRole}
          />
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Timeline row                                                               */
/* -------------------------------------------------------------------------- */

function Avatar({
  role,
  size = 7,
  dim,
  highlight,
}: {
  role: PersonaRole;
  size?: number;
  dim?: boolean;
  highlight?: boolean;
}) {
  const p = personas[role];
  const sizeCls =
    size === 6
      ? "h-6 w-6 text-[10px]"
      : size === 8
        ? "h-8 w-8 text-[11.5px]"
        : "h-7 w-7 text-[10.5px]";
  const cls = [
    "grid shrink-0 place-items-center rounded-full font-semibold transition-all",
    sizeCls,
    p.agent
      ? "bg-gradient-ai text-white shadow-card"
      : role === "compliance"
        ? "bg-[var(--warning-bg)] text-[var(--warning)]"
        : role === "legal"
          ? "bg-[#EEF1FF] text-[#3949AB]"
          : role === "credit_officer"
            ? "bg-[var(--primary-tint)] text-primary"
            : role === "analyst"
              ? "bg-[#E8F5EE] text-[var(--success)]"
              : "bg-[#FFF1E6] text-[#B25E00]",
    dim ? "opacity-50" : "",
    highlight ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
  ].join(" ");
  return (
    <span className={cls} title={p.display} aria-label={p.display}>
      {p.initials}
    </span>
  );
}

function TimelineRow({
  event,
  hoverRole,
  setHoverRole,
}: {
  event: TimelineEvent;
  hoverRole: PersonaRole | null;
  setHoverRole: (r: PersonaRole | null) => void;
}) {
  const primaryRole: PersonaRole =
    event.kind === "assignment"
      ? event.to
      : event.kind === "reply"
        ? event.actor
        : event.kind === "escalation"
          ? "legal"
          : "command_agent";

  const dim =
    hoverRole !== null &&
    hoverRole !== primaryRole &&
    hoverRole !== "command_agent" &&
    !(event.kind === "assignment" && hoverRole === event.from);
  const highlight =
    hoverRole !== null &&
    (hoverRole === primaryRole || (event.kind === "assignment" && hoverRole === event.from));

  return (
    <li
      className={["relative animate-loop-in", dim ? "opacity-50" : ""].join(" ")}
      onMouseEnter={() => setHoverRole(primaryRole)}
      onMouseLeave={() => setHoverRole(null)}
    >
      <span
        className={[
          "absolute -left-[26px] top-3 h-2 w-2 rounded-full",
          highlight ? "bg-primary" : "bg-[var(--muted-fg)]",
        ].join(" ")}
        aria-hidden
      />
      <div
        className={[
          "flex items-start gap-3 rounded-lg border bg-card px-3.5 py-2.5 shadow-card transition-colors",
          highlight ? "border-primary/40" : "border-border",
        ].join(" ")}
      >
        {event.kind === "assignment" ? (
          <AssignmentBody ev={event} />
        ) : event.kind === "reply" ? (
          <ReplyBody ev={event} />
        ) : event.kind === "escalation" ? (
          <EscalationBody ev={event} />
        ) : (
          <ScheduledBody ev={event} />
        )}
      </div>
    </li>
  );
}

function RelTime() {
  return (
    <span className="ml-auto shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--muted-fg)]">
      just now
    </span>
  );
}

function AssignmentBody({ ev }: { ev: Extract<TimelineEvent, { kind: "assignment" }> }) {
  const from = personas[ev.from];
  const to = personas[ev.to];
  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
        <Avatar role={ev.from} size={7} />
        <ArrowRight className="h-3 w-3 text-[var(--muted-fg)]" />
        <Avatar role={ev.to} size={7} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--secondary-text)]">
          <span className="font-semibold text-foreground">{from.display}</span>
          <span>→</span>
          <span className="font-semibold text-foreground">{to.display}</span>
          <span className="text-[var(--muted-fg)]">·</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-tint)] px-1.5 py-0.5 text-[10.5px] font-semibold text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            {TOOL_LABEL[ev.data.tool] ?? ev.data.tool}
          </span>
          <RelTime />
        </div>
        <p className="mt-1 text-[13px] leading-snug text-foreground">{ev.data.message}</p>
      </div>
    </>
  );
}

function ReplyBody({ ev }: { ev: Extract<TimelineEvent, { kind: "reply" }> }) {
  const p = personas[ev.actor];
  const chip = decision_chip[ev.data.decision as Decision];
  return (
    <>
      <Avatar role={ev.actor} size={7} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--secondary-text)]">
          <span className="font-semibold text-foreground">{p.display}</span>
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
              chip.cls,
            ].join(" ")}
          >
            {chip.label}
          </span>
          <RelTime />
        </div>
        <p className="mt-1 text-[13px] leading-snug text-foreground">{ev.data.message}</p>
      </div>
    </>
  );
}

function EscalationBody({ ev }: { ev: Extract<TimelineEvent, { kind: "escalation" }> }) {
  const target = personas[ev.data.to];
  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
        <Avatar role="legal" size={7} />
        <ArrowUpRight className="h-3 w-3 text-[var(--warning)]" />
        <Avatar role={ev.data.to} size={7} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--secondary-text)]">
          <span className="font-semibold text-foreground">Sam L.</span>
          <span>escalated to</span>
          <span className="font-semibold text-foreground">{target.display}</span>
          <RelTime />
        </div>
        <p className="mt-1 text-[13px] leading-snug text-foreground">{ev.data.reason}</p>
      </div>
    </>
  );
}

function ScheduledBody({ ev }: { ev: Extract<TimelineEvent, { kind: "scheduled" }> }) {
  return (
    <>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-ai text-white">
        <Calendar className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--secondary-text)]">
          <span className="font-semibold text-foreground">ConnectAgent</span>
          <span>scheduled</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-tint)] px-1.5 py-0.5 text-[10.5px] font-semibold text-primary">
            {ev.data.topic}
          </span>
          <RelTime />
        </div>
        <p className="mt-1 text-[13px] leading-snug text-foreground">{ev.data.reason}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11.5px] text-[var(--secondary-text)]">
          <span className="text-[var(--muted-fg)]">Attendees:</span>
          {ev.data.attendees.map((a) => (
            <span
              key={a}
              className="inline-flex items-center rounded-full border border-border bg-background px-1.5 py-0.5 text-[10.5px] font-medium text-foreground"
            >
              {a}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Close section — the audit-ready outcome of running the batch                */
/* -------------------------------------------------------------------------- */

function CloseSection({
  audit,
  exported,
  onExport,
}: {
  audit: DisplayAudit[];
  exported: boolean;
  onExport: () => void;
}) {
  const meta = STAGE_META.close;
  const Icon = meta.icon;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={[
            "grid h-6 w-6 place-items-center rounded-md",
            exported ? "bg-[var(--success)] text-white" : "bg-gradient-ai text-white",
          ].join(" ")}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
            {meta.label}
          </div>
          <div className="text-[11.5px] text-[var(--secondary-text)]">
            Human-approved · audit-ready
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13.5px] font-semibold text-foreground">
            {audit.length} action{audit.length === 1 ? "" : "s"} committed
          </div>
          <button
            type="button"
            onClick={onExport}
            disabled={exported}
            className={[
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              exported
                ? "cursor-default bg-[var(--success-bg)] text-[var(--success)]"
                : "bg-[var(--success)] text-white shadow-card hover:opacity-95",
            ].join(" ")}
          >
            {exported ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exported ? "Dossier exported" : "Close & export dossier"}
          </button>
        </div>

        <ol className="mt-3 space-y-1.5">
          {audit.map((a, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg border border-[var(--success)]/25 bg-[var(--success-bg)]/50 px-3 py-2"
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--success)] text-white">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--secondary-text)]">
                  <span className="font-semibold text-foreground">{a.actor}</span>
                  <span>committed</span>
                  <span className="ml-auto shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--muted-fg)]">
                    {a.time}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] leading-snug text-foreground">{a.action}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-2.5 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-bg)] px-3 py-2 text-[12.5px] leading-snug text-foreground">
          <span className="font-semibold">Batch status:</span> {loop_ui.open_summary}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Dossier rail                                                               */
/* -------------------------------------------------------------------------- */

function Dossier({
  ran,
  exported,
  hoverRole,
  setHoverRole,
  matrixRows,
  approvedCount,
  events,
  audit,
  executedCount,
  inFlightLabel,
  onExport,
}: {
  ran: boolean;
  exported: boolean;
  hoverRole: PersonaRole | null;
  setHoverRole: (r: PersonaRole | null) => void;
  matrixRows: MatrixRow[];
  approvedCount: number;
  events: TimelineEvent[];
  audit: DisplayAudit[];
  executedCount: number;
  inFlightLabel: string;
  onExport: () => void;
}) {
  const counts = {
    assignments: ran ? events.filter((e) => e.kind === "assignment").length : 0,
    replies: ran ? events.filter((e) => e.kind === "reply").length : 0,
    escalations: ran ? events.filter((e) => e.kind === "escalation").length : 0,
    scheduled: ran ? events.filter((e) => e.kind === "scheduled").length : 0,
    sent: ran ? executedCount : 0,
  };
  void approvedCount;

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className="overflow-hidden rounded-xl border border-border bg-background shadow-card">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold text-foreground">Batch Dossier</div>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-0.5 text-[11.5px] text-[var(--secondary-text)]">
            Audit-ready record of this batch's state.
          </p>
        </div>

        {/* Counts */}
        <dl className="grid grid-cols-5 gap-px bg-border">
          {[
            { k: "Assign", v: counts.assignments },
            { k: "Replies", v: counts.replies },
            { k: "Escal.", v: counts.escalations },
            { k: "Sched.", v: counts.scheduled },
            { k: "Sent", v: counts.sent },
          ].map((c) => (
            <div key={c.k} className="bg-background px-2 py-2.5 text-center">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                {c.k}
              </dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
                {c.v}
              </dd>
            </div>
          ))}
        </dl>

        {/* Approval matrix */}
        <div className="border-t border-border px-4 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
            Approval matrix
          </div>
          <ul className="mt-2 space-y-1.5">
            {matrixRows.map((r) => {
              const p = personas[r.role];
              const highlight = hoverRole === r.role;
              const chip =
                r.status === "approved"
                  ? {
                      label: "Approved",
                      cls: "bg-[var(--success-bg)] text-[var(--success)]",
                      icon: CheckCircle2,
                    }
                  : r.status === "signed"
                    ? {
                        label: "Signed",
                        cls: "bg-[var(--success-bg)] text-[var(--success)]",
                        icon: CheckCircle2,
                      }
                    : r.status === "escalated"
                      ? {
                          label: "Escalated",
                          cls: "bg-[var(--warning-bg)] text-[var(--warning)]",
                          icon: ArrowUpRight,
                        }
                      : r.status === "in_review"
                        ? {
                            label: "In review",
                            cls: "bg-[var(--warning-bg)] text-[var(--warning)]",
                            icon: CircleDot,
                          }
                        : {
                            label: "Pending",
                            cls: "border border-border bg-[var(--canvas)] text-[var(--muted-fg)]",
                            icon: Circle,
                          };
              const Icon = chip.icon;
              return (
                <li
                  key={r.role}
                  onMouseEnter={() => setHoverRole(r.role)}
                  onMouseLeave={() => setHoverRole(null)}
                  className={[
                    "flex items-center justify-between gap-2 rounded-md px-1.5 py-1 transition-colors",
                    highlight ? "bg-[var(--primary-tint)]" : "",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar role={r.role} size={6} highlight={highlight} />
                    <span className="min-w-0 truncate text-[12.5px] text-foreground">
                      {p.display}
                      <span className="text-[var(--muted-fg)]"> · {r.title}</span>
                    </span>
                  </div>
                  <span
                    className={[
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
                      chip.cls,
                    ].join(" ")}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {chip.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Audit trail */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
              Audit trail
            </div>
            <span className="text-[10.5px] tabular-nums text-[var(--muted-fg)]">
              {audit.length} events
            </span>
          </div>
          {audit.length > 0 ? (
            <ol className="mt-2 space-y-1.5">
              {audit.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--success)]" />
                  <div className="min-w-0">
                    <div className="text-foreground">{a.action}</div>
                    <div className="text-[10.5px] text-[var(--muted-fg)]">
                      {a.actor} · {a.time}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[12px] leading-snug text-[var(--muted-fg)]">
              Not started — runs when you approve the batch.
            </p>
          )}
        </div>

        {/* Status */}
        <div className="border-t border-border bg-[var(--canvas)] px-4 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
            Status
          </div>
          <div className="mt-1 flex items-start gap-1.5 text-[12.5px] leading-snug text-foreground">
            {exported ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
            ) : !ran ? (
              <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted-fg)]" />
            ) : (
              <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
            )}
            <span>
              <span className="font-semibold">
                {!ran
                  ? "Not started"
                  : exported
                    ? `Batch run complete · ${inFlightLabel}`
                    : "Ran — open items"}
              </span>
              <span className="text-[var(--secondary-text)]">
                {ran ? ` · ${loop_ui.open_summary}` : ""}
              </span>
            </span>
          </div>
          <button
            type="button"
            disabled={!ran || exported}
            onClick={onExport}
            className={[
              "mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-[12.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              ran && !exported
                ? "border-border bg-background text-foreground hover:bg-[var(--primary-tint)] hover:text-primary"
                : "cursor-not-allowed border-border bg-background text-[var(--muted-fg)]",
            ].join(" ")}
            title={ran ? "Export the batch dossier" : "Exports after the batch runs"}
          >
            {exported ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Dossier exported
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export dossier
              </>
            )}
          </button>
        </div>

        {/* Provenance */}
        <div className="border-t border-border px-4 py-3">
          <Link
            to="/packet"
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-primary transition-colors hover:underline"
          >
            <GitBranch className="h-3 w-3" />
            From Decision Packet — Acme renewal
          </Link>
        </div>
      </div>
    </aside>
  );
}

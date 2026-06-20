import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
  type LoopAuditEvent,
  type LoopState,
  type PersonaRole,
  type Reply,
  type Scheduled,
} from "@/data/loop";
import { useLoopQuery } from "@/hooks/queries";

export const Route = createFileRoute("/loop")({
  head: () => ({
    meta: [
      { title: "Work Loop — Acme renewal" },
      {
        name: "description",
        content:
          "Watch the Command Agent orchestrate multi-party follow-up work: distribute, collect, escalate, schedule, and close with a human-approved audit trail.",
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

const STAGE_STEP_MS = 2000;

const TOOL_LABEL: Record<string, string> = {
  route_approval: "route approval",
  create_task: "create task",
  schedule_meeting: "schedule meeting",
  draft_internal_note: "draft internal note",
  update_project_status: "update project status",
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

type Status = "proposed" | "running" | "closing" | "closed";

const PLAN_ITEMS: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  conditional?: boolean;
}[] = [
  { icon: Send, text: "Send pricing-exception review to Credit Officer" },
  { icon: Send, text: "Send covenant-approval request to Legal" },
  { icon: ListChecks, text: "Create task for the covenant tracker" },
  {
    icon: ArrowUpRight,
    text: "Escalate to Compliance if Legal's authority is exceeded",
    conditional: true,
  },
  { icon: Calendar, text: "Schedule the committee decision once blockers clear" },
];

const ROLE_TITLE: Partial<Record<PersonaRole, string>> = {
  relationship_manager: "Relationship Manager",
  credit_officer: "Credit Officer",
  legal: "Legal",
  compliance: "Compliance Officer",
};

type MatrixStatus = "pending" | "approved" | "signed" | "escalated" | "in_review";
type MatrixRow = { role: PersonaRole; title: string; status: MatrixStatus };

function WorkLoop() {
  // Canonical dossier from the data layer (bundled mock by default; live `GET /api/loop` when
  // VITE_USE_MOCKS=false + VITE_API_URL). The staged reveal below is a local UI animation over it.
  const { data: loop_state } = useLoopQuery();
  const events = useMemo(() => buildEvents(loop_state), [loop_state]);
  // Derived from escalations (NOT from `closed`) — see contract note in data/loop.ts.
  const inFlight = escalationsInFlightLabel(loop_state);

  const [status, setStatus] = useState<Status>("proposed");
  const [revealed, setRevealed] = useState(0); // count of EVENTS shown
  const [approved, setApproved] = useState(false);
  const [closed, setClosed] = useState(false);
  const [hoverRole, setHoverRole] = useState<PersonaRole | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => () => clear(), [clear]);

  const reset = useCallback(() => {
    clear();
    setRevealed(0);
    setApproved(false);
    setClosed(false);
    setStatus("proposed");
  }, [clear]);

  const approveAndStart = useCallback(() => {
    clear();
    setRevealed(0);
    setApproved(true);
    setClosed(false);
    setStatus("running");

    let i = 0;
    const tick = () => {
      i += 1;
      setRevealed(i);
      if (i < events.length) {
        timer.current = setTimeout(tick, STAGE_STEP_MS);
      } else {
        timer.current = setTimeout(() => setStatus("closing"), 500);
      }
    };
    timer.current = setTimeout(tick, 250);
  }, [clear, events]);

  const closeAndExport = useCallback(() => {
    setClosed(true);
    setStatus("closed");
    toast.success("Dossier exported", {
      description: "Audit-ready record of this loop saved.",
    });
  }, []);

  // Active stage tracking
  const activeStage = useMemo<StageKey>(() => {
    if (status === "proposed") return "plan";
    if (status === "closing" || status === "closed") return "close";
    if (revealed === 0) return "distribute";
    const last = events[Math.min(revealed, events.length) - 1];
    return last.stage;
  }, [revealed, status, events]);

  const doneStages = useMemo<Set<StageKey>>(() => {
    const done = new Set<StageKey>();
    // Plan is done as soon as the user approves and we leave the proposed state.
    if (status !== "proposed") done.add("plan");
    if (revealed >= events.length && (status === "closing" || status === "closed")) {
      (["distribute", "collect", "escalate", "schedule"] as StageKey[]).forEach((k) => done.add(k));
    } else if (status === "running") {
      for (const s of ["distribute", "collect", "escalate", "schedule"] as StageKey[]) {
        let lastIdx = -1;
        events.forEach((ev, i) => {
          if (ev.stage === s) lastIdx = i;
        });
        if (revealed > lastIdx + 1) done.add(s);
      }
    }
    if (status === "closed") done.add("close");
    return done;
  }, [revealed, status, events]);

  const statusPill = (() => {
    if (status === "proposed")
      return {
        label: "Proposed — awaiting approval",
        cls: "bg-[var(--warning-bg)] text-[var(--warning)]",
      };
    if (status === "running")
      return { label: "Running", cls: "bg-[var(--primary-tint)] text-primary" };
    if (status === "closed")
      return {
        label: `Closed · ${inFlight}`,
        cls: "bg-[var(--success-bg)] text-[var(--success)]",
      };
    // closing
    return {
      label: "Open — 1 item",
      cls: "bg-[var(--warning-bg)] text-[var(--warning)]",
    };
  })();

  const visibleEvents = events.slice(0, revealed);
  const grouped = useMemo(() => {
    const g: Record<StageKey, TimelineEvent[]> = {
      plan: [],
      distribute: [],
      collect: [],
      escalate: [],
      schedule: [],
      close: [],
    };
    visibleEvents.forEach((e) => g[e.stage].push(e));
    return g;
  }, [visibleEvents]);

  const auditVisible: LoopAuditEvent[] = closed ? loop_state.audit : [];

  const creditReplied = visibleEvents.some(
    (e) => e.kind === "reply" && e.actor === "credit_officer",
  );
  const legalReplied = visibleEvents.some((e) => e.kind === "reply" && e.actor === "legal");
  const escalationFired = visibleEvents.some((e) => e.kind === "escalation");

  const matrixRows: MatrixRow[] = [
    {
      role: "relationship_manager",
      title: ROLE_TITLE.relationship_manager!,
      status: approved ? "approved" : "pending",
    },
    {
      role: "credit_officer",
      title: ROLE_TITLE.credit_officer!,
      status: creditReplied ? "signed" : "pending",
    },
    {
      role: "legal",
      title: ROLE_TITLE.legal!,
      status: legalReplied ? "escalated" : "pending",
    },
  ];
  if (escalationFired) {
    matrixRows.push({
      role: "compliance",
      title: ROLE_TITLE.compliance!,
      status: "in_review",
    });
  }
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
                Work Loop
              </div>
              <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-tight text-foreground">
                Work Loop — Acme renewal
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
                  {status === "running" ? (
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-current" />
                  ) : status === "closing" ? (
                    <CircleDot className="h-3 w-3" />
                  ) : status === "closed" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Circle className="h-3 w-3" />
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
              {status === "proposed" && (
                <button
                  type="button"
                  onClick={approveAndStart}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-ai px-3.5 text-[13px] font-semibold text-white shadow-card transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Approve plan &amp; start
                </button>
              )}
              {status === "running" && (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--primary-tint)] px-3.5 text-[13px] font-semibold text-primary">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-current" />
                  Running…
                </span>
              )}
              {status === "closed" && (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--success-bg)] px-3.5 text-[13px] font-semibold text-[var(--success)]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Loop closed
                </span>
              )}
            </div>
          </div>

          {/* Stage spine */}
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
                      {isActive && (
                        <span className="ml-auto h-1.5 w-1.5 animate-pulse-dot rounded-full bg-white/80" />
                      )}
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
          {/* Timeline */}
          <main className="min-w-0">
            {status === "proposed" ? (
              <ProposedPlan onApprove={approveAndStart} />
            ) : (
              <div className="space-y-7">
                {(["distribute", "collect", "escalate", "schedule"] as StageKey[]).map(
                  (sk) =>
                    grouped[sk].length > 0 && (
                      <StageBlock
                        key={sk}
                        stage={sk}
                        events={grouped[sk]}
                        active={activeStage === sk && !doneStages.has(sk)}
                        hoverRole={hoverRole}
                        setHoverRole={setHoverRole}
                      />
                    ),
                )}

                {(status === "closing" || status === "closed") && (
                  <CloseStage
                    closed={closed}
                    onClose={closeAndExport}
                    audit={auditVisible}
                    hoverRole={hoverRole}
                    setHoverRole={setHoverRole}
                  />
                )}
              </div>
            )}
          </main>

          {/* Dossier rail */}
          <Dossier
            revealed={revealed}
            approved={approved}
            closed={closed}
            status={status}
            hoverRole={hoverRole}
            setHoverRole={setHoverRole}
            matrixRows={matrixRows}
            approvedCount={approvedCount}
            events={events}
            audit={loop_state.audit}
            inFlightLabel={inFlight}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

function ProposedPlan({ onApprove }: { onApprove: () => void }) {
  return (
    <section className="animate-loop-in">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-ai text-white">
          <ListChecks className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
            Plan
          </div>
          <div className="text-[11.5px] text-[var(--secondary-text)]">
            Agent's proposed loop · nothing executes until you approve
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Proposed plan
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--secondary-text)]">
              The Command Agent will perform these {PLAN_ITEMS.length} steps in sequence. No
              messages are sent and no tasks are created until you approve.
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-[var(--muted-fg)]">
              Derived from the{" "}
              <Link to="/packet" className="font-medium text-primary hover:underline">
                Decision Packet's
              </Link>{" "}
              recommended next-steps — generated from the meeting transcript and linked content.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--warning)]">
            <ShieldCheck className="h-3 w-3" />
            Awaiting approval
          </span>
        </div>

        <ol className="mt-4 space-y-2">
          {PLAN_ITEMS.map((it, i) => {
            const Icon = it.icon;
            const isConditional = it.conditional;
            return (
              <li
                key={i}
                className={[
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5",
                  isConditional
                    ? "border-dashed border-border/70 bg-card/60"
                    : "border-border bg-card",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                    isConditional
                      ? "bg-[var(--canvas)] text-[var(--muted-fg)]"
                      : "bg-[var(--primary-tint)] text-primary",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                <Icon
                  className={[
                    "mt-0.5 h-4 w-4 shrink-0",
                    isConditional ? "text-[var(--muted-fg)]/70" : "text-[var(--muted-fg)]",
                  ].join(" ")}
                />
                <span
                  className={[
                    "flex-1 text-[13px] leading-snug",
                    isConditional ? "text-[var(--secondary-text)]" : "text-foreground",
                  ].join(" ")}
                >
                  {it.text}
                </span>
                {isConditional && (
                  <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[var(--warning)]/40 bg-[var(--warning-bg)]/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--warning)]">
                    Conditional
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-[11.5px] leading-snug text-[var(--muted-fg)]">
            Approving will commit only the listed steps; blockers remain blocked.
          </p>
          <button
            type="button"
            onClick={onApprove}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-ai px-4 text-[13px] font-semibold text-white shadow-card transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Approve plan &amp; start
          </button>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Stage block                                                                */
/* -------------------------------------------------------------------------- */

const STAGE_META: Record<
  StageKey,
  { label: string; sub: string; icon: React.ComponentType<{ className?: string }> }
> = {
  plan: {
    label: "Plan",
    sub: "Agent's proposed loop",
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
  active,
  hoverRole,
  setHoverRole,
}: {
  stage: StageKey;
  events: TimelineEvent[];
  active: boolean;
  hoverRole: PersonaRole | null;
  setHoverRole: (r: PersonaRole | null) => void;
}) {
  const meta = STAGE_META[stage];
  const Icon = meta.icon;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={[
            "grid h-6 w-6 place-items-center rounded-md",
            active
              ? "bg-gradient-ai text-white"
              : "bg-[var(--canvas)] text-[var(--secondary-text)]",
          ].join(" ")}
        >
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
          "flex items-start gap-3 rounded-lg border bg-card px-3.5 py-2.5 shadow-card transition-colors animate-sparkle-border",
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
          <span className="font-semibold text-foreground">Command Agent</span>
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
/* Close stage                                                                */
/* -------------------------------------------------------------------------- */

function CloseStage({
  closed,
  onClose,
  audit,
  hoverRole,
  setHoverRole,
}: {
  closed: boolean;
  onClose: () => void;
  audit: LoopAuditEvent[];
  hoverRole: PersonaRole | null;
  setHoverRole: (r: PersonaRole | null) => void;
}) {
  const meta = STAGE_META.close;
  const Icon = meta.icon;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={[
            "grid h-6 w-6 place-items-center rounded-md",
            closed ? "bg-[var(--success)] text-white" : "bg-gradient-ai text-white",
          ].join(" ")}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
            {meta.label}
          </div>
          <div className="text-[11.5px] text-[var(--secondary-text)]">
            {closed ? "Audit-ready record below" : "Finalize the approved loop"}
          </div>
        </div>
      </div>

      {!closed ? (
        <div className="animate-loop-in rounded-xl border border-border bg-background p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-foreground">Ready to close</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--secondary-text)]">
                3 assignments completed · 1 issue escalated to Compliance · final committee
                scheduled · covenant tracker still pending.
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-[var(--muted-fg)]">
                Finalize and export the dossier. Every write here was already part of the approved
                plan — no new permissions requested.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--success)] px-3.5 text-[13px] font-semibold text-white shadow-card transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--success)] focus-visible:ring-offset-2"
            >
              <Download className="h-3.5 w-3.5" />
              Close loop &amp; export dossier
            </button>
          </div>
        </div>
      ) : (
        <ol className="relative space-y-2.5 border-l border-dashed border-border pl-5">
          {audit.map((a, i) => (
            <li
              key={i}
              className="relative animate-loop-in"
              onMouseEnter={() => setHoverRole("relationship_manager")}
              onMouseLeave={() => setHoverRole(null)}
            >
              <span
                className={[
                  "absolute -left-[26px] top-3 h-2 w-2 rounded-full",
                  hoverRole === "relationship_manager" ? "bg-primary" : "bg-[var(--success)]",
                ].join(" ")}
                aria-hidden
              />
              <div className="flex items-start gap-3 rounded-lg border border-[var(--success)]/25 bg-[var(--success-bg)]/60 px-3.5 py-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--success)] text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--secondary-text)]">
                    <span className="font-semibold text-foreground">{a.actor}</span>
                    <span>executed</span>
                    <span className="ml-auto shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--muted-fg)]">
                      {a.timestamp}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-foreground">{a.action}</p>
                </div>
              </div>
            </li>
          ))}
          <li className="relative animate-loop-in">
            <span
              className="absolute -left-[26px] top-3 h-2 w-2 rounded-full bg-[var(--warning)]"
              aria-hidden
            />
            <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-bg)] px-3.5 py-2.5 text-[12.5px] leading-snug text-foreground">
              <span className="font-semibold">Loop status:</span> {loop_ui.open_summary}
            </div>
          </li>
        </ol>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Dossier rail                                                               */
/* -------------------------------------------------------------------------- */

function Dossier({
  revealed,
  approved,
  closed,
  status,
  hoverRole,
  setHoverRole,
  matrixRows,
  approvedCount,
  events,
  audit,
  inFlightLabel,
}: {
  revealed: number;
  approved: boolean;
  closed: boolean;
  status: Status;
  hoverRole: PersonaRole | null;
  setHoverRole: (r: PersonaRole | null) => void;
  matrixRows: MatrixRow[];
  approvedCount: number;
  events: TimelineEvent[];
  audit: LoopAuditEvent[];
  inFlightLabel: string;
}) {
  // Counts mirror what's been revealed.
  const seen = events.slice(0, revealed);
  const counts = {
    assignments: seen.filter((e) => e.kind === "assignment").length,
    replies: seen.filter((e) => e.kind === "reply").length,
    escalations: seen.filter((e) => e.kind === "escalation").length,
    scheduled: seen.filter((e) => e.kind === "scheduled").length,
    approved: approvedCount,
  };

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className="overflow-hidden rounded-xl border border-border bg-background shadow-card">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold text-foreground">Loop Dossier</div>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-0.5 text-[11.5px] text-[var(--secondary-text)]">
            Audit-ready record of this loop's state.
          </p>
        </div>

        {/* Counts */}
        <dl className="grid grid-cols-5 gap-px bg-border">
          {[
            { k: "Assign", v: counts.assignments },
            { k: "Replies", v: counts.replies },
            { k: "Escal.", v: counts.escalations },
            { k: "Sched.", v: counts.scheduled },
            { k: "Apprv.", v: counts.approved },
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
                    "flex items-center justify-between gap-2 rounded-md px-1.5 py-1 transition-colors animate-loop-in",
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
              {closed ? audit.length : 0} events
            </span>
          </div>
          {closed ? (
            <ol className="mt-2 space-y-1.5">
              {audit.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px]">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--success)]" />
                  <div className="min-w-0">
                    <div className="text-foreground">{a.action}</div>
                    <div className="text-[10.5px] text-[var(--muted-fg)]">
                      {a.actor} · {a.timestamp}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[12px] leading-snug text-[var(--muted-fg)]">
              {status === "proposed"
                ? "Not started — runs after approval."
                : "Commits appear at Close."}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="border-t border-border bg-[var(--canvas)] px-4 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
            Closed
          </div>
          <div className="mt-1 flex items-start gap-1.5 text-[12.5px] leading-snug text-foreground">
            {closed ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
            ) : status === "proposed" ? (
              <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted-fg)]" />
            ) : (
              <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
            )}
            <span>
              <span className="font-semibold">
                {closed
                  ? `Closed · ${inFlightLabel}`
                  : status === "proposed"
                    ? "Not started"
                    : "Open — 1 item"}
              </span>
              <span className="text-[var(--secondary-text)]">
                {status === "proposed" ? "" : ` · ${loop_ui.open_summary}`}
              </span>
            </span>
          </div>
          <button
            type="button"
            disabled={!closed}
            className={[
              "mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-[12.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              closed
                ? "border-border bg-background text-foreground hover:bg-[var(--primary-tint)] hover:text-primary"
                : "cursor-not-allowed border-border bg-background text-[var(--muted-fg)]",
            ].join(" ")}
            title={closed ? "Loop dossier exported" : "Exports when loop is closed"}
          >
            {closed ? (
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Circle,
  FileText,
  GitCompareArrows,
  Info,
  Lock,
  MessageSquare,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  X,
  XCircle,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChatThread, type Turn } from "@/components/agent/ChatThread";
import { TopBar } from "@/components/meeting/TopBar";
import {
  decision_brief as briefTemplate,
  type DecisionReadiness,
  type DecisionReadinessRow,
  type SourceStatus,
  type SourceType,
} from "@/data/brief";
import { openDrawer } from "@/lib/actions-store";
import { useGovernedBrief } from "@/lib/revalidation-store";
import { type Action } from "@/data/actions";
import {
  useActionPlanQuery,
  useChatMutation,
  useMintWorkProductMutation,
  resolveReadinessAction,
} from "@/hooks/queries";

const searchSchema = z.object({
  focus: z.enum(["next-steps"]).optional(),
});

export const Route = createFileRoute("/packet")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Decision Packet — Acme renewal" },
      {
        name: "description",
        content:
          "Governed decision packet for the Acme renewal pricing exception and covenant modification — approvals, gates, evidence, and full source provenance.",
      },
    ],
  }),
  component: PacketWorkspace,
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
      {children}
    </div>
  );
}

const SOURCE_ICON: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  meeting: Users,
  chat: MessageSquare,
  document: FileText,
  workflow: Workflow,
  task: CheckSquare,
};

const STATUS_CHIP: Record<
  SourceStatus,
  { label: string; classes: string; icon?: React.ComponentType<{ className?: string }> }
> = {
  used: {
    label: "Used",
    classes: "bg-[var(--canvas)] text-[var(--secondary-text)] border border-border",
  },
  restricted: {
    label: "Restricted · not used",
    classes: "bg-[var(--danger-bg)] text-[var(--danger)]",
    icon: Lock,
  },
  conflicting: {
    label: "Conflicting",
    classes: "bg-[var(--warning-bg)] text-[var(--warning)]",
    icon: AlertTriangle,
  },
  missing: {
    label: "Missing",
    classes: "bg-[var(--warning-bg)] text-[var(--warning)]",
    icon: AlertTriangle,
  },
};

/* -------------------------------------------------------------------------- */
/* Source chip — superscript reference to a rail row                          */
/* -------------------------------------------------------------------------- */

function SourceChip({
  ids,
  hoveredId,
  setHoveredId,
}: {
  ids: string[];
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
}) {
  const primary = ids[0];
  const active = hoveredId && ids.includes(hoveredId);
  return (
    <button
      type="button"
      onMouseEnter={() => setHoveredId(primary)}
      onMouseLeave={() => setHoveredId(null)}
      onFocus={() => setHoveredId(primary)}
      onBlur={() => setHoveredId(null)}
      onClick={() => {
        document
          .getElementById(`src-${primary}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      className={[
        "ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-[5px] px-1 align-[2px] text-[10px] font-semibold transition-colors",
        active
          ? "bg-primary text-white"
          : "bg-[var(--primary-tint)] text-primary hover:bg-primary hover:text-white",
      ].join(" ")}
      aria-label={`Source reference`}
    >
      {ids.length}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Deterministic explainers — show the computed numbers behind a gate, so a    */
/* skeptic sees "computed, not asserted". Live reads the new CalculationCheck / */
/* RuleFiring fields; mock carries the same canonical values (both-mode).       */
/* -------------------------------------------------------------------------- */

type CalcCheck = {
  name: string;
  expected: number;
  computed: number;
  matches: boolean;
  inputs?: Record<string, number>;
  formula?: string;
  tolerance?: number;
};

const CALC_LABELS: Record<string, string> = {
  dscr: "Debt service coverage ratio",
};

function calcLabel(name: string) {
  return CALC_LABELS[name] ?? name;
}

const EXPLAIN_TRIGGER_CLS =
  "ml-1 mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--secondary-text)] transition-colors hover:bg-[var(--canvas)] hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const POPOVER_CLS = "w-80 border-border bg-background text-foreground shadow-panel";

function fmtMoney(n: number) {
  return n >= 1000 ? `$${n.toLocaleString()}` : String(n);
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function RulepackFooter({ id, version }: { id: string; version: number }) {
  return (
    <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2 text-[10.5px] leading-snug text-[var(--muted-fg)]">
      <ShieldCheck className="h-3 w-3 shrink-0 text-primary" />
      <span>
        Decided by RulePack <span className="font-mono text-foreground">{id}</span> · v{version} —
        not the model
      </span>
    </div>
  );
}

function CalcExplainer({
  calc,
  rulepackId,
  rulepackVersion,
}: {
  calc: CalcCheck;
  rulepackId: string;
  rulepackVersion: number;
}) {
  return (
    <Popover>
      <PopoverTrigger className={EXPLAIN_TRIGGER_CLS}>
        <Info className="h-3 w-3" />
        Explain
      </PopoverTrigger>
      <PopoverContent align="end" className={POPOVER_CLS}>
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
          <Calculator className="h-3.5 w-3.5 text-primary" />
          {calcLabel(calc.name)}
        </div>
        {calc.inputs && (
          <dl className="mt-2.5 space-y-1 text-[12px]">
            {Object.entries(calc.inputs).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <dt className="capitalize text-[var(--muted-fg)]">{k.replace(/_/g, " ")}</dt>
                <dd className="font-mono text-foreground">{fmtMoney(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        {calc.formula && (
          <div className="mt-2.5 rounded-md border border-border bg-[var(--canvas)] px-2.5 py-1.5 font-mono text-[11.5px] text-foreground">
            {calc.formula} = {calc.computed.toFixed(2)}
          </div>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-2 text-[12px]">
          <span className="text-[var(--muted-fg)]">
            computed {calc.computed.toFixed(2)} vs model {calc.expected.toFixed(2)}
            {typeof calc.tolerance === "number" ? ` (±${calc.tolerance})` : ""}
          </span>
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
              calc.matches
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : "bg-[var(--danger-bg)] text-[var(--danger)]",
            ].join(" ")}
          >
            <CheckCircle2 className="h-3 w-3" />
            {calc.matches ? "Match" : "Mismatch"}
          </span>
        </div>
        <RulepackFooter id={rulepackId} version={rulepackVersion} />
      </PopoverContent>
    </Popover>
  );
}

function ThresholdExplainer({
  threshold,
  rulepackId,
  rulepackVersion,
}: {
  threshold: { requested_discount: number; delegated_authority: number };
  rulepackId: string;
  rulepackVersion: number;
}) {
  const exceeds = threshold.requested_discount > threshold.delegated_authority;
  return (
    <Popover>
      <PopoverTrigger className={EXPLAIN_TRIGGER_CLS}>
        <Info className="h-3 w-3" />
        Explain
      </PopoverTrigger>
      <PopoverContent align="end" className={POPOVER_CLS}>
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
          <Scale className="h-3.5 w-3.5 text-primary" />
          Delegated-authority threshold
        </div>
        <dl className="mt-2.5 space-y-1 text-[12px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--muted-fg)]">requested discount</dt>
            <dd className="font-mono text-foreground">{pct(threshold.requested_discount)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--muted-fg)]">delegated authority</dt>
            <dd className="font-mono text-foreground">{pct(threshold.delegated_authority)}</dd>
          </div>
        </dl>
        <div className="mt-2.5 rounded-md border border-border bg-[var(--canvas)] px-2.5 py-1.5 font-mono text-[11.5px] text-foreground">
          {pct(threshold.requested_discount)} {exceeds ? ">" : "≤"}{" "}
          {pct(threshold.delegated_authority)} → {exceeds ? "exceeds" : "within"}
        </div>
        <div className="mt-2.5 flex justify-end">
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
              exceeds
                ? "bg-[var(--danger-bg)] text-[var(--danger)]"
                : "bg-[var(--success-bg)] text-[var(--success)]",
            ].join(" ")}
          >
            {exceeds ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            {exceeds ? "Fail" : "Pass"}
          </span>
        </div>
        <RulepackFooter id={rulepackId} version={rulepackVersion} />
      </PopoverContent>
    </Popover>
  );
}

const READINESS_STATUS: Record<
  DecisionReadinessRow["status"],
  { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }
> = {
  blocking: {
    label: "Blocking",
    cls: "bg-[var(--danger-bg)] text-[var(--danger)]",
    icon: XCircle,
  },
  pending: {
    label: "Pending",
    cls: "bg-[var(--warning-bg)] text-[var(--warning)]",
    icon: AlertTriangle,
  },
  passed: {
    label: "Passed",
    cls: "bg-[var(--success-bg)] text-[var(--success)]",
    icon: CheckCircle2,
  },
  approved: {
    label: "Approved",
    cls: "bg-[var(--success-bg)] text-[var(--success)]",
    icon: CheckCircle2,
  },
};

const READINESS_GRID =
  "grid-cols-[minmax(170px,1fr)_128px_minmax(220px,1.5fr)_minmax(180px,0.9fr)]";

function findThreshold(
  brief: typeof briefTemplate,
  ruleId: string,
): { requested_discount: number; delegated_authority: number } | null {
  const firing = brief.policy_gates.firings.find((f) => f.rule_id === ruleId);
  if (!firing || !("threshold" in firing) || !firing.threshold) return null;
  return firing.threshold as { requested_discount: number; delegated_authority: number };
}

function findCalculation(calcs: CalcCheck[], name: string): CalcCheck | null {
  return (
    calcs.find((c) => c.name === name || c.name.toLowerCase() === name.toLowerCase()) ??
    calcs.find((c) => calcLabel(c.name).toLowerCase() === calcLabel(name).toLowerCase()) ??
    null
  );
}

function DecisionReadinessTable({
  readiness,
  brief,
  planActions,
  hoveredId,
  setHoveredId,
  rulepackId,
  rulepackVersion,
}: {
  readiness: DecisionReadiness;
  brief: typeof briefTemplate;
  planActions: Action[];
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  rulepackId: string;
  rulepackVersion: number;
}) {
  return (
    <section id="decision-readiness" className="scroll-mt-20">
      <SectionLabel>Decision readiness</SectionLabel>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--secondary-text)]">
        {readiness.summary}
      </p>
      <div className="mt-3 overflow-hidden rounded-lg border border-border">
        <div className="w-full">
          <div
            className={[
              "grid gap-4 border-b border-border bg-[var(--canvas)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-fg)]",
              READINESS_GRID,
            ].join(" ")}
          >
            <div>Gate</div>
            <div>Status</div>
            <div>Details</div>
            <div className="text-right">Action</div>
          </div>
          <div className="divide-y divide-border bg-background">
            {readiness.rows.map((row) => {
              const meta = READINESS_STATUS[row.status];
              const StatusIcon = meta.icon;
              const focusKey = resolveReadinessAction(row.action, planActions);
              const threshold =
                row.explainer?.kind === "threshold"
                  ? findThreshold(brief, row.explainer.rule_id)
                  : null;
              const calc =
                row.explainer?.kind === "calculation"
                  ? findCalculation(brief.policy_gates.calculations, row.explainer.calculation_name)
                  : null;
              return (
                <div
                  key={row.id}
                  className={["grid items-center gap-4 px-4 py-3", READINESS_GRID].join(" ")}
                >
                  <div className="text-[13.5px] font-semibold text-foreground">{row.gate}</div>
                  <div>
                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                        meta.cls,
                      ].join(" ")}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-start gap-1.5 text-[13.5px] leading-snug text-[var(--secondary-text)]">
                    <span className="min-w-0">
                      {row.details}
                      {row.source_ids.length > 0 && (
                        <SourceChip
                          ids={row.source_ids}
                          hoveredId={hoveredId}
                          setHoveredId={setHoveredId}
                        />
                      )}
                    </span>
                    {threshold && (
                      <ThresholdExplainer
                        threshold={threshold}
                        rulepackId={rulepackId}
                        rulepackVersion={rulepackVersion}
                      />
                    )}
                    {calc && (
                      <CalcExplainer
                        calc={calc}
                        rulepackId={rulepackId}
                        rulepackVersion={rulepackVersion}
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 justify-end">
                    {row.action ? (
                      <button
                        type="button"
                        onClick={() =>
                          openDrawer({
                            focus_key: focusKey,
                            source: `Decision readiness — ${row.gate}`,
                          })
                        }
                        className="inline-flex h-8 max-w-full min-w-0 items-center justify-center gap-1.5 rounded-md border border-primary/35 bg-[var(--primary-tint)] px-2.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="truncate">{row.action.label}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </button>
                    ) : (
                      <span className="text-[12.5px] text-[var(--muted-fg)]">None</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

function PacketWorkspace() {
  const { focus } = Route.useSearch();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const readinessRef = useRef<HTMLElement | null>(null);

  const {
    decision_brief,
    decision_readiness,
    sources,
    source_count,
    rulepack_id,
    rulepack_version,
    workflow_status,
    banner_subtitle,
    path_to_ready,
  } = useGovernedBrief();
  const { actions: planActions } = useActionPlanQuery().data;
  const mint = useMintWorkProductMutation();
  const b = decision_brief;

  // "Ask about this packet" reuses the governed /chat answerer (permission refusal, gate-hold,
  // missing-evidence honesty, validated citations) — same Acme scope as the meeting panel.
  const chat = useChatMutation();
  const [askInput, setAskInput] = useState("");
  const [messages, setMessages] = useState<Turn[]>([]);
  function sendAsk(text: string) {
    const t = text.trim();
    if (!t || chat.isPending) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: t }]);
    setAskInput("");
    chat.mutate(
      { message: t, history },
      {
        onSuccess: (data) =>
          setMessages((m) => [...m, { role: "assistant", content: data.reply, meta: data }]),
        onError: () => {
          toast.error("Couldn't reach the agent", {
            description: "Run the gateway with `make api` to ask governed questions.",
          });
          setMessages((m) => m.slice(0, -1));
        },
      },
    );
  }

  const sourceSummary = useMemo(() => {
    const counts = { used: 0, restricted: 0, conflicting: 0, missing: 0 };
    sources.forEach((s) => {
      counts[s.status] += 1;
    });
    return counts;
  }, [sources]);

  useEffect(() => {
    if (focus === "next-steps" && readinessRef.current) {
      // Small delay so layout settles before scroll.
      const t = setTimeout(() => {
        readinessRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [focus]);

  const rightSlot = (
    <>
      <button
        type="button"
        onClick={() =>
          openDrawer({
            mode: "plan",
            source: "Decision Packet — Acme renewal",
          })
        }
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Agent Actions
      </button>
      <button
        type="button"
        disabled={mint.isPending}
        onClick={() => {
          mint.mutate(
            { work_product_id: "wp_acme_committee_packet" },
            {
              onSuccess: (data) => {
                toast.success("Sealed as governed record", {
                  description: "Opening the governance certificate…",
                });
                window.open(`/record/${data.record_id}`, "_blank", "noopener");
              },
              onError: () => toast.error("Could not seal record"),
            },
          );
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12.5px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {mint.isPending ? "Sealing…" : "Seal as governed record"}
      </button>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)] text-foreground">
      <TopBar showBackToMeeting rightSlot={rightSlot} />

      {/* Packet header */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto max-w-[1320px] px-6 pt-6 pb-5 xl:px-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-tint)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-primary">
                <Sparkles className="h-3 w-3" />
                Decision Packet
              </div>
              <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-tight text-foreground">
                Decision Packet — Acme renewal
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[var(--secondary-text)]">
                <span>Generated 2 min ago</span>
                <span className="text-[var(--muted-fg)]">·</span>
                <span>
                  Confidence:{" "}
                  <span className="font-medium capitalize text-foreground">{b.confidence}</span>
                </span>
                <span className="text-[var(--muted-fg)]">·</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  Permissions-aware
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
                  <FileText className="h-3 w-3" />
                  {source_count} sources
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  Rulepack <span className="font-mono">{rulepack_id}</span> · v{rulepack_version}
                </span>
                {pinned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--success)]">
                    <Pin className="h-3 w-3" />
                    Pinned · by {by} · {pinnedAgo}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status banner */}
          <div className="mt-5 overflow-hidden rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-bg)]">
            <div className="grid gap-5 px-5 py-4 md:grid-cols-[1fr_minmax(280px,360px)]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--danger)]/15 text-[var(--danger)]">
                    <XCircle className="h-4 w-4" />
                  </span>
                  <div className="text-[18px] font-semibold tracking-tight text-[var(--danger)]">
                    Approval-ready: No
                  </div>
                </div>
                <p className="mt-1.5 pl-8 text-[13px] leading-snug text-foreground">
                  {banner_subtitle}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--danger)]/20 bg-background/70 p-3">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
                  Path to ready
                </div>
                <ul className="mt-2 space-y-1.5">
                  {path_to_ready.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center gap-2 text-[12.5px] text-foreground"
                    >
                      {item.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-[var(--muted-fg)]" />
                      )}
                      <span
                        className={
                          item.done
                            ? "text-[var(--secondary-text)] line-through decoration-[var(--muted-fg)]"
                            : ""
                        }
                      >
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
                {workflow_status && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--primary-tint)] px-2 py-0.5 text-[10.5px] font-semibold text-primary">
                    <Workflow className="h-3 w-3" />
                    Workflow: {workflow_status}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-[1320px] px-6 py-8 xl:px-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main column */}
          <article className="min-w-0 rounded-xl border border-border bg-background p-7 shadow-card">
            <div className="space-y-9">
              {/* Decision needed */}
              <section>
                <SectionLabel>Decision needed</SectionLabel>
                <p className="mt-2 text-[16px] font-medium leading-snug text-foreground">
                  {b.decision_needed}
                </p>
              </section>

              {/* Executive summary */}
              <section>
                <SectionLabel>Executive summary</SectionLabel>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--secondary-text)]">
                  {b.executive_summary}
                  <SourceChip
                    ids={["doc_credit_memo", "doc_financials"]}
                    hoveredId={hoveredId}
                    setHoveredId={setHoveredId}
                  />
                </p>
              </section>

              {/* What changed */}
              <section>
                <SectionLabel>What changed since last review</SectionLabel>
                <ul className="mt-2 space-y-2">
                  {b.what_changed.map((c, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-[14px] leading-relaxed text-foreground"
                    >
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-fg)]" />
                      <span>
                        {c}
                        <SourceChip
                          ids={[
                            i === 0
                              ? "doc_financials"
                              : i === 1
                                ? "wf_approval"
                                : "task_upload_tracker",
                          ]}
                          hoveredId={hoveredId}
                          setHoveredId={setHoveredId}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <div ref={readinessRef}>
                <DecisionReadinessTable
                  readiness={decision_readiness}
                  brief={b}
                  planActions={planActions}
                  hoveredId={hoveredId}
                  setHoveredId={setHoveredId}
                  rulepackId={rulepack_id}
                  rulepackVersion={rulepack_version}
                />
              </div>

              {/* Conflicting evidence */}
              <section>
                <SectionLabel>Conflicting evidence</SectionLabel>
                <div className="mt-2.5 space-y-2">
                  {b.conflicts.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-bg)] px-4 py-3"
                    >
                      <GitCompareArrows className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
                      <div className="flex-1 text-[13.5px] text-foreground">
                        {c.description}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--secondary-text)]">
                          Between
                          {c.sources.map((s) => {
                            const src = sources.find((x) => x.object_id === s.object_id);
                            return (
                              <span
                                key={s.object_id}
                                onMouseEnter={() => setHoveredId(s.object_id)}
                                onMouseLeave={() => setHoveredId(null)}
                                className="inline-flex items-center gap-1 rounded border border-[var(--warning)]/30 bg-background px-1.5 py-0.5 text-[11.5px] font-medium text-foreground"
                              >
                                <FileText className="h-3 w-3" />
                                {src?.title ?? s.object_id}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Key facts */}
              <section>
                <SectionLabel>Key financial facts</SectionLabel>
                <ul className="mt-2 grid gap-1.5">
                  {b.key_facts.map((k, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-[14px] leading-relaxed text-foreground"
                    >
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-fg)]" />
                      <span>
                        {k}
                        <SourceChip
                          ids={[
                            i === 0
                              ? "doc_pricing_exception"
                              : i === 1
                                ? "doc_financials"
                                : "doc_credit_memo",
                          ]}
                          hoveredId={hoveredId}
                          setHoveredId={setHoveredId}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Open questions */}
              <section>
                <SectionLabel>Open questions</SectionLabel>
                <ul className="mt-2 space-y-1.5">
                  {b.open_questions.map((q, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-[14px] leading-relaxed text-foreground"
                    >
                      <span className="mt-1.5 text-[var(--muted-fg)]">?</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Permission limitations */}
              <section>
                <SectionLabel>Permission limitations</SectionLabel>
                <div className="mt-2 space-y-2">
                  {b.permission_limitations.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-md border border-[var(--info)]/15 bg-[var(--info-bg)] px-3 py-2 text-[12.5px] leading-snug text-[var(--info)]"
                    >
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </section>

              {pinned && (
                <p className="text-[12px] text-[var(--secondary-text)]">
                  This packet will be revalidated if its sources change.
                </p>
              )}
            </div>
          </article>

          {/* Source rail */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-xl border border-border bg-background shadow-card">
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold text-foreground">
                    Sources ({source_count})
                  </div>
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-1 text-[12px] text-[var(--secondary-text)]">
                  {sourceSummary.used} used · {sourceSummary.restricted} restricted ·{" "}
                  {sourceSummary.conflicting} conflicting · {sourceSummary.missing} missing.
                </p>
              </div>
              <ul className="max-h-[60vh] overflow-y-auto">
                {sources.map((s) => {
                  const Icon = SOURCE_ICON[s.type];
                  const chip = STATUS_CHIP[s.status];
                  const ChipIcon = chip.icon;
                  const active = hoveredId === s.object_id;
                  return (
                    <li
                      key={s.object_id}
                      id={`src-${s.object_id}`}
                      onMouseEnter={() => setHoveredId(s.object_id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={[
                        "flex items-start gap-2.5 border-b border-border px-4 py-2.5 transition-colors last:border-b-0",
                        active ? "bg-[var(--primary-tint)]" : "bg-background",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md",
                          s.status === "restricted"
                            ? "bg-[var(--danger-bg)] text-[var(--danger)]"
                            : "bg-[var(--canvas)] text-[var(--secondary-text)]",
                        ].join(" ")}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-foreground">
                          {s.title}
                        </div>
                        <div className="mt-1">
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
                              chip.classes,
                            ].join(" ")}
                          >
                            {ChipIcon && <ChipIcon className="h-2.5 w-2.5" />}
                            {chip.label}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {messages.length > 0 && (
                <div className="max-h-[42vh] overflow-y-auto border-t border-border">
                  <ChatThread messages={messages} pending={chat.isPending} />
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendAsk(askInput);
                }}
                className="flex items-center gap-2 border-t border-border bg-[var(--canvas)] px-3 py-2.5"
              >
                <span
                  className="grid h-6 w-6 place-items-center rounded-md bg-gradient-ai text-white"
                  aria-hidden
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <input
                  type="text"
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  placeholder="Ask about this packet…"
                  className="flex-1 bg-transparent text-[12.5px] text-foreground placeholder:text-[var(--muted-fg)] focus:outline-none"
                />
              </form>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

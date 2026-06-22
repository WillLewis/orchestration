import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  XCircle,
  AlertTriangle,
  Cpu,
} from "lucide-react";
import {
  privacy,
  recipes,
  METRIC_LABELS,
  METRIC_TARGETS,
  TAXONOMY_LABELS,
  VERTICAL_LABELS,
  type Vertical,
} from "@/data/ops";
import { useOpsQuery, useOpsReportQuery } from "@/hooks/queries";

export const Route = createFileRoute("/ops")({
  head: () => ({
    meta: [
      { title: "Agent Ops — quality, safety & generalization evals" },
      {
        name: "description",
        content:
          "Evaluation dashboard proving the same governed substrate passes one scorecard across Financial, Legal, and Healthcare verticals — with privacy-preserving telemetry.",
      },
    ],
  }),
  component: AgentOpsPage,
});

/* ------------------------------------------------------------------ */
/* small primitives                                                   */
/* ------------------------------------------------------------------ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
      {children}
    </div>
  );
}

function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-mono text-[11.5px] ${className}`}>{children}</span>;
}

function TraceField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-fg)]">
        {label}
      </div>
      <div className="mt-0.5 break-words font-mono text-[11.5px] text-foreground">
        {value ?? "—"}
      </div>
    </div>
  );
}

const VERTICAL_TINT: Record<Vertical, string> = {
  finance: "bg-[var(--primary-tint)] text-primary",
  legal: "bg-[#efe9fb] text-[#5b3fc3]",
  health: "bg-[#e6f4ea] text-[var(--success)]",
};

function VerticalChip({ v }: { v: Vertical }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] ${VERTICAL_TINT[v]}`}
    >
      {v}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* metric bar                                                         */
/* ------------------------------------------------------------------ */

function MetricBar({
  metricKey,
  value,
  animatedPct,
}: {
  metricKey: string;
  value: number;
  animatedPct: number;
}) {
  const target = METRIC_TARGETS[metricKey] ?? 0.95;
  const pass = value >= target;
  const pct = Math.round(value * 100);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12.5px] text-foreground">
            {METRIC_LABELS[metricKey] ?? metricKey}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--canvas)]">
          <div
            className={[
              "h-full rounded-full transition-[width] duration-700 ease-out",
              pass ? "bg-[var(--success)]" : "bg-[var(--warning)]",
            ].join(" ")}
            style={{ width: `${animatedPct}%` }}
          />
        </div>
      </div>
      <span
        className={[
          "shrink-0 font-mono text-[11.5px] tabular-nums",
          pass ? "text-[var(--success)]" : "text-[var(--warning)]",
        ].join(" ")}
      >
        {pct}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* scorecard                                                          */
/* ------------------------------------------------------------------ */

function ScorecardCard({
  vertical,
  highlighted,
  progress,
}: {
  vertical: Vertical;
  highlighted: boolean;
  progress: number; // 0..1 — multiplier on each metric's animated width
}) {
  const score = useOpsQuery().data[vertical];
  const recipe = recipes.find((r) => r.id === score.recipe)!;
  const allPass = score.passed === score.total;
  return (
    <div
      data-vertical={vertical}
      className={[
        "flex flex-col rounded-xl border bg-background p-5 shadow-card transition-all",
        highlighted ? "border-primary/40 ring-2 ring-primary/15" : "border-border",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <VerticalChip v={vertical} />
            <Mono className="text-[var(--muted-fg)]">{recipe.id}</Mono>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold tracking-tight text-foreground">
            {VERTICAL_LABELS[vertical]}
          </h3>
        </div>
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
            allPass
              ? "bg-[var(--success-bg)] text-[var(--success)]"
              : "bg-[var(--warning-bg)] text-[var(--warning)]",
          ].join(" ")}
        >
          <CheckCircle2 className="h-3 w-3" />
          {score.passed} / {score.total} passed
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {Object.entries(score.metrics).map(([k, v]) => (
          <MetricBar key={k} metricKey={k} value={v} animatedPct={Math.round(v * 100 * progress)} />
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-3 text-[11.5px] leading-snug text-[var(--secondary-text)]">
        <span className="font-medium text-[var(--muted-fg)]">Proves · </span>
        {score.proves}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                               */
/* ------------------------------------------------------------------ */

function AgentOpsPage() {
  const opsReport = useOpsReportQuery();
  const { eval_rows, telemetry_sample, eval_source_mix, failure_taxonomy } = opsReport.data;
  const [openTrace, setOpenTrace] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(1); // 0..1
  const [rowsRevealed, setRowsRevealed] = useState(eval_rows.length);
  // Initialize to null so SSR and first client render match;
  // populate Date-based values in an effect to avoid hydration mismatch.
  const [lastRun, setLastRun] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [hoveredVertical, setHoveredVertical] = useState<Vertical | null>(null);
  const [tenantLocal, setTenantLocal] = useState(true);
  const [tenantWarn, setTenantWarn] = useState(false);
  const tenantWarnTimer = useRef<number | null>(null);

  // tick "Last run X ago" (client-only)
  useEffect(() => {
    const n = Date.now();
    setNow(n);
    setLastRun(n - 2 * 60_000);
    const i = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(i);
  }, []);

  async function runEvals() {
    if (running) return;
    setRunning(true);
    setProgress(0);
    setRowsRevealed(0);
    const latest = await opsReport.refetch();
    const rowsForRun = latest.data?.eval_rows ?? eval_rows;

    // stagger metric bar fill (~1.2s)
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // stagger row reveals
    rowsForRun.forEach((_, i) => {
      window.setTimeout(() => setRowsRevealed((n) => Math.max(n, i + 1)), 120 + i * 80);
    });

    window.setTimeout(
      () => {
        setRunning(false);
        setLastRun(Date.now());
        setNow(Date.now());
        cancelAnimationFrame(raf);
        setProgress(1);
        setRowsRevealed(rowsForRun.length);
      },
      120 + rowsForRun.length * 80 + 200,
    );
  }

  function tryToggleTenantLocal() {
    // Tenant-local is the only mode; flipping OFF reverts with a warning.
    setTenantLocal(false);
    setTenantWarn(true);
    if (tenantWarnTimer.current) window.clearTimeout(tenantWarnTimer.current);
    tenantWarnTimer.current = window.setTimeout(() => {
      setTenantLocal(true);
      setTenantWarn(false);
    }, 1600);
  }

  const lastRunLabel = useMemo(() => {
    if (now == null || lastRun == null) return "Last run —";
    const s = Math.max(0, Math.floor((now - lastRun) / 1000));
    if (s < 5) return "Last run just now";
    if (s < 60) return `Last run ${s}s ago`;
    const m = Math.floor(s / 60);
    return `Last run ${m} min ago`;
  }, [now, lastRun]);

  const maxTaxonomy = Math.max(1, ...failure_taxonomy.map((t) => t.count));

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-foreground">
      {/* Page header */}
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-6 py-4 xl:px-10">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--secondary-text)] transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to meeting
            </Link>
            <div className="flex items-center gap-2">
              <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="text-[15px] font-semibold tracking-tight">ConnectWork</span>
              <span className="ml-1 inline-flex h-6 items-center gap-1 rounded-full bg-[var(--primary-tint)] px-2 text-[11px] font-semibold text-primary">
                <ShieldCheck className="h-3 w-3" />
                Agent Ops
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-[11.5px] font-medium text-[var(--secondary-text)]">
              <Cpu className="h-3 w-3" />
              <Mono>deterministic eval runner</Mono>
            </span>
            <span className="text-[11.5px] text-[var(--muted-fg)] tabular-nums">
              {lastRunLabel}
            </span>
            <Link
              to="/developers/gating"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12.5px] font-medium text-[var(--secondary-text)] transition-colors hover:bg-[var(--canvas)] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              View API reference
            </Link>
            <button
              type="button"
              onClick={runEvals}
              disabled={running}
              className={[
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3.5 text-[12.5px] font-semibold text-white shadow-card transition-[filter,opacity] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                "bg-gradient-ai",
                running ? "cursor-default opacity-70" : "hover:brightness-110",
              ].join(" ")}
            >
              {running ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  Running evals…
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Run evals
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-[1320px] px-6 pb-6 xl:px-10">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight">Agent Ops</h1>
          <p className="mt-1 text-[13.5px] text-[var(--secondary-text)]">
            Quality, safety, and platform-generalization evals.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] space-y-10 px-6 py-8 xl:px-10">
        {/* Section 1 — three-vertical scorecard */}
        <section aria-labelledby="scorecard-heading">
          <div className="flex items-end justify-between gap-3">
            <div>
              <SectionLabel>Platform scorecard</SectionLabel>
              <h2 id="scorecard-heading" className="mt-1 text-[18px] font-semibold tracking-tight">
                Same substrate. Three regulated verticals. One passing scorecard.
              </h2>
            </div>
          </div>
          <div className="mt-4 grid gap-5 min-[1000px]:grid-cols-3">
            {(["finance", "legal", "health"] as const).map((v) => (
              <ScorecardCard
                key={v}
                vertical={v}
                highlighted={hoveredVertical === v}
                progress={progress}
              />
            ))}
          </div>
        </section>

        {/* Section 2 — governance evals */}
        <section aria-labelledby="gov-heading">
          <div className="flex items-end justify-between gap-3">
            <div>
              <SectionLabel>Governance evals</SectionLabel>
              <h2 id="gov-heading" className="mt-1 text-[16px] font-semibold tracking-tight">
                Same checks the live agent enforces, regression-tested across verticals
              </h2>
            </div>
            <span className="text-[11.5px] text-[var(--muted-fg)] tabular-nums">
              {eval_rows.filter((r) => r.passed).length} / {eval_rows.length} passing
            </span>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background shadow-card">
            <div className="grid grid-cols-[80px_minmax(0,1fr)_minmax(0,200px)_110px_110px] border-b border-border bg-[var(--canvas)] px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-fg)]">
              <div>Vertical</div>
              <div>Case</div>
              <div>Check</div>
              <div>Kind</div>
              <div className="text-right">Result</div>
            </div>
            <ul className="divide-y divide-border">
              {eval_rows.map((r, i) => {
                const visible = i < rowsRevealed;
                const expandable = !r.passed;
                const open = openTrace === r.case_id;
                return (
                  <Fragment key={r.case_id}>
                    <li
                      onMouseEnter={() => setHoveredVertical(r.vertical)}
                      onMouseLeave={() => setHoveredVertical(null)}
                      onFocus={() => setHoveredVertical(r.vertical)}
                      onBlur={() => setHoveredVertical(null)}
                      onClick={expandable ? () => setOpenTrace(open ? null : r.case_id) : undefined}
                      onKeyDown={
                        expandable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setOpenTrace(open ? null : r.case_id);
                              }
                            }
                          : undefined
                      }
                      tabIndex={0}
                      aria-expanded={expandable ? open : undefined}
                      className={[
                        "grid grid-cols-[80px_minmax(0,1fr)_minmax(0,200px)_110px_110px] items-center gap-2 px-4 py-2.5 text-[12.5px] outline-none transition-all",
                        visible ? "opacity-100" : "opacity-30",
                        expandable ? "cursor-pointer" : "",
                        hoveredVertical === r.vertical
                          ? "bg-[var(--primary-tint)]/40"
                          : "hover:bg-[var(--canvas)]/60 focus-visible:bg-[var(--canvas)]/60",
                      ].join(" ")}
                    >
                      <div>
                        <VerticalChip v={r.vertical} />
                      </div>
                      <div className="min-w-0 text-foreground">
                        <div className="truncate">{r.description}</div>
                        <Mono className="text-[var(--muted-fg)]">{r.case_id}</Mono>
                        {r.note && !r.passed && (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--warning)]">
                            <AlertTriangle className="h-3 w-3" />
                            {r.note}
                          </div>
                        )}
                      </div>
                      <div className="truncate text-[var(--secondary-text)]">{r.check}</div>
                      <div>
                        <span className="inline-flex items-center rounded-full border border-border bg-[var(--canvas)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--secondary-text)]">
                          {r.kind}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1.5">
                        {r.passed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]">
                            <CheckCircle2 className="h-3 w-3" />
                            Pass
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--danger)]">
                            <XCircle className="h-3 w-3" />
                            Fail
                          </span>
                        )}
                        {expandable && (
                          <ChevronDown
                            aria-hidden
                            className={[
                              "h-3.5 w-3.5 text-[var(--muted-fg)] transition-transform",
                              open ? "rotate-180" : "",
                            ].join(" ")}
                          />
                        )}
                      </div>
                    </li>
                    {expandable && open && (
                      <li className="bg-[var(--canvas)]/60 px-4 py-3">
                        <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-fg)]">
                          Failure trace · <Mono>{r.case_id}</Mono>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <TraceField label="Input class" value={r.input_class} />
                          <TraceField label="Expected signal" value={r.expected_signal} />
                          <TraceField label="Observed" value={r.observed_signal} />
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[var(--success-bg)] px-2 py-1 text-[11px] text-[var(--success)]">
                          <Lock className="h-3 w-3" />
                          Typed signals only — no prompt, response, or document text leaves the
                          tenant.
                        </div>
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Section 3 — privacy */}
        <section aria-labelledby="privacy-heading">
          <SectionLabel>Privacy-preserving eval loop</SectionLabel>
          <h2 id="privacy-heading" className="mt-1 text-[16px] font-semibold tracking-tight">
            Quality measured from production. Raw content never leaves the tenant.
          </h2>

          <div className="mt-4 grid gap-5 min-[1000px]:grid-cols-2">
            {/* Tenant-local telemetry */}
            <div className="rounded-xl border border-border bg-background p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13.5px] font-semibold tracking-tight">
                    Tenant-local telemetry
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--secondary-text)]">
                    Raw content stays in the tenant. Only aggregate scores leave.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tenantLocal}
                  onClick={tryToggleTenantLocal}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-[var(--canvas)] p-0.5 text-[11px] font-semibold"
                >
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 transition-colors",
                      tenantLocal ? "bg-[var(--success)] text-white" : "text-[var(--muted-fg)]",
                    ].join(" ")}
                  >
                    ON
                  </span>
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 transition-colors",
                      !tenantLocal ? "bg-[var(--danger)] text-white" : "text-[var(--muted-fg)]",
                    ].join(" ")}
                  >
                    OFF
                  </span>
                </button>
              </div>

              {tenantWarn && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--warning-bg)] px-2 py-1 text-[11.5px] text-[var(--warning)]">
                  <AlertTriangle className="h-3 w-3" />
                  Raw-content inspection is disabled for enterprise tenants.
                </div>
              )}

              <div className="mt-4 rounded-lg border border-border bg-[var(--canvas)] p-3">
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
                  TelemetryEvent (sample)
                </div>
                <pre className="overflow-x-auto font-mono text-[11.5px] leading-relaxed text-foreground">
                  {Object.entries(telemetry_sample)
                    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                    .join("\n")}
                </pre>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--success-bg)] px-3 py-2 text-[12px] text-[var(--success)]">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-semibold">
                    No raw prompts · responses · documents · transcripts
                  </div>
                  <div className="text-[11.5px] opacity-90">
                    Excluded by construction — enforced by the <Mono>TelemetryEvent</Mono> schema (
                    <Mono>extra="forbid"</Mono>).
                  </div>
                </div>
              </div>
            </div>

            {/* Eval signal & privacy */}
            <div className="rounded-xl border border-border bg-background p-5 shadow-card">
              <div className="text-[13.5px] font-semibold tracking-tight">
                Eval signal &amp; privacy
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--secondary-text)]">
                Where eval signal comes from, and how aggregate analytics are protected.
              </p>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[11px] text-[var(--muted-fg)]">
                  <span>Eval source mix</span>
                  <span>100%</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full border border-border bg-[var(--canvas)]">
                  {(
                    [
                      ["synthetic", "#0061d5"],
                      ["tenant_local", "#1e8e3e"],
                      ["redacted", "#c77700"],
                      ["aggregate", "#6c4ce0"],
                    ] as const
                  ).map(([key, color]) => (
                    <div
                      key={key}
                      style={{
                        width: `${eval_source_mix[key] * 100}%`,
                        background: color,
                      }}
                      title={`${key}: ${Math.round(eval_source_mix[key] * 100)}%`}
                    />
                  ))}
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-y-1.5 text-[11.5px]">
                  {(
                    [
                      ["synthetic", "#0061d5"],
                      ["tenant_local", "#1e8e3e"],
                      ["redacted", "#c77700"],
                      ["aggregate", "#6c4ce0"],
                    ] as const
                  ).map(([key, color]) => (
                    <li key={key} className="flex items-center gap-2 text-[var(--secondary-text)]">
                      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
                      <Mono className="text-foreground">{key}</Mono>
                      <span className="tabular-nums">
                        {Math.round(eval_source_mix[key] * 100)}%
                      </span>
                      {key === "aggregate" && (
                        <span className="ml-1 inline-flex items-center rounded-full bg-[#efe9fb] px-1.5 py-0.5 text-[10px] font-semibold text-[#5b3fc3]">
                          DP ε = {privacy.dp_epsilon.toFixed(1)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-[var(--canvas)] p-3 text-[11.5px] leading-relaxed text-[var(--secondary-text)]">
                <span className="font-semibold text-foreground">Honest caveat · </span>
                {privacy.caveat}
              </div>
            </div>
          </div>
        </section>

        {/* Section 4 — failure taxonomy */}
        <section aria-labelledby="taxonomy-heading">
          <SectionLabel>Failure taxonomy</SectionLabel>
          <h2 id="taxonomy-heading" className="mt-1 text-[16px] font-semibold tracking-tight">
            What the system catches when it does fail
          </h2>

          <div className="mt-4 rounded-xl border border-border bg-background p-5 shadow-card">
            <ul className="space-y-2.5">
              {failure_taxonomy.map((t) => {
                const w = (t.count / maxTaxonomy) * 100;
                const has = t.count > 0;
                return (
                  <li
                    key={t.category}
                    className="grid grid-cols-[200px_minmax(0,1fr)_40px] items-center gap-3"
                  >
                    <Mono className="truncate text-[var(--secondary-text)]">
                      {TAXONOMY_LABELS[t.category] ?? t.category}
                    </Mono>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--canvas)]">
                      <div
                        className={[
                          "h-full rounded-full",
                          has ? "bg-[var(--warning)]" : "bg-transparent",
                        ].join(" ")}
                        style={{ width: has ? `${Math.max(8, w)}%` : "0%" }}
                      />
                    </div>
                    <span
                      className={[
                        "text-right font-mono text-[11.5px] tabular-nums",
                        has ? "text-[var(--warning)]" : "text-[var(--muted-fg)]",
                      ].join(" ")}
                    >
                      {t.count}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 border-t border-border pt-3 text-[11.5px] text-[var(--muted-fg)]">
              Two real issues currently tracked — not all-green theater. Each maps to an open eval
              case under regression.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  GitBranch,
  GitCompareArrows,
  Lock,
  Printer,
  RefreshCw,
  Share2,
  ShieldCheck,
  ShieldAlert,
  Stamp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { approval_role_labels, sources as packet_sources } from "@/data/brief";
import { useRecordQuery, useVerification, useVerifyWorkProductMutation } from "@/hooks/queries";
import type { VerifyResult } from "@/data/record";
import { ConnectWorkHomeLink, MainRouteNav } from "@/components/navigation/MainRouteNav";

export const Route = createFileRoute("/record/$recordId")({
  head: () => ({
    meta: [
      { title: "Governed record — Acme renewal" },
      {
        name: "description",
        content:
          "Server-sealed governance certificate for the Acme renewal decision packet. Integrity, freshness, and approval status with full source provenance.",
      },
    ],
  }),
  component: RecordPage,
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
      {children}
    </div>
  );
}

function StatusPill({
  axis,
  label,
  tone,
}: {
  axis: string;
  label: string;
  tone: "green" | "neutral" | "yellow" | "red";
}) {
  const toneClasses = {
    green: "bg-[var(--success-bg)] text-[var(--success)] border-[var(--success)]/30",
    neutral: "bg-[var(--canvas)] text-foreground border-border",
    yellow: "bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning)]/40",
    red: "bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger)]/40",
  }[tone];
  return (
    <div
      className={[
        "flex flex-col gap-0.5 rounded-lg border px-3 py-2 min-w-[160px]",
        toneClasses,
      ].join(" ")}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-80">
        {axis}
      </span>
      <span className="text-[14px] font-semibold leading-tight">{label}</span>
    </div>
  );
}

// The meaningful sections of the dependency graph (the conservative all-sources fallback sections
// are omitted for legibility). Order = render order.
const DEP_SECTIONS = [
  { key: "policy_gates", label: "Policy & approval gates" },
  { key: "required_approvals", label: "Required approvals" },
  { key: "what_changed", label: "What changed" },
  { key: "key_facts", label: "Key financial facts" },
  { key: "conflicts", label: "Conflicting evidence" },
  { key: "missing_evidence", label: "Missing evidence" },
] as const;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function RecordPage() {
  const { recordId } = Route.useParams();
  const { data: cert } = useRecordQuery(recordId);
  const { data: verification } = useVerification(recordId);
  const verify = useVerifyWorkProductMutation(recordId);
  const [event, setEvent] = useState<"legal_needs_review" | "financials_v2">("legal_needs_review");

  const v: VerifyResult | null = verification ?? null;
  const staleSectionSet = useMemo(
    () => new Set((v?.stale_sections ?? []).filter((s) => s.stale).map((s) => s.section)),
    [v],
  );
  const changedSourceMap = useMemo(() => {
    const map = new Map<
      string,
      { field: string; before: string | number; after: string | number }
    >();
    v?.changed_sources.forEach((c) =>
      map.set(c.object_id, { field: c.field, before: c.before, after: c.after }),
    );
    return map;
  }, [v]);

  if (!cert) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--canvas)] text-foreground">
        Loading governed record…
      </div>
    );
  }

  const b = cert.decision_brief;
  const gov = cert.governance;
  const depMap = (gov.section_dependencies ?? {}) as Record<string, readonly string[]>;
  const isStale = v?.freshness === "stale";
  const integrityValid = v ? v.integrity_valid : true;

  function staleMark(section: string) {
    if (!staleSectionSet.has(section)) return null;
    const needsReapproval = v?.reapproval_routes.some((r) => r.section === section) ?? false;
    return (
      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--warning)]">
        <AlertTriangle className="h-3 w-3" />
        {needsReapproval ? "Stale — reapproval required" : "Stale — revalidate"}
      </span>
    );
  }

  function handleVerify() {
    verify.mutate(
      { event },
      {
        onSuccess: () =>
          toast("Record verified", {
            description: "Freshness changed to Stale — see banner below.",
          }),
      },
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)] text-foreground print:bg-white">
      {/* Top utility bar */}
      <div className="border-b border-border bg-background print:hidden">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-6 py-3 xl:px-10">
          <div className="flex min-w-0 items-center gap-2">
            <ConnectWorkHomeLink />
            <MainRouteNav />
          </div>
          <div className="text-[11px] text-[var(--muted-fg)]">Record · {cert.record_id}</div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1100px] px-6 py-8 xl:px-10">
        {/* Governance header / stamp */}
        <header className="rounded-2xl border border-border bg-background p-7 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-background">
                <Stamp className="h-3 w-3" />
                Governed record
              </div>
              <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-tight text-foreground">
                {cert.title}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--secondary-text)]">
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-[var(--canvas)] px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  {cert.record_id}
                </span>
                <span>·</span>
                <span>
                  Sealed by <span className="font-medium text-foreground">{cert.minted_by}</span>
                </span>
                <span>·</span>
                <span>
                  {new Date(cert.minted_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Three independent status axes */}
          <div className="mt-5 flex flex-wrap gap-3">
            <StatusPill
              axis="Integrity"
              label={integrityValid ? "Valid" : "Invalid seal"}
              tone={integrityValid ? "green" : "red"}
            />
            <StatusPill
              axis="Freshness"
              label={isStale ? "Stale" : "Current"}
              tone={isStale ? "yellow" : "neutral"}
            />
            <StatusPill axis="Approval" label={gov.approval_stamp} tone="red" />
          </div>

          {/* Approval reason + path-to-ready */}
          <div className="mt-5 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-bg)] p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-[var(--danger)]" />
              <div className="text-[13.5px] font-semibold text-[var(--danger)]">
                {gov.approval_reason}
              </div>
            </div>
            <div className="mt-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
                Path to ready
              </div>
              <ul className="mt-1.5 space-y-1">
                {gov.path_to_ready.map((step) => (
                  <li key={step} className="flex items-start gap-2 text-[13px] text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--muted-fg)]" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </header>

        {/* Verify result banner */}
        {v && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--warning)]/40 bg-[var(--warning-bg)]">
            <div className="border-b border-[var(--warning)]/30 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--warning)]">
              Verify result · {new Date(v.verified_at).toLocaleTimeString()}
            </div>
            <div className="grid gap-4 px-5 py-4 md:grid-cols-3">
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
                  Axes
                </div>
                <ul className="mt-1.5 space-y-1 text-[13px] text-foreground">
                  <li>
                    Integrity: <span className="font-semibold text-[var(--success)]">Valid</span>
                  </li>
                  <li>
                    Freshness: <span className="font-semibold text-[var(--warning)]">Stale</span>
                  </li>
                  <li>
                    Approval: <span className="font-semibold text-[var(--danger)]">Not ready</span>
                  </li>
                </ul>
              </div>
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
                  Changed sources
                </div>
                <ul className="mt-1.5 space-y-1 text-[13px] text-foreground">
                  {v.changed_sources.map((c) => (
                    <li key={c.object_id}>
                      <span className="font-mono text-[12px]">{c.object_id}</span>
                      <span className="text-[var(--secondary-text)]"> · {c.field}: </span>
                      <span className="line-through text-[var(--muted-fg)]">{c.before}</span>
                      <span> → </span>
                      <span className="font-semibold text-[var(--warning)]">{c.after}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
                  Reapproval routes
                </div>
                <ul className="mt-1.5 space-y-1 text-[13px] text-foreground">
                  {v.reapproval_routes.map((r) => (
                    <li key={r.section}>
                      Route{" "}
                      <span className="font-semibold capitalize">
                        {r.section.replace("_", " ")}
                      </span>{" "}
                      to <span className="font-semibold capitalize">{r.approver_role}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Dependency map — which sources each section cites; explains the staleness above */}
        <section className="mt-6 rounded-2xl border border-border bg-background p-7 shadow-card">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <SectionLabel>Dependency map</SectionLabel>
          </div>
          <p className="mt-1.5 text-[12.5px] text-[var(--secondary-text)]">
            Which sources each section depends on. When a source changes, the sections that cite it
            go stale — which is why the two events affect different sections.
          </p>
          <div className="mt-4 space-y-2">
            {DEP_SECTIONS.map((s) => {
              const deps = depMap[s.key] ?? [];
              if (!deps.length) return null;
              const stale = staleSectionSet.has(s.key);
              const route = v?.reapproval_routes.find((r) => r.section === s.key);
              return (
                <div
                  key={s.key}
                  className={[
                    "grid items-start gap-2 rounded-lg border px-3 py-2.5 sm:grid-cols-[200px_minmax(0,1fr)]",
                    stale
                      ? "border-[var(--warning)]/40 bg-[var(--warning-bg)]/40"
                      : "border-border bg-background",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-foreground">{s.label}</span>
                    {stale && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--warning)]">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {route ? `→ ${route.approver_role}` : "stale"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {deps.map((id) => {
                      const changed = changedSourceMap.has(id);
                      const sv = gov.source_versions.find((x) => x.object_id === id);
                      return (
                        <span
                          key={id}
                          className={[
                            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] font-medium",
                            changed
                              ? "border-[var(--warning)]/50 bg-[var(--warning-bg)] text-[var(--warning)]"
                              : "border-border bg-[var(--canvas)] text-[var(--secondary-text)]",
                          ].join(" ")}
                        >
                          <FileText className="h-3 w-3" />
                          {sv?.title ?? packet_sources.find((s) => s.object_id === id)?.title ?? id}
                          {changed && <span className="font-semibold">· changed</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Decision packet body (read-only) */}
        <article className="mt-6 rounded-2xl border border-border bg-background p-7 shadow-card">
          <div className="space-y-8">
            <section>
              <SectionLabel>Decision needed</SectionLabel>
              <p className="mt-2 text-[16px] font-medium leading-snug text-foreground">
                {b.decision_needed}
              </p>
            </section>

            <section>
              <SectionLabel>Executive summary</SectionLabel>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--secondary-text)]">
                {b.executive_summary}
              </p>
            </section>

            <section
              className={
                staleSectionSet.has("what_changed")
                  ? "rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-bg)]/40 p-4"
                  : ""
              }
            >
              <div className="flex items-center">
                <SectionLabel>What changed since last review</SectionLabel>
                {staleMark("what_changed")}
              </div>
              <ul className="mt-2 space-y-2">
                {b.what_changed.map((c, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-foreground">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-fg)]" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className={
                staleSectionSet.has("policy_gates")
                  ? "rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-bg)]/40 p-4"
                  : ""
              }
            >
              <div className="flex items-center">
                <SectionLabel>Policy &amp; approval gates</SectionLabel>
                {staleMark("policy_gates")}
              </div>
              <div className="mt-3 overflow-hidden rounded-lg border border-border">
                <div className="bg-background">
                  <div className="border-b border-border bg-[var(--canvas)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-fg)]">
                    Failing rules
                  </div>
                  <ul className="divide-y divide-border">
                    {b.policy_gates.firings
                      .filter((f) => !f.passed)
                      .map((f) => (
                        <li key={f.rule_id} className="flex items-start gap-3 px-4 py-2.5">
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
                          <div className="flex-1 text-[13.5px] text-foreground">{f.detail}</div>
                        </li>
                      ))}
                  </ul>
                </div>
                <div className="bg-background">
                  <div className="border-y border-border bg-[var(--canvas)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted-fg)]">
                    Calculation checks
                  </div>
                  <ul className="divide-y divide-border">
                    {b.policy_gates.calculations.map((c) => (
                      <li key={c.name} className="flex items-start gap-3 px-4 py-2.5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                        <div className="text-[13.5px] text-foreground">
                          {c.name} recalculated · matches model ({c.computed.toFixed(2)})
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section
              className={
                staleSectionSet.has("required_approvals")
                  ? "rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-bg)]/40 p-4"
                  : ""
              }
            >
              <div className="flex items-center">
                <SectionLabel>Required approvals</SectionLabel>
                {staleMark("required_approvals")}
              </div>
              <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
                {b.required_approvals.requirements.map((r) => {
                  const label = approval_role_labels[r.role] ?? r.role;
                  const chip =
                    r.status === "approved"
                      ? {
                          cls: "bg-[var(--success-bg)] text-[var(--success)]",
                          text: "Approved",
                          icon: CheckCircle2,
                        }
                      : r.status === "missing"
                        ? {
                            cls: "bg-[var(--danger-bg)] text-[var(--danger)]",
                            text: "Missing",
                            icon: XCircle,
                          }
                        : {
                            cls: "bg-[var(--warning-bg)] text-[var(--warning)]",
                            text: "Pending",
                            icon: AlertTriangle,
                          };
                  const Icon = chip.icon;
                  return (
                    <li
                      key={r.role}
                      className="flex items-center justify-between gap-3 bg-background px-4 py-2.5"
                    >
                      <div className="text-[13.5px] text-foreground">{label}</div>
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                          chip.cls,
                        ].join(" ")}
                      >
                        <Icon className="h-3 w-3" />
                        {chip.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <SectionLabel>Missing evidence</SectionLabel>
              <div className="mt-2 space-y-2">
                {b.missing_evidence.map((m) => (
                  <div
                    key={m.code}
                    className="flex items-start gap-3 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-bg)] px-4 py-3"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
                    <div className="flex-1 text-[13.5px] text-foreground">
                      {m.description}
                      {m.blocking && (
                        <span className="ml-2 rounded-full bg-[var(--danger)]/15 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--danger)]">
                          Blocking
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionLabel>Conflicting evidence</SectionLabel>
              <div className="mt-2 space-y-2">
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
                          const src = packet_sources.find((x) => x.object_id === s.object_id);
                          return (
                            <span
                              key={s.object_id}
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

            <section
              className={
                staleSectionSet.has("key_facts")
                  ? "rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-bg)]/40 p-4"
                  : ""
              }
            >
              <div className="flex items-center">
                <SectionLabel>Key financial facts</SectionLabel>
                {staleMark("key_facts")}
              </div>
              <ul className="mt-2 grid gap-1.5">
                {b.key_facts.map((k, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-foreground">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-fg)]" />
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <SectionLabel>Open questions</SectionLabel>
              <ul className="mt-2 space-y-1.5">
                {b.open_questions.map((q, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-foreground">
                    <span className="mt-1.5 text-[var(--muted-fg)]">?</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <SectionLabel>Recommended next steps</SectionLabel>
              <ul className="mt-2 space-y-1.5">
                {b.next_steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </article>

        {/* Permission boundary */}
        <section className="mt-6 rounded-2xl border border-border bg-background p-7 shadow-card">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <SectionLabel>Permission boundary</SectionLabel>
          </div>
          <ul className="mt-3 space-y-2">
            {gov.permission_omissions.map((p) => (
              <li
                key={p.object_id}
                className="flex items-start gap-3 rounded-lg border border-[var(--info)]/20 bg-[var(--info-bg)] px-4 py-3"
              >
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--info)]" />
                <div>
                  <div className="text-[13.5px] font-medium text-foreground">{p.title}</div>
                  <div className="mt-0.5 text-[12.5px] text-[var(--secondary-text)]">
                    {p.reason}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] font-medium text-[var(--secondary-text)]">
            Restricted content was not used in the decision packet.
          </p>
        </section>

        {/* Provenance footer */}
        <section className="mt-6 rounded-2xl border border-border bg-background p-7 shadow-card">
          <SectionLabel>Provenance</SectionLabel>

          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-[var(--canvas)] text-[10.5px] uppercase tracking-[0.06em] text-[var(--muted-fg)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Object</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Version</th>
                  <th className="px-3 py-2 font-semibold">Status metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {gov.source_versions.map((sv) => {
                  const changed = changedSourceMap.get(sv.object_id);
                  return (
                    <tr
                      key={sv.object_id}
                      className={changed ? "bg-[var(--warning-bg)]/50" : "bg-background"}
                    >
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-foreground">{sv.title}</div>
                        <div className="font-mono text-[11px] text-[var(--muted-fg)]">
                          {sv.object_id}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-[var(--secondary-text)]">
                        {sv.type}
                      </td>
                      <td className="px-3 py-2 align-top font-mono text-[var(--secondary-text)]">
                        v{sv.version}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {Object.keys(sv.metadata).length === 0 ? (
                          <span className="text-[var(--muted-fg)]">—</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {Object.entries(sv.metadata).map(([k, val]) => {
                              const isChanged = changed?.field === k;
                              return (
                                <li key={k} className="font-mono text-[11.5px]">
                                  <span className="text-[var(--muted-fg)]">{k}: </span>
                                  {isChanged ? (
                                    <>
                                      <span className="line-through text-[var(--muted-fg)]">
                                        {String(changed!.before)}
                                      </span>{" "}
                                      <span className="font-semibold text-[var(--warning)]">
                                        → {String(changed!.after)}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-foreground">{String(val)}</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Seal */}
          <div className="mt-5 rounded-lg border border-border bg-[var(--canvas)] p-4">
            <div className="flex items-center gap-2">
              {integrityValid ? (
                <ShieldCheck className="h-4 w-4 text-[var(--success)]" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-[var(--danger)]" />
              )}
              <div className="text-[12.5px] font-semibold text-foreground">{gov.seal.kind}</div>
              <span className="ml-auto text-[11px] text-[var(--muted-fg)]">
                Tamper-evidence · not a legal signature
              </span>
            </div>
            <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
              <div>
                <dt className="text-[10.5px] uppercase tracking-[0.06em] text-[var(--muted-fg)]">
                  Payload hash
                </dt>
                <dd className="font-mono text-foreground">{gov.seal.payload_hash}</dd>
              </div>
              <div>
                <dt className="text-[10.5px] uppercase tracking-[0.06em] text-[var(--muted-fg)]">
                  Seal value
                </dt>
                <dd className="font-mono text-foreground">{gov.seal.value}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10.5px] uppercase tracking-[0.06em] text-[var(--muted-fg)]">
                  Algorithm
                </dt>
                <dd className="text-[var(--secondary-text)]">{gov.seal.algorithm}</dd>
              </div>
            </dl>
          </div>

          {/* Schema / policy artifact */}
          <dl className="mt-5 grid gap-3 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.06em] text-[var(--muted-fg)]">
                Minted by
              </dt>
              <dd className="text-foreground">{cert.minted_by}</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.06em] text-[var(--muted-fg)]">
                Minted at
              </dt>
              <dd className="text-foreground">{new Date(cert.minted_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.06em] text-[var(--muted-fg)]">
                Schema
              </dt>
              <dd className="font-mono text-foreground">{gov.schema_name}</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.06em] text-[var(--muted-fg)]">
                Policy Artifact
              </dt>
              <dd className="font-mono text-foreground">
                {gov.rulepack_id} · v{gov.rulepack_version}
              </dd>
            </div>
          </dl>
        </section>

        {/* Actions bar */}
        <section className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background p-5 shadow-card print:hidden">
          <div className="inline-flex items-center gap-2">
            <span className="text-[11.5px] text-[var(--muted-fg)]">Simulate source change:</span>
            <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11.5px] font-medium">
              {(
                [
                  ["legal_needs_review", "Legal → Needs Review"],
                  ["financials_v2", "Financials revised"],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setEvent(val)}
                  className={[
                    "rounded-[5px] px-2 py-1 transition-colors",
                    event === val
                      ? "bg-primary text-white"
                      : "text-[var(--secondary-text)] hover:bg-[var(--canvas)]",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verify.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-60"
          >
            <RefreshCw
              className={["h-3.5 w-3.5", verify.isPending ? "animate-spin" : ""].join(" ")}
            />
            {verify.isPending ? "Verifying…" : "Verify record"}
          </button>
          <div className="mx-2 hidden h-6 w-px bg-border sm:block" />
          <button
            type="button"
            onClick={() =>
              toast("Share link copied", {
                description: "Stub: secure share is not wired in this build.",
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12.5px] font-medium text-[var(--secondary-text)] hover:bg-[var(--canvas)]"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share governed record
          </button>
          <button
            type="button"
            onClick={() =>
              toast("Download started", {
                description: "Stub: certificate bundle is not wired in this build.",
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12.5px] font-medium text-[var(--secondary-text)] hover:bg-[var(--canvas)]"
          >
            <Download className="h-3.5 w-3.5" />
            Download certificate
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12.5px] font-medium text-[var(--secondary-text)] hover:bg-[var(--canvas)]"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save PDF
          </button>
        </section>
      </main>
    </div>
  );
}

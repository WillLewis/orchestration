import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Files,
  GitCompareArrows,
} from "lucide-react";
import { useMeetingQuery } from "@/hooks/queries";
import { useGovernedBrief } from "@/lib/revalidation-store";
import { openDrawer } from "@/lib/actions-store";

export function ResultBrief({ onFollowups: _onFollowups }: { onFollowups: () => void }) {
  const { decision_brief: b, decision_readiness } = useGovernedBrief();
  const { meeting } = useMeetingQuery().data;
  const approvalReady = b.policy_gates.approval_ready;
  const blockers = decision_readiness.rows.filter((row) => row.status === "blocking");

  return (
    <div className="px-5 pt-5 pb-2">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {/* Card header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
              Decision Brief · Draft
            </div>
            <div className="mt-1 text-[11px] text-[var(--muted-fg)]">
              Confidence:{" "}
              <span className="font-medium capitalize text-[var(--secondary-text)]">
                {b.confidence}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)] transition-colors hover:bg-[var(--canvas)]"
          >
            <Files className="h-3 w-3" />
            Sources ({meeting.source_count})
          </button>
        </div>

        <div className="space-y-5 px-4 py-4">
          {/* Decision needed */}
          <section>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
              Decision needed
            </div>
            <p className="mt-1.5 text-[15px] font-semibold leading-snug text-foreground">
              {b.decision_needed}
            </p>

            <div
              className={[
                "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                approvalReady
                  ? "bg-[var(--success-bg)] text-[var(--success)]"
                  : "bg-[var(--danger-bg)] text-[var(--danger)]",
              ].join(" ")}
            >
              {approvalReady ? (
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              ) : (
                <XCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
              )}
              Approval-ready: {approvalReady ? "Yes" : "No"}
            </div>
          </section>

          {/* What changed */}
          <section>
            <SectionLabel>What changed</SectionLabel>
            <ul className="mt-1.5 space-y-1.5">
              {b.what_changed.slice(0, 3).map((c, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[12.5px] leading-snug text-[var(--secondary-text)]"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-fg)]" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Readiness */}
          <section>
            <SectionLabel>Decision readiness</SectionLabel>
            <p className="mt-1.5 text-[12.5px] leading-snug text-[var(--secondary-text)]">
              Not ready: {blockers.map((row) => row.gate).join(" + ")}.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {blockers.map((row) => (
                <span
                  key={row.id}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--danger-bg)] px-2 py-1 text-[11.5px] font-medium text-[var(--danger)]"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {row.gate}
                </span>
              ))}
            </div>
          </section>

          {/* Permission note */}
          {b.permission_limitations.map((p, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-md bg-[var(--info-bg)] px-3 py-2 text-[12px] leading-snug text-[var(--info)]"
            >
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                1 source restricted —{" "}
                {p.replace(
                  "Legal memo is restricted — its contents were not used.",
                  "Legal memo not used.",
                )}
              </span>
            </div>
          ))}

          {/* Conflict */}
          {b.conflicts.map((c, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-md bg-[var(--warning-bg)] px-3 py-2 text-[12px] leading-snug text-[var(--warning)]"
            >
              <GitCompareArrows className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{c.description}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-[var(--canvas)]/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                openDrawer({
                  mode: "plan",
                  source: "Acme renewal — pre-committee review",
                })
              }
              className="inline-flex h-8 items-center rounded-md px-2.5 text-[12.5px] font-medium text-[var(--secondary-text)] transition-colors hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Agent Actions
            </button>
          </div>
          <Link
            to="/packet"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Open full brief
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
      {children}
    </div>
  );
}

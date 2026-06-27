import { useState } from "react";
import { FileText, Maximize2, Sparkles } from "lucide-react";
import { sources, type SourceStatus } from "@/data/brief";
import { useGovernedBrief, useRevalidation } from "@/lib/revalidation-store";

/* -------------------------------------------------------------------------- */
/* Provenance span — a governed figure in the memo, linked to its source.     */
/* Hover reveals which source the agent linked + its status (the harvest made */
/* visible). On the meeting surface there's no source rail, so the linkage is */
/* surfaced inline; the Decision Packet carries the full bidirectional rail.  */
/* -------------------------------------------------------------------------- */

const SPAN_STYLE: Record<SourceStatus, string> = {
  used: "bg-[var(--primary-tint)] text-primary decoration-primary/40",
  conflicting: "bg-[var(--warning-bg)] text-[var(--warning)] decoration-[var(--warning)]/40",
  missing: "bg-[var(--warning-bg)] text-[var(--warning)] decoration-[var(--warning)]/40",
  restricted: "bg-[var(--danger-bg)] text-[var(--danger)] decoration-[var(--danger)]/40",
};

const STATUS_LABEL: Record<SourceStatus, string> = {
  used: "linked source",
  conflicting: "conflicting source",
  missing: "missing — not in packet",
  restricted: "restricted — not used",
};

function MemoSpan({
  sourceId,
  status: statusOverride,
  children,
}: {
  sourceId: string;
  status?: SourceStatus;
  children: React.ReactNode;
}) {
  const src = sources.find((s) => s.object_id === sourceId);
  const status: SourceStatus = statusOverride ?? src?.status ?? "used";
  const [hover, setHover] = useState(false);
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <mark
        tabIndex={0}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className={[
          "cursor-help rounded-[3px] px-0.5 underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-primary",
          SPAN_STYLE[status],
        ].join(" ")}
      >
        {children}
      </mark>
      {hover && src && (
        <span className="absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground shadow-panel">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5 text-primary" />
            {src.title}
          </span>
          <span className="ml-1 text-[var(--muted-fg)]">· {STATUS_LABEL[status]}</span>
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared doc viewer — the Acme credit memo (v3), screen-shared in-meeting.    */
/* -------------------------------------------------------------------------- */

export function SharedDocViewer({ onGenerateBrief }: { onGenerateBrief?: () => void }) {
  // The screen-shared memo stays authored, while governed highlights follow source status.
  const gb = useGovernedBrief();
  const reval = useRevalidation();
  const statusOf = (id: string): SourceStatus =>
    gb.sources.find((s) => s.object_id === id)?.status ?? "used";

  return (
    <div className="flex-1 px-6 pt-5 pb-6">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {/* Doc header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--primary-tint)] text-primary">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-foreground">Acme credit memo · v3</div>
              <div className="text-[11px] text-[var(--muted-fg)]">
                Screen-shared by Dana R. · 4 min ago
              </div>
            </div>
            <button
              type="button"
              onClick={onGenerateBrief}
              className="ml-2 inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-gradient-ai px-3 text-[12px] font-semibold text-white shadow-card transition-transform duration-150 hover:brightness-105 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
              Generate Decision Brief
            </button>
          </div>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted-fg)] transition-colors hover:bg-[var(--canvas)]"
            aria-label="Expand"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Doc body — the memo */}
        <div className="flex-1 overflow-y-auto bg-[var(--canvas)] p-8">
          <article className="mx-auto max-w-2xl rounded-md bg-white p-10 text-[13.5px] leading-relaxed text-foreground shadow-card">
            <header className="border-b border-border pb-4">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-fg)]">
                Credit committee · confidential
              </div>
              <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-foreground">
                Credit recommendation — Acme Corp renewal facility
              </h2>
              <div className="mt-1 text-[11.5px] text-[var(--muted-fg)]">
                Prepared by Dana R. (Relationship Mgr) · Memo v3
              </div>
            </header>

            <section className="mt-5 space-y-3.5">
              <p>
                <span className="font-semibold">Request. </span>
                Acme requests a{" "}
                <MemoSpan
                  sourceId="doc_pricing_exception"
                  status={statusOf("doc_pricing_exception")}
                >
                  22% pricing exception
                </MemoSpan>{" "}
                and a <MemoSpan sourceId="wf_approval">covenant modification</MemoSpan> on its
                commercial renewal facility.
              </p>
              <p>
                <span className="font-semibold">Financials. </span>
                The updated model revises the FY revenue forecast{" "}
                <MemoSpan sourceId="doc_financials">from $42M to $38M</MemoSpan>. Debt service
                coverage moved <MemoSpan sourceId="doc_credit_memo">1.42x -&gt; 1.28x</MemoSpan>{" "}
                based on net operating income over debt service.
              </p>
              <p>
                <span className="font-semibold">Open items. </span>
                Relationship Manager approval is recorded, but{" "}
                {reval.creditSigned ? (
                  <>
                    <MemoSpan sourceId="wf_approval">the Credit Officer has signed off</MemoSpan> on
                    the 22% exception (within their 25% authority).{" "}
                  </>
                ) : (
                  <>
                    <MemoSpan sourceId="wf_approval">
                      Credit Officer approval is outstanding
                    </MemoSpan>
                    .
                  </>
                )}{" "}
                The{" "}
                <MemoSpan sourceId="doc_covenant_tracker">
                  final covenant tracker has not been uploaded
                </MemoSpan>
                .
              </p>
              <p className="rounded-md border border-[var(--danger)]/20 bg-[var(--danger-bg)] px-3 py-2 font-medium text-[var(--danger)]">
                Recommendation: review — not approval-ready.
              </p>
            </section>

            <footer className="mt-6 flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-[var(--muted-fg)]">
              <Sparkles className="h-3 w-3 text-primary" />
              Highlighted figures are governed — hover to see the source the agent linked.
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}

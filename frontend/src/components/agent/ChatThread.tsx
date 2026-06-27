import { useEffect, useRef } from "react";
import {
  Calculator,
  Lock,
  ShieldAlert,
  AlertTriangle,
  FileWarning,
  FileText,
  Loader2,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  GitCompareArrows,
  UserCheck,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { sources } from "@/data/brief";
import type { ChatAction, ChatMessage, ChatResponse } from "@/hooks/queries";
import { useGovernedBrief } from "@/lib/revalidation-store";
import {
  getReadinessTaxonomy,
  READINESS_TAXONOMY_LABEL,
  READINESS_TAXONOMY_STYLE,
  type ReadinessTaxonomy,
} from "@/lib/readiness-taxonomy";

// A rendered turn: the wire shape plus an assistant turn's UI-only governance `meta` and an optional
// pending-approval chip label (Beat 3).
export type Turn = ChatMessage & {
  meta?: ChatResponse;
  pending?: string;
  author?: string;
  visibility?: "public" | "private";
  kind?: "text" | "brief_preview";
};

// Each governance boolean → a chip, rendered only when the flag is exactly `true`, so an absent or
// newly-added field never lights one. Styling + icons mirror ResultBrief / the packet STATUS_CHIP.
const GOV_CHIPS = [
  {
    key: "permission_boundary_hit",
    icon: Lock,
    label: "Permission boundary",
    cls: "bg-[var(--info-bg)] text-[var(--info)]",
  },
  {
    key: "gate_held",
    icon: ShieldAlert,
    label: "Gate held",
    cls: "bg-[var(--danger-bg)] text-[var(--danger)]",
  },
  {
    key: "missing_evidence",
    icon: AlertTriangle,
    label: "Missing evidence",
    cls: "bg-[var(--warning-bg)] text-[var(--warning)]",
  },
] as const;

const READINESS_TAXONOMY_ICON: Record<
  ReadinessTaxonomy,
  React.ComponentType<{ className?: string }>
> = {
  approval: UserCheck,
  artifact: FileWarning,
  conflict: GitCompareArrows,
  calculation: Calculator,
  status: AlertTriangle,
};

export function ChatThread({
  messages,
  pending,
  onAction,
}: {
  messages: Turn[];
  pending: boolean;
  // When provided, an assistant turn's `meta.actions` render as buttons (meeting panel only; the
  // packet's read-only "Ask" omits this so no demo buttons appear there).
  onAction?: (action: ChatAction) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  // Scroll to the latest turn — and when the typing indicator appears.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  return (
    <div className="space-y-3 px-5 py-4" aria-live="polite">
      {messages.map((m, i) => (
        <ChatTurn key={i} turn={m} onAction={onAction} />
      ))}
      {pending && (
        <div className="flex items-center gap-2 px-1 text-[12.5px] text-[var(--muted-fg)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Thinking…
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

function ChatTurn({ turn, onAction }: { turn: Turn; onAction?: (action: ChatAction) => void }) {
  if (turn.kind === "brief_preview") {
    return <BriefPreviewTurn turn={turn} />;
  }

  if (turn.role === "user") {
    if (turn.visibility === "public") {
      return (
        <div className="flex justify-start">
          <div className="max-w-[88%] space-y-1">
            <div className="px-1 text-[10.5px] font-medium text-[var(--muted-fg)]">
              {turn.author ?? "Meeting chat"}
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-3.5 py-2 text-[13px] leading-relaxed text-foreground shadow-card">
              {turn.content}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-1">
          <div className="rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-[13px] leading-snug text-white">
            {turn.content}
          </div>
        </div>
      </div>
    );
  }

  const meta = turn.meta;
  const citations = meta?.citations ?? [];
  const actions = meta?.actions ?? [];

  // Permission/Gate are request-specific refusal EVENTS → boolean-driven. `missing_evidence` is a
  // persistent decision-STATE (true on nearly every Acme answer), so only surface it when THIS
  // answer is actually about missing evidence — detected by the deterministic marker the wrapper
  // emits in that branch for both the offline and live clients (see test_chat_endpoint.py).
  const isMissingEvidenceAnswer =
    !!meta?.missing_evidence && /missing or unavailable/i.test(turn.content);
  const chips = meta
    ? GOV_CHIPS.filter((c) =>
        c.key === "missing_evidence" ? isMissingEvidenceAnswer : meta[c.key] === true,
      )
    : [];

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        {turn.author && (
          <div className="px-1 text-[10.5px] font-medium text-[var(--muted-fg)]">{turn.author}</div>
        )}
        <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2 text-[13px] leading-relaxed text-foreground shadow-card">
          {turn.content.trim() ? (
            turn.content
          ) : (
            <span className="text-[var(--muted-fg)]">No answer was returned.</span>
          )}
        </div>

        {turn.visibility === "private" && (
          <div className="px-1 text-[10.5px] italic text-[var(--muted-fg)]">
            only you can see this
          </div>
        )}

        {turn.pending && (
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--warning-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--warning)]">
              <Clock className="h-3 w-3" />
              Pending approval · {turn.pending}
            </span>
          </div>
        )}

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => {
              const Icon = c.icon;
              return (
                <span
                  key={c.key}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${c.cls}`}
                >
                  <Icon className="h-3 w-3" />
                  {c.label}
                </span>
              );
            })}
          </div>
        )}

        {citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {citations.map((c) => {
              const src = sources.find((x) => x.object_id === c.object_id);
              return (
                <span
                  key={c.object_id}
                  className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground"
                >
                  <FileText className="h-3 w-3" />
                  {src?.title ?? c.object_id}
                </span>
              );
            })}
          </div>
        )}

        {onAction && actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onAction(a)}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/35 bg-[var(--primary-tint)] px-2.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {a.label}
                <ArrowRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BriefPreviewTurn({ turn }: { turn: Turn }) {
  const { decision_brief: b, decision_readiness } = useGovernedBrief();
  const approvalReady = b.policy_gates.approval_ready;
  const unresolvedRows = decision_readiness.rows.filter(
    (row) => row.status === "blocking" || row.status === "pending",
  );

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] space-y-2">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
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
            <div
              className={[
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                approvalReady
                  ? "bg-[var(--success-bg)] text-[var(--success)]"
                  : "bg-[var(--danger-bg)] text-[var(--danger)]",
              ].join(" ")}
            >
              {approvalReady ? (
                <CheckCircle2 className="h-3 w-3" strokeWidth={2.25} />
              ) : (
                <XCircle className="h-3 w-3" strokeWidth={2.25} />
              )}
              {approvalReady ? "Ready" : "Not ready"}
            </div>
          </div>

          <div className="space-y-4 px-4 py-4">
            <section>
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                Decision needed
              </div>
              <p className="mt-1.5 text-[14px] font-semibold leading-snug text-foreground">
                {b.decision_needed}
              </p>
            </section>

            <section>
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                What changed
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {b.what_changed.slice(0, 2).map((change, index) => (
                  <li
                    key={index}
                    className="flex gap-2 text-[12.5px] leading-snug text-[var(--secondary-text)]"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-fg)]" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
                Decision readiness
              </div>
              <div className="mt-1.5 grid gap-1.5">
                {unresolvedRows.slice(0, 4).map((row) => {
                  const taxonomy = getReadinessTaxonomy(row);
                  const style = READINESS_TAXONOMY_STYLE[taxonomy];
                  const RowIcon = READINESS_TAXONOMY_ICON[taxonomy];

                  return (
                    <div
                      key={row.id}
                      className={[
                        "flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-[11.5px] font-medium",
                        style.row,
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "grid h-5 w-5 shrink-0 place-items-center rounded-md",
                          style.icon,
                        ].join(" ")}
                      >
                        <RowIcon className="h-3 w-3" />
                      </span>
                      <span className="min-w-0">
                        <span className={["mr-1 font-semibold", style.label].join(" ")}>
                          {READINESS_TAXONOMY_LABEL[taxonomy]}
                        </span>
                        <span className="text-[var(--secondary-text)]">{row.gate}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {b.conflicts.slice(0, 1).map((conflict, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-md bg-[var(--danger-bg)] px-3 py-2 text-[12px] leading-snug text-[var(--danger)]"
              >
                <GitCompareArrows className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{conflict.description}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end border-t border-border bg-[var(--canvas)]/50 px-4 py-3">
            <Link
              to="/packet"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Open full brief
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {turn.visibility === "private" && (
          <div className="px-1 text-[10.5px] italic text-[var(--muted-fg)]">
            only you can see this
          </div>
        )}
      </div>
    </div>
  );
}

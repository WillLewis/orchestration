import { useEffect, useRef } from "react";
import { Lock, ShieldAlert, AlertTriangle, FileText, Loader2 } from "lucide-react";
import { sources } from "@/data/brief";
import type { ChatMessage, ChatResponse } from "@/hooks/queries";

// A rendered turn: the wire shape plus an assistant turn's UI-only governance `meta`.
export type Turn = ChatMessage & { meta?: ChatResponse };

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

export function ChatThread({ messages, pending }: { messages: Turn[]; pending: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  // Scroll to the latest turn — and when the typing indicator appears.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  return (
    <div className="space-y-3 px-5 py-4" aria-live="polite">
      {messages.map((m, i) => (
        <ChatTurn key={i} turn={m} />
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

function ChatTurn({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-[13px] leading-snug text-white">
          {turn.content}
        </div>
      </div>
    );
  }

  const meta = turn.meta;
  const citations = meta?.citations ?? [];

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
        <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2 text-[13px] leading-relaxed text-foreground shadow-card">
          {turn.content.trim() ? (
            turn.content
          ) : (
            <span className="text-[var(--muted-fg)]">No answer was returned.</span>
          )}
        </div>

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
      </div>
    </div>
  );
}

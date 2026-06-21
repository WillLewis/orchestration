import { Sparkles, MoreHorizontal } from "lucide-react";

export function AgentHeader({ onReset }: { onReset?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <button
        type="button"
        onClick={onReset}
        className="group flex items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md"
        aria-label="Reset ConnectAgent"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-ai text-white shadow-card">
          <Sparkles className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-[14px] font-semibold leading-tight text-foreground">
            ConnectAgent
          </div>
          <div className="mt-0.5 text-[12px] leading-snug text-[var(--secondary-text)]">
            Grounded in this meeting + linked content.
          </div>
        </div>
      </button>
      <button
        type="button"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--muted-fg)] transition-colors hover:bg-[var(--canvas)]"
        aria-label="More options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

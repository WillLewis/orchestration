import { ShieldCheck, FileText, Maximize2 } from "lucide-react";

export function SharedDocViewer() {
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
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--info-bg)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--info)]">
              <ShieldCheck className="h-3 w-3" />
              Governed
            </span>
          </div>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted-fg)] transition-colors hover:bg-[var(--canvas)]"
            aria-label="Expand"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Doc body — placeholder lines */}
        <div className="flex-1 overflow-hidden bg-[var(--canvas)] p-8">
          <div className="mx-auto max-w-2xl rounded-md bg-white p-10 shadow-card">
            <div className="space-y-3">
              <div className="h-3 w-2/5 rounded bg-[var(--border)]" />
              <div className="h-2 w-full rounded bg-[var(--border)]/60" />
              <div className="h-2 w-11/12 rounded bg-[var(--border)]/60" />
              <div className="h-2 w-10/12 rounded bg-[var(--border)]/60" />
            </div>
            <div className="mt-7 space-y-3">
              <div className="h-3 w-1/3 rounded bg-[var(--border)]" />
              <div className="h-2 w-full rounded bg-[var(--border)]/60" />
              <div className="h-2 w-9/12 rounded bg-[var(--border)]/60" />
              <div className="h-2 w-11/12 rounded bg-[var(--border)]/60" />
              <div className="h-2 w-7/12 rounded bg-[var(--border)]/60" />
            </div>
            <div className="mt-7 grid grid-cols-3 gap-3">
              <div className="h-16 rounded-md bg-[var(--border)]/50" />
              <div className="h-16 rounded-md bg-[var(--border)]/50" />
              <div className="h-16 rounded-md bg-[var(--border)]/50" />
            </div>
            <div className="mt-7 space-y-3">
              <div className="h-2 w-full rounded bg-[var(--border)]/60" />
              <div className="h-2 w-10/12 rounded bg-[var(--border)]/60" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

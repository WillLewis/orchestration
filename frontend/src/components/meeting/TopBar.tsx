import { Share2, LogOut, ArrowLeft, ShieldCheck, Workflow } from "lucide-react";
import { meeting } from "@/lib/meeting-data";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

function useRunningTimer(startSeconds: number) {
  const [s, setS] = useState(startSeconds);
  useEffect(() => {
    const i = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(i);
  }, []);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

type TopBarProps = {
  onToggleAgent?: () => void;
  /** Show "← Back to meeting" before the wordmark (packet workspace). */
  showBackToMeeting?: boolean;
  /** Replace the default Share / Leave actions (e.g. packet pin/export). */
  rightSlot?: ReactNode;
};

export function TopBar({ onToggleAgent, showBackToMeeting = false, rightSlot }: TopBarProps) {
  const timer = useRunningTimer(42 * 60 + 18);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-5">
      {/* Wordmark */}
      <div className="flex items-center gap-6">
        {showBackToMeeting && (
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--secondary-text)] transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to meeting
          </Link>
        )}
        <div className="flex items-center gap-2">
          <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">
            ConnectWork
          </span>
          <Link
            to="/ops"
            className="ml-2 inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card px-2 text-[11px] font-medium text-[var(--secondary-text)] transition-colors hover:border-[var(--primary)]/30 hover:bg-[var(--primary-tint)] hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Open Agent Ops evaluation dashboard"
          >
            <ShieldCheck className="h-3 w-3" />
            Agent Ops
          </Link>
          <Link
            to="/loop"
            className="ml-1 inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card px-2 text-[11px] font-medium text-[var(--secondary-text)] transition-colors hover:border-[var(--primary)]/30 hover:bg-[var(--primary-tint)] hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Open Work Loop orchestration"
          >
            <Workflow className="h-3 w-3" />
            Work Loop
          </Link>
        </div>

        {/* Title + live + timer */}
        <div className="flex items-center gap-3">
          <h1 className="text-[13px] font-medium text-foreground">{meeting.title}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--danger)]">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[var(--danger)]" />
            Live
          </span>
          <span className="font-mono text-[12px] tabular-nums text-[var(--secondary-text)]">
            {timer}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {rightSlot ?? (
          <>
            {/* Avatar stack */}
            <div className="flex -space-x-2">
              {meeting.participants.map((p) => (
                <div
                  key={p.initials}
                  className="grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-[var(--canvas)] text-[10px] font-semibold text-[var(--secondary-text)] ring-0"
                  title={p.name}
                >
                  {p.initials}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onToggleAgent}
              className="hidden xl:hidden"
              aria-hidden
            />

            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--danger)] px-3 text-[13px] font-medium text-white transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)] focus-visible:ring-offset-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave
            </button>
          </>
        )}
      </div>
    </header>
  );
}

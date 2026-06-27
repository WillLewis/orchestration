import { LogOut, ArrowLeft } from "lucide-react";
import { meeting } from "@/lib/meeting-data";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConnectWorkHomeLink, MainRouteNav } from "@/components/navigation/MainRouteNav";
import { useLifecycleResetMutation } from "@/hooks/queries";
import { resetActions } from "@/lib/actions-store";
import { resetLatestRecordId } from "@/lib/record-store";
import { resetRevalidation } from "@/lib/revalidation-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  /** Replace the default actions (e.g. packet seal/export). */
  rightSlot?: ReactNode;
};

export function TopBar({ onToggleAgent, showBackToMeeting = false, rightSlot }: TopBarProps) {
  const timer = useRunningTimer(42 * 60 + 18);
  const queryClient = useQueryClient();
  const lifecycleReset = useLifecycleResetMutation();
  const [isResettingDemo, setIsResettingDemo] = useState(false);

  async function resetDemo() {
    if (isResettingDemo) return;
    setIsResettingDemo(true);
    resetActions();
    resetRevalidation();
    resetLatestRecordId();
    window.sessionStorage.removeItem("connectwork:lastNonDocsHref");
    try {
      await lifecycleReset.mutateAsync();
      queryClient.clear();
      window.location.assign("/");
    } catch {
      setIsResettingDemo(false);
      toast.error("Couldn't reset the live demo state", {
        description: "The lifecycle gateway did not respond. Try again once the API is running.",
      });
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-5">
      {/* Wordmark */}
      <div className="flex min-w-0 items-center gap-6">
        {showBackToMeeting && (
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--secondary-text)] transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to meeting
          </Link>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <ConnectWorkHomeLink />
          <MainRouteNav />
        </div>

        {/* Title + live + timer */}
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-[13px] font-medium text-foreground">{meeting.title}</h1>
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

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--danger)] px-3 text-[13px] font-medium text-white transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)] focus-visible:ring-offset-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Leave
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave and reset the demo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset the demo state and return to the beginning.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Stay</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault();
                      void resetDemo();
                    }}
                    className="bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90"
                    disabled={isResettingDemo || lifecycleReset.isPending}
                  >
                    {isResettingDemo || lifecycleReset.isPending ? "Resetting…" : "Leave demo"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </header>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, GitBranch, ShieldCheck, Workflow } from "lucide-react";

import { getAgentActionNotificationCounts, openDrawer, useActionsStore } from "@/lib/actions-store";
import { useRevalidation } from "@/lib/revalidation-store";

type MainRouteNavProps = {
  variant?: "light" | "dark";
};

type ConnectWorkHomeLinkProps = {
  variant?: "light" | "dark";
};

const NAV_ITEMS = [
  {
    label: "Agent Ops",
    to: "/ops",
    icon: ShieldCheck,
    isActive: (pathname: string) => pathname === "/ops",
    ariaLabel: "Open Agent Ops evaluation dashboard",
  },
  {
    label: "Agent Batch",
    to: "/loop",
    icon: Workflow,
    isActive: (pathname: string) => pathname === "/loop",
    ariaLabel: "Open Agent Batch orchestration",
  },
] as const;

export function MainRouteNav({ variant = "light" }: MainRouteNavProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isDark = variant === "dark";
  const actions = useActionsStore();
  const revalidation = useRevalidation();
  const actionCounts = getAgentActionNotificationCounts(actions, revalidation);

  function navClasses(active = false) {
    const base =
      "ml-1 inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
    if (isDark) {
      return [
        base,
        active
          ? "border-emerald-300/50 bg-emerald-300/12 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.12)]"
          : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200",
      ].join(" ");
    }
    return [
      base,
      active
        ? "border-[var(--primary)]/35 bg-[var(--primary-tint)] text-primary shadow-[inset_0_0_0_1px_rgba(37,99,235,0.08)]"
        : "border-border bg-card text-[var(--secondary-text)] hover:border-[var(--primary)]/30 hover:bg-[var(--primary-tint)] hover:text-primary",
    ].join(" ");
  }

  function openAgentActions() {
    if (actionCounts.changesTotal > 0) {
      openDrawer({
        mode: "revalidation_edit",
        source: "Credit Officer response — approval returned",
        change_kind: "approval_returned",
      });
      return;
    }
    if (actionCounts.nextTotal > 0) {
      openDrawer({ mode: "staged_remediation", source: "Decision readiness — staged route" });
      return;
    }
    openDrawer({ source: "Acme renewal — pre-committee review" });
  }

  return (
    <nav className="flex shrink-0 items-center gap-1" aria-label="Agent navigation">
      {NAV_ITEMS.map(({ label, to, icon: Icon, isActive, ariaLabel }) => (
        <Link
          key={to}
          to={to}
          className={navClasses(isActive(pathname))}
          aria-label={ariaLabel}
          aria-current={isActive(pathname) ? "page" : undefined}
        >
          <Icon className="h-3 w-3" />
          {label}
        </Link>
      ))}
      <button
        type="button"
        onClick={openAgentActions}
        className={navClasses()}
        aria-label="Open Agent Actions"
      >
        <GitBranch className="h-3 w-3" />
        Agent Actions
        {actionCounts.topNavUnseen > 0 && (
          <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-white">
            {actionCounts.topNavUnseen}
          </span>
        )}
      </button>
      <Link
        to="/developers"
        className={navClasses(pathname.startsWith("/developers"))}
        aria-label="Open Agent Docs"
        aria-current={pathname.startsWith("/developers") ? "page" : undefined}
      >
        <BookOpen className="h-3 w-3" />
        Agent Docs
      </Link>
    </nav>
  );
}

export function ConnectWorkHomeLink({ variant = "light" }: ConnectWorkHomeLinkProps) {
  const isDark = variant === "dark";

  return (
    <Link
      to="/"
      className={[
        "inline-flex shrink-0 items-center gap-2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isDark ? "text-zinc-100 hover:text-emerald-200" : "text-foreground hover:text-primary",
      ].join(" ")}
      aria-label="Open meeting home"
    >
      <span
        className={[
          "block h-2.5 w-2.5 shrink-0 rounded-full",
          isDark ? "bg-emerald-300" : "bg-primary",
        ].join(" ")}
      />
      <span className="text-[15px] font-semibold tracking-tight">ConnectWork</span>
    </Link>
  );
}

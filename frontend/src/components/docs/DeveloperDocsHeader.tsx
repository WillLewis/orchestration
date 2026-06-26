import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { ConnectWorkHomeLink, MainRouteNav } from "@/components/navigation/MainRouteNav";

type ReturnTarget = {
  href: string;
  label: string;
};

function labelForHref(href: string) {
  const path = href.split(/[?#]/)[0] || "/";
  if (path === "/") return "Meeting";
  if (path === "/ops") return "Agent Ops";
  if (path === "/loop") return "Agent Batch";
  if (path === "/packet") return "Decision Packet";
  if (path.startsWith("/record/")) return "Governed Record";
  return "Meeting";
}

function useDocsReturnTarget(): ReturnTarget {
  const [target, setTarget] = useState<ReturnTarget>({ href: "/", label: "Meeting" });

  useEffect(() => {
    const stored = window.sessionStorage.getItem("connectwork:lastNonDocsHref");
    if (!stored || stored.startsWith("/developers")) return;
    setTarget({ href: stored, label: labelForHref(stored) });
  }, []);

  return target;
}

export function DeveloperDocsHeader() {
  const returnTarget = useDocsReturnTarget();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#0a0a0c]/85 backdrop-blur">
      <div className="mx-auto flex min-h-12 max-w-[1320px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <ConnectWorkHomeLink variant="dark" />
          <MainRouteNav variant="dark" />
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-zinc-500">
          <a
            href={returnTarget.href}
            className="inline-flex h-7 items-center gap-1 rounded border border-zinc-800 bg-zinc-900/60 px-2 text-[11px] font-medium text-zinc-400 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to {returnTarget.label}
          </a>
          <span className="hidden sm:inline">ConnectWork Platform API</span>
          <span className="inline-flex h-5 items-center rounded border border-zinc-700 bg-zinc-900 px-1.5 font-mono text-[10.5px] text-zinc-300">
            v2
          </span>
        </div>
      </div>
    </header>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";

import { DeveloperDocsHeader } from "@/components/docs/DeveloperDocsHeader";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export const Route = createFileRoute("/developers/prioritization")({
  head: () => ({
    meta: [
      { title: "Prioritization - ConnectWork Platform API" },
      {
        name: "description",
        content:
          "The scoring rubric: eight candidate themes ranked against ConnectWork's brief by value, leverage, differentiation, and risk.",
      },
    ],
  }),
  component: PrioritizationDocsPage,
});

type Axis = { weight: string; name: string; anchor: string };

const AXES: Axis[] = [
  {
    weight: "30",
    name: "User & business value",
    anchor: "Advances the brief's goal: more data sources + proactive, actionable insight.",
  },
  {
    weight: "25",
    name: "Platform leverage",
    anchor: "Reuses existing assets (RAG, Metadata API, Workflow engine) vs. net-new build.",
  },
  {
    weight: "25",
    name: "Strategic differentiation",
    anchor: "A defensible enterprise wedge - not a generic assistant feature.",
  },
  {
    weight: "20",
    name: "Trust & risk containment",
    anchor: "Compliance as value; contained failure modes (hallucination, leakage, noise).",
  },
];

type Row = {
  theme: string;
  value: number;
  leverage: number;
  diff: number;
  trust: number;
  total: number;
  tier1?: boolean;
};

const ROWS: Row[] = [
  {
    theme: "Cross-source grounding",
    value: 30,
    leverage: 25,
    diff: 20,
    trust: 16,
    total: 91,
    tier1: true,
  },
  {
    theme: "Deterministic gating",
    value: 24,
    leverage: 20,
    diff: 25,
    trust: 20,
    total: 89,
    tier1: true,
  },
  {
    theme: "Provenance / governed record",
    value: 18,
    leverage: 20,
    diff: 20,
    trust: 20,
    total: 78,
  },
  { theme: "Proactive insight", value: 30, leverage: 20, diff: 15, trust: 12, total: 77 },
  { theme: "Agent Charters / authority", value: 12, leverage: 20, diff: 20, trust: 16, total: 68 },
  { theme: "Adaptive HITL routing", value: 12, leverage: 20, diff: 15, trust: 16, total: 63 },
  { theme: "Multi-agent orchestration", value: 12, leverage: 10, diff: 15, trust: 8, total: 45 },
  { theme: "Cost-aware routing", value: 6, leverage: 15, diff: 10, trust: 8, total: 39 },
];

function PrioritizationDocsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0c] text-zinc-200">
      <DeveloperDocsHeader />

      <div className="mx-auto block w-full max-w-[1320px] gap-8 px-4 py-8 sm:px-6 md:flex">
        <DocsSidebar />

        <main className="w-full min-w-0 space-y-8 md:flex-1">
          <section style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">
              Getting started
            </div>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-zinc-50">
              Prioritization
            </h1>
            <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-zinc-400">
              How we decided what to solve for. Eight candidate themes, scored against ConnectWork's
              own brief - the goal, the existing assets, the platform's position, and its risk
              surface. The build order lives in the{" "}
              <Link
                to="/developers/roadmap"
                className="text-emerald-300 underline-offset-2 hover:underline"
              >
                Roadmap
              </Link>
              ; this page is the ranking behind it.
            </p>
          </section>

          <section className="space-y-4" style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-emerald-300/90">
                Gate · pass / fail
              </div>
              <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-zinc-300">
                <span className="font-semibold text-zinc-100">Permission-safe.</span> Every
                candidate must strictly respect existing user permissions. Anything that can't is
                out before it's scored.
              </p>
            </div>

            <div className="-space-y-px">
              {AXES.map((axis) => (
                <div
                  key={axis.name}
                  className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 font-mono text-[15px] font-semibold text-emerald-300">
                    {axis.weight}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-zinc-100">{axis.name}</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">
                      {axis.anchor}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[12px] italic leading-relaxed text-zinc-500">Weights sum to 100.</p>
          </section>

          <section
            className="space-y-3 border-t border-zinc-900 pt-8"
            style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}
          >
            <div className="font-mono text-[11px] text-zinc-500">§ scores</div>
            <h2 className="text-[20px] font-semibold tracking-tight text-zinc-50">
              How the themes rank
            </h2>
            <p className="max-w-[68ch] text-[13px] leading-relaxed text-zinc-400">
              Weighted points per axis (rating x weight). Sorted by total; the top two are Tier 1.
            </p>

            <div className="mt-1 overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-zinc-900/70 text-left text-zinc-400">
                    <th className="px-3 py-2.5 font-semibold">Theme</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Value · 30</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Leverage · 25</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Diff · 25</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Trust · 20</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr
                      key={row.theme}
                      className={[
                        "border-t border-zinc-900",
                        row.tier1 ? "bg-emerald-500/[0.06]" : "",
                      ].join(" ")}
                    >
                      <td
                        className={[
                          "px-3 py-2.5",
                          row.tier1 ? "font-semibold text-zinc-100" : "text-zinc-200",
                        ].join(" ")}
                      >
                        {row.theme}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-500">{row.value}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-500">{row.leverage}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-500">{row.diff}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-500">{row.trust}</td>
                      <td
                        className={[
                          "px-3 py-2.5 text-right font-semibold",
                          row.tier1 ? "text-emerald-300" : "text-zinc-100",
                        ].join(" ")}
                      >
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="max-w-[68ch] text-[12px] leading-relaxed text-zinc-500">
              Lower tiers reflect the brief, not the field: multi-agent orchestration reads as scope
              creep against a one-agent task, and cost routing barely touches the stated goal.
            </p>
          </section>

          <section
            className="rounded-lg border-l-2 border-emerald-400/80 bg-emerald-400/[0.06] p-4"
            style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-300/90">
              Ranking is the destination, not the build order
            </div>
            <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-emerald-100/90">
              The rubric ranks cross-source grounding first; deterministic gating is a close second
              and leads the live demo as the rail that makes grounding's actionable extension safe
              to ship. What gets built first is a separate question - that's the{" "}
              <Link
                to="/developers/roadmap"
                className="font-semibold text-emerald-50 underline-offset-2 hover:underline"
              >
                Roadmap
              </Link>
              , where grounding is Phase 1 and the gate is the Phase 2 precondition for acting.
            </p>
          </section>
        </main>
      </div>

      <footer className="border-t border-zinc-800/60 bg-[#0a0a0c]">
        <div className="mx-auto max-w-[1320px] px-6 py-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <div className="text-[13px] font-semibold tracking-tight text-zinc-100">
                ConnectWork
              </div>
              <p className="text-[12.5px] leading-relaxed text-zinc-500">
                A leading SaaS provider of collaborative workspace solutions for large enterprises.
              </p>
            </div>
            <div className="space-y-3">
              <div className="text-[13px] font-semibold tracking-tight text-zinc-100">Platform</div>
              <ul className="space-y-1.5 text-[12.5px] text-zinc-500">
                <li>Document management</li>
                <li>Team communication</li>
                <li>Project organization</li>
              </ul>
            </div>
            <div className="space-y-3">
              <div className="text-[13px] font-semibold tracking-tight text-zinc-100">
                AI Agents
              </div>
              <p className="text-[12.5px] leading-relaxed text-zinc-500">
                Conversational Insights Agent - embedded within chat and meeting tools to boost
                productivity.
              </p>
            </div>
            <div className="space-y-3">
              <div className="text-[13px] font-semibold tracking-tight text-zinc-100">
                Developers
              </div>
              <ul className="space-y-1.5 text-[12.5px] text-zinc-500">
                <li>Platform API v2</li>
                <li>Policy artifacts</li>
                <li>Deterministic gating</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-zinc-800/60 pt-6 sm:flex-row">
            <p className="text-[11.5px] text-zinc-600">
              © {new Date().getFullYear()} ConnectWork, Inc. All rights reserved.
            </p>
            <p className="text-[11.5px] text-zinc-600">developers.connectwork.com</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { DeveloperDocsHeader } from "@/components/docs/DeveloperDocsHeader";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export const Route = createFileRoute("/developers/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap - ConnectWork Platform API" },
      {
        name: "description",
        content:
          "A phased plan for ConnectAgent: substrate first, then read, governed action, and lifecycle.",
      },
    ],
  }),
  component: RoadmapDocsPage,
});

type Layer = { name: ReactNode; desc: ReactNode };
type Phase = { n: string; tag: string; title: string; why: ReactNode; layers: Layer[] };

function PolicyToken() {
  return <span className="font-medium text-emerald-300">Policy Artifact</span>;
}

const PHASES: Phase[] = [
  {
    n: "0",
    tag: "Phase 0",
    title: "Substrate",
    why: (
      <>
        <span className="font-medium text-zinc-200">
          Context, authority, and evaluation are the primitives everything else depends on.
        </span>{" "}
        Define them first, and no later feature has to invent its own controls.
      </>
    ),
    layers: [
      {
        name: "Permission-aware context assembly",
        desc: "The agent gathers context only from sources the current user is allowed to see. Permissions are applied before retrieval, never bolted on after.",
      },
      {
        name: (
          <>
            Deterministic gate + <PolicyToken />
          </>
        ),
        desc: "A rules engine - not the AI model - decides what an agent may do. The rules live as a versioned, signed-off data object (the Policy Artifact), so the same input always yields the same allow-or-block, and anyone can audit exactly why.",
      },
      {
        name: "Action Diff",
        desc: "Before any change is made, the agent shows precisely what would change - which files, fields, approvals, and notifications - so a person approves a specific change, not a vague intent.",
      },
      {
        name: "Eval Trace",
        desc: "A continuous record of the agent's outputs tested against expected behavior, so quality is measured over time instead of assumed.",
      },
    ],
  },
  {
    n: "1",
    tag: "Phase 1",
    title: "Read - ground and inform",
    why: (
      <>
        <span className="font-medium text-zinc-200">
          Grounding is both the foundation and the fastest value.
        </span>{" "}
        The agent answers from the right sources, permission-safe, with no ability yet to change
        anything.
      </>
    ),
    layers: [
      {
        name: "Permission-aware grounding (RAG)",
        desc: "Retrieval-augmented generation: the agent pulls the right content from across the workspace and cites it, scoped to what the user can access.",
      },
      {
        name: "Decision Brief",
        desc: "A structured draft of the decision - what changed, what's missing, where sources conflict, and the evidence behind each point. The agent's first real work product.",
      },
      {
        name: "Proactive insight cards",
        desc: "The agent surfaces changed documents, open decisions, blockers, and missing approvals without being asked.",
      },
    ],
  },
  {
    n: "2",
    tag: "Phase 2",
    title: "Governed action - act, safely",
    why: (
      <>
        <span className="font-medium text-zinc-200">
          Now the agent can act - but only through the gate built in Phase 0.
        </span>{" "}
        The model proposes, deterministic policy decides, and people approve specific, previewed
        changes.
      </>
    ),
    layers: [
      {
        name: "Action packets",
        desc: "Proposed actions - create a task, route an approval, update a status - run through the gate: preview the change, approve, commit, with rollback available.",
      },
      {
        name: "Multi-owner orchestration",
        desc: "One decision fans out into follow-ups routed to the right owners across the team, with replies collected and escalations handled automatically.",
      },
      {
        name: "Audit trail",
        desc: "Every action and its approval is captured as an immutable, reviewable record.",
      },
    ],
  },
  {
    n: "3",
    tag: "Phase 3",
    title: "Lifecycle & openness",
    why: (
      <>
        <span className="font-medium text-zinc-200">
          Govern the lifecycle of what the agent produces - keep it true as the facts change - then
          open the primitives to admins and new verticals
        </span>{" "}
        once the patterns are proven.
      </>
    ),
    layers: [
      {
        name: "Sealed governed record + active revalidation",
        desc: "The finished work product is sealed with an integrity check and full provenance. When a source changes, the record re-derives whether the decision still holds and flags what's gone stale.",
      },
      {
        name: "AI Studio & API",
        desc: "Admins and developers author their own policies and assemble the primitives into new workflows - the platform opens up once the core patterns are proven.",
      },
      {
        name: "Vertical expansion",
        desc: "The same primitives extend to Legal and Healthcare by swapping the Policy Artifact and the evaluation set - vertical-agnostic by design.",
      },
    ],
  },
];

function PhaseCard({ phase }: { phase: Phase }) {
  return (
    <section
      className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5"
      style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 font-mono text-[14px] font-semibold text-emerald-300">
          {phase.n}
        </span>
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
            {phase.tag}
          </div>
          <h3 className="text-[17px] font-semibold tracking-tight text-zinc-50">{phase.title}</h3>
        </div>
      </div>

      <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-zinc-400">{phase.why}</p>

      <ul className="mt-4 border-t border-zinc-800 pt-1">
        {phase.layers.map((layer, index) => (
          <li
            key={index}
            className={["flex gap-3 py-2.5", index > 0 ? "border-t border-zinc-900" : ""].join(" ")}
          >
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/80" />
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-zinc-100">{layer.name}</div>
              <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-zinc-400">
                {layer.desc}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoadmapDocsPage() {
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
              Roadmap
            </h1>
            <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-zinc-400">
              A phased plan for ConnectAgent. Each phase ships value on its own and earns the next.
              The ranking behind the sequence lives in{" "}
              <Link
                to="/developers/prioritization"
                className="text-emerald-300 underline-offset-2 hover:underline"
              >
                Prioritization
              </Link>
              .
            </p>
          </section>

          <section
            className="rounded-lg border-l-2 border-emerald-400/80 bg-emerald-400/[0.06] p-4"
            style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-300/90">
              Why this order
            </div>
            <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-emerald-100/90">
              Most teams make the agent more{" "}
              <span className="font-semibold text-emerald-50">powerful</span> with each release. We
              make it more{" "}
              <span className="font-semibold text-emerald-50">measurable and more governed</span>{" "}
              first. Phase 0 builds the substrate every later feature depends on - how the agent
              gets context, what it's allowed to do, how each change is previewed, and how its
              output is tested. After that, capability arrives in a deliberate order: the agent{" "}
              <span className="font-semibold text-emerald-50">reads before it writes</span>, and
              policy is{" "}
              <span className="font-semibold text-emerald-50">enforced before it's opened up</span>{" "}
              for others to configure. Nothing downstream has to improvise, because the primitives
              underneath it are already defined.
            </p>
          </section>

          <div className="space-y-4">
            {PHASES.map((phase) => (
              <PhaseCard key={phase.n} phase={phase} />
            ))}
          </div>

          <section
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
            style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
              Where the enforcement lives
            </div>
            <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-zinc-300">
              The Phase 0 gate and Policy Artifact are the same objects the platform exposes under{" "}
              <Link
                to="/developers/gating"
                className="text-emerald-300 underline-offset-2 hover:underline"
              >
                Deterministic Gating
              </Link>
              . Read first, then governed action - the gate is built before any write rides on it.
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

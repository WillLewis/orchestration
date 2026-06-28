import { createFileRoute } from "@tanstack/react-router";
import { Circle, Layers3, Link2, MoreHorizontal, Unlink2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { DeveloperDocsHeader } from "@/components/docs/DeveloperDocsHeader";
import { Callout, RelatedLinks } from "@/components/docs/DocsPage";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { slugify } from "@/lib/docs-slug";

export const Route = createFileRoute("/developers/whats-live")({
  head: () => ({
    meta: [
      { title: "What's Live - ConnectWork Platform API" },
      {
        name: "description",
        content:
          "A live-capability map for the ConnectWork demo: what is wired, what is simulated, and what is built but outside the primary UI path.",
      },
    ],
  }),
  component: WhatsLiveDocsPage,
});

type Status = "live" | "mock" | "backlog";
type BadgeTone = "green" | "amber" | "blue";

type CapabilityRow = {
  status: Status;
  label: string;
  meta: string;
};

type Surface = {
  title: string;
  route: string;
  badge: string;
  badgeTone: BadgeTone;
  liveBorder?: boolean;
  rows: CapabilityRow[];
};

type SubstrateRow = CapabilityRow & {
  result: string;
};

const surfaces: Surface[] = [
  {
    title: "Meeting side panel",
    route: "/",
    badge: "live event path",
    badgeTone: "green",
    liveBorder: true,
    rows: [
      { status: "live", label: "Chat + @Agent", meta: "/chat - scripted" },
      { status: "live", label: "Memo/brief recompute", meta: "/brief + lifecycle" },
      { status: "live", label: "Readiness rows", meta: "/api/brief" },
      { status: "live", label: "Suggested-action arc", meta: "/lifecycle/events" },
      { status: "mock", label: "Brief thinking", meta: "animation" },
      { status: "mock", label: "Participant rail", meta: "mock" },
    ],
  },
  {
    title: "Decision packet",
    route: "/packet",
    badge: "live + staged remediation",
    badgeTone: "green",
    liveBorder: true,
    rows: [
      { status: "live", label: "Brief, gates, calcs", meta: "/api/brief" },
      { status: "live", label: "Approval banner", meta: "policy gates" },
      { status: "live", label: "Readiness -> stage", meta: "/actions/staged" },
      { status: "live", label: "Ask packet", meta: "/chat" },
      { status: "live", label: "Seal record", meta: "/workproducts/mint" },
      { status: "mock", label: "Source pin", meta: "client UI" },
    ],
  },
  {
    title: "Action diff drawer",
    route: "global",
    badge: "live anti-bypass + staged",
    badgeTone: "green",
    liveBorder: true,
    rows: [
      { status: "live", label: "Action plan + diffs", meta: "/api/actions" },
      { status: "live", label: "Staged cards", meta: "/actions/staged" },
      { status: "live", label: "Execute staged", meta: "/staged/execute" },
      { status: "live", label: "Run gateway", meta: "/actions/execute" },
      { status: "live", label: "Change count", meta: "/api/lifecycle" },
      { status: "mock", label: "Approve/edit", meta: "client store" },
    ],
  },
  {
    title: "Agent Ops",
    route: "/ops",
    badge: "live",
    badgeTone: "green",
    liveBorder: true,
    rows: [
      { status: "live", label: "3-vertical scorecard", meta: "/ops/evals" },
      { status: "live", label: "Eval rows + trace", meta: "/ops/evals" },
      { status: "live", label: "Telemetry taxonomy", meta: "/ops/evals" },
      { status: "live", label: "Run evals", meta: "refetch + animation" },
      { status: "mock", label: "Tenant toggle", meta: "stub" },
    ],
  },
  {
    title: "Work loop",
    route: "/loop",
    badge: "batch live - run orphaned",
    badgeTone: "amber",
    rows: [
      { status: "live", label: "Loop dossier", meta: "GET /api/loop" },
      { status: "live", label: "Approve + batch", meta: "/actions/execute" },
      { status: "live", label: "Approval matrix", meta: "/api/loop" },
      { status: "mock", label: "Close playback", meta: "status animation" },
      { status: "mock", label: "CS/Legal replies", meta: "simulated" },
      { status: "backlog", label: "Server loop", meta: "POST /actions/loop" },
    ],
  },
  {
    title: "Governed record",
    route: "/record/:id",
    badge: "mostly live",
    badgeTone: "green",
    liveBorder: true,
    rows: [
      { status: "live", label: "Mint/fetch record", meta: "/workproducts/*" },
      { status: "live", label: "Verify HMAC + freshness", meta: "/verify" },
      { status: "live", label: "Dependency map", meta: "section_dependencies" },
      { status: "live", label: "Event picker", meta: "/verify" },
      { status: "live", label: "Print/save PDF", meta: "real" },
      { status: "mock", label: "Share cert", meta: "stub" },
    ],
  },
  {
    title: "Developer docs",
    route: "/developers/*",
    badge: "static docs - live chat",
    badgeTone: "blue",
    rows: [
      { status: "live", label: "Docs chat inset", meta: "/docs/chat" },
      { status: "live", label: "Docs-chat telemetry", meta: "/ops/docs-chat" },
      { status: "mock", label: "~25 docs", meta: "static content" },
      { status: "mock", label: "API refs", meta: "canned JSON" },
    ],
  },
];

const backlogRows: CapabilityRow[] = [
  {
    status: "backlog",
    label: "POST /actions/loop",
    meta: "loop UI uses execute",
  },
  { status: "backlog", label: "POST /revalidate", meta: "UI uses record verify" },
  {
    status: "backlog",
    label: "POST /actions/compose",
    meta: "superseded by staging",
  },
  { status: "backlog", label: "GET /api/ops/scorecard", meta: "superseded by /ops/evals" },
  {
    status: "backlog",
    label: "POST /brief - /context - /verify",
    meta: "debug path",
  },
];

const substrateRows: SubstrateRow[] = [
  { status: "live", label: "Permission filtering", meta: "", result: "real" },
  { status: "live", label: "Approval threshold", meta: "", result: "real" },
  { status: "live", label: "/chat refusal", meta: "", result: "real" },
  {
    status: "live",
    label: "Blocked execution",
    meta: "",
    result: "real - re-gate",
  },
  {
    status: "live",
    label: "Staged remediation card",
    meta: "",
    result: "real - validated",
  },
  {
    status: "live",
    label: "Lifecycle recompute",
    meta: "",
    result: "real event log",
  },
  {
    status: "live",
    label: "Record stale check",
    meta: "",
    result: "real WS-F trigger",
  },
  { status: "live", label: "Eval scorecard", meta: "", result: "real harness" },
  {
    status: "live",
    label: "Docs chat ACL",
    meta: "",
    result: "real - LLM optional",
  },
  {
    status: "mock",
    label: "Owner replies",
    meta: "",
    result: "engine - simulated",
  },
  {
    status: "mock",
    label: "Acme personas",
    meta: "",
    result: "simulated corpus",
  },
];

const statusCopy: Record<Status, { label: string; className: string }> = {
  live: { label: "live-capable", className: "text-emerald-400" },
  mock: { label: "simulated demo", className: "text-amber-400" },
  backlog: { label: "backend exists", className: "text-red-300" },
};

const badgeClasses: Record<BadgeTone, string> = {
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  blue: "border-sky-500/20 bg-sky-500/10 text-sky-300",
};

function StatusIcon({ status, className = "mt-[5px]" }: { status: Status; className?: string }) {
  return (
    <Circle
      className={`${className} h-2 w-2 shrink-0 fill-current stroke-0 ${statusCopy[status].className}`}
      aria-hidden="true"
    />
  );
}

function ChromeIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: "green" | "red" | "zinc" }) {
  const className =
    tone === "green"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : tone === "red"
        ? "border-red-500/20 bg-red-500/10 text-red-300"
        : "border-zinc-700 bg-zinc-950 text-zinc-300";

  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${className}`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function headingId(heading: string) {
  return slugify(heading, new Set<string>());
}

function SurfaceCard({ surface }: { surface: Surface }) {
  return (
    <article
      className={[
        "min-w-0 rounded-lg border bg-zinc-950/45 p-3.5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]",
        surface.liveBorder ? "border-emerald-500/25" : "border-zinc-800",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3
            id={headingId(surface.title)}
            className="truncate text-[14px] font-semibold tracking-tight text-zinc-100"
          >
            {surface.title}
          </h3>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-500">{surface.route}</div>
        </div>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9.5px] font-medium ${badgeClasses[surface.badgeTone]}`}
          data-docs-corpus-skip="true"
        >
          {surface.badge}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {surface.rows.map((row) => (
          <StatusRow key={`${surface.title}-${row.label}`} row={row} />
        ))}
      </div>
    </article>
  );
}

function StatusRow({ row }: { row: CapabilityRow }) {
  return (
    <div className="grid grid-cols-[11px_minmax(0,1fr)] gap-x-1.5 gap-y-0.5 sm:grid-cols-[11px_minmax(0,1fr)_auto]">
      <StatusIcon status={row.status} />
      <div className="min-w-0 text-[11.5px] font-medium leading-snug text-zinc-200">
        {row.label}
      </div>
      <div className="min-w-0 font-mono text-[10.5px] leading-snug text-zinc-500 sm:max-w-[180px] sm:text-right">
        {row.meta}
      </div>
    </div>
  );
}

function WideStatusRow({ row }: { row: CapabilityRow }) {
  return (
    <div className="grid grid-cols-[11px_minmax(0,1fr)] gap-x-1.5 gap-y-0.5 sm:grid-cols-[11px_minmax(0,1fr)_minmax(140px,auto)]">
      <StatusIcon status={row.status} className="mt-[4px]" />
      <div className="min-w-0 font-mono text-[11.5px] font-medium leading-snug text-zinc-200">
        {row.label}
      </div>
      <div className="min-w-0 font-mono text-[10.5px] leading-snug text-zinc-500 sm:text-right">
        {row.meta}
      </div>
    </div>
  );
}

function SubstrateStatusRow({ row }: { row: SubstrateRow }) {
  const resultClass = row.status === "mock" ? "text-amber-300" : "text-emerald-300";

  return (
    <div className="grid grid-cols-[11px_minmax(0,1fr)] gap-x-1.5 gap-y-0.5 sm:grid-cols-[11px_minmax(0,1fr)_minmax(140px,auto)]">
      <StatusIcon status={row.status} className="mt-[4px]" />
      <div className="min-w-0 text-[11.5px] font-medium leading-snug text-zinc-200">
        {row.label}
      </div>
      <div className={`min-w-0 font-mono text-[10.5px] leading-snug sm:text-right ${resultClass}`}>
        {row.result}
      </div>
    </div>
  );
}

function LiveStatusInset() {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-[#101112] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-2.5 border-b border-zinc-800 bg-zinc-950/70 px-3.5 py-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {(Object.keys(statusCopy) as Status[]).map((status) => (
            <div key={status} className="inline-flex items-center gap-1.5 text-[11px] font-medium">
              <StatusIcon status={status} className="mt-0" />
              <span className="text-zinc-300">{statusCopy[status].label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
          <span>live mode: VITE_USE_MOCKS=false + make api</span>
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-500"
            data-docs-corpus-skip="true"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      <div className="grid gap-2.5 p-2.5 lg:grid-cols-2 2xl:grid-cols-3">
        {surfaces.map((surface) => (
          <SurfaceCard key={surface.title} surface={surface} />
        ))}
      </div>

      <div className="border-t border-zinc-800">
        <div className="flex items-center gap-2.5 bg-red-500/12 px-3.5 py-2.5 text-red-200">
          <ChromeIcon icon={Unlink2} tone="red" />
          <h2
            id={headingId("Still built and tested, but no primary UI calls it")}
            className="text-[13px] font-semibold tracking-tight"
          >
            Still built and tested, but no primary UI calls it
          </h2>
        </div>
        <div className="space-y-2 px-3.5 py-3">
          {backlogRows.map((row) => (
            <WideStatusRow key={row.label} row={row} />
          ))}
        </div>
        <div className="flex items-center gap-2.5 border-t border-emerald-500/15 bg-emerald-500/12 px-3.5 py-2.5 text-[11.5px] font-medium text-emerald-300">
          <ChromeIcon icon={Link2} tone="green" />
          <span>
            Newly wired: lifecycle events - staged remediation - docs chat - docs-chat ops
          </span>
        </div>
      </div>

      <div className="border-t border-zinc-800 p-3.5">
        <div className="mb-2.5 flex items-center gap-2.5">
          <ChromeIcon icon={Layers3} tone="zinc" />
          <h2
            id={headingId("Substrate - real vs simulated")}
            className="text-[13px] font-semibold tracking-tight text-zinc-100"
          >
            Substrate - real vs simulated
          </h2>
        </div>
        <div className="space-y-2">
          {substrateRows.map((row) => (
            <SubstrateStatusRow key={row.label} row={row} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TruthCard({
  title,
  children,
  tone = "zinc",
}: {
  title: string;
  children: ReactNode;
  tone?: "emerald" | "amber" | "zinc";
}) {
  const className =
    tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/[0.06]"
      : tone === "amber"
        ? "border-amber-500/25 bg-amber-500/[0.06]"
        : "border-zinc-800 bg-zinc-900/35";

  return (
    <div className={`rounded-lg border p-3.5 ${className}`}>
      <h3 id={headingId(title)} className="text-[13px] font-semibold tracking-tight text-zinc-100">
        {title}
      </h3>
      <div className="mt-2 text-[12.5px] leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}

function BoundarySection() {
  return (
    <section className="border-t border-zinc-900 pt-8">
      <div className="font-mono text-[11px] text-zinc-500" data-docs-corpus-skip="true">
        § 03
      </div>
      <h2
        id={headingId("Demo boundaries")}
        className="mt-3 text-[20px] font-semibold tracking-tight text-zinc-50"
      >
        Demo boundaries
      </h2>
      <p className="mt-2 max-w-[72ch] text-[13.5px] leading-relaxed text-zinc-400">
        These are the three promises behind the live-status map: what the system computes, what the
        demo simulates, and how to switch the UI to gateway-backed mode.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <TruthCard title="Proof boundary" tone="emerald">
          <p>
            Approval-ready is computed from policy, missing approvals, and thresholds. 22% vs. 15%
            is backend logic, not a badge.
          </p>
        </TruthCard>
        <TruthCard title="Demo boundary" tone="amber">
          <p>
            Simulated people advance the flow. They do not rewrite rules; lifecycle, action, and
            verify recompute after each response.
          </p>
        </TruthCard>
        <TruthCard title="Live-mode boundary">
          <p>
            Set <code>VITE_USE_MOCKS=false</code> with the API running to hit gateway paths; mocks
            stay default for repeatability.
          </p>
        </TruthCard>
      </div>
    </section>
  );
}

function StaticSection({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 border-t border-zinc-900 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,480px)] lg:gap-10">
      <div className="min-w-0 space-y-3">
        <div className="font-mono text-[11px] text-zinc-500" data-docs-corpus-skip="true">
          § {label}
        </div>
        <h2 id={headingId(title)} className="text-[20px] font-semibold tracking-tight text-zinc-50">
          {title}
        </h2>
        <div className="max-w-[72ch] space-y-3 text-[13.5px] leading-relaxed text-zinc-400 [&_code]:font-mono [&_code]:text-zinc-300">
          {children}
        </div>
      </div>
    </section>
  );
}

function DocsFooter() {
  return (
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
            <div className="text-[13px] font-semibold tracking-tight text-zinc-100">AI Agents</div>
            <p className="text-[12.5px] leading-relaxed text-zinc-500">
              Conversational Insights Agent - embedded within chat and meeting tools to boost
              productivity.
            </p>
          </div>
          <div className="space-y-3">
            <div className="text-[13px] font-semibold tracking-tight text-zinc-100">Developers</div>
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
  );
}

function WhatsLiveDocsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0c] text-zinc-200">
      <DeveloperDocsHeader />

      <div className="mx-auto block w-full max-w-[1320px] gap-8 px-4 py-8 sm:px-6 md:flex">
        <DocsSidebar />

        <main className="w-full min-w-0 space-y-8 md:flex-1">
          <section className="w-full min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">
              Getting started
            </div>
            <h1
              id={headingId("What's Live")}
              className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-zinc-50"
            >
              What's Live
            </h1>
            <p className="mt-3 max-w-[72ch] text-[14.5px] leading-relaxed text-zinc-400">
              The logic is real. The backend runs the verification, the approval routing, the
              conflict check, and the seal. What's simulated is the other people - when I click
              "Simulate Credit Officer response," I'm standing in for a person who isn't in the
              room. I did that so the demo doesn't depend on live email or a second human. But every
              state change you saw is computed by the system, not written into the screen ahead of
              time.
            </p>
          </section>

          <Callout title="How to read the demo">
            <p>
              Green rows are wired to live-capable backend or gateway paths. Amber rows are
              deterministic demo playback or client-side simulation. Red rows are implemented
              backend paths that are not on the primary UI journey for the walkthrough.
            </p>
          </Callout>

          <LiveStatusInset />

          <StaticSection label="01" title="What is real">
            <p>
              Verification, approval thresholds, action diffs, blocked execution, lifecycle
              recompute, governed-record minting, record verification, docs chat access control, and
              eval scoring all run through actual backend or deterministic substrate logic. Mock
              mode keeps the demo stable, but it does not hardcode the decision states into the
              screen.
            </p>
          </StaticSection>

          <StaticSection label="02" title="What is simulated">
            <p>
              The simulated pieces are mostly human latency and demo furniture: Credit Officer,
              Legal, and Customer Success replies; thinking animations; participant rails; and a few
              tenant-local toggles. Those states exist so the walkthrough can be run alone, without
              live email, a second operator, or waiting for external people to respond.
            </p>
          </StaticSection>

          <BoundarySection />

          <RelatedLinks
            links={[
              {
                label: "Roadmap",
                to: "/developers/roadmap",
                description: "How the live proof maps back to the phased build.",
              },
              {
                label: "Deterministic Gating",
                to: "/developers/gating",
                description: "The policy checkpoint that makes the live action path safe.",
              },
            ]}
          />
        </main>
      </div>

      <DocsFooter />
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { gatingExamples, gatingNav, type GatingExample, type GatingVertical } from "@/data/gating";

export const Route = createFileRoute("/developers/gating")({
  head: () => ({
    meta: [
      { title: "Deterministic Gating - ConnectWork Platform API" },
      {
        name: "description",
        content:
          "Policy Artifact, Evaluate, and Replay - three deterministic gating objects extending the ConnectWork Platform API before agent actions commit.",
      },
    ],
  }),
  component: GatingDocsPage,
});

const VERTICALS: GatingVertical[] = ["finance", "legal", "health"];

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      className={[
        "inline-flex h-5 items-center rounded border px-1.5 font-mono text-[10.5px] font-semibold tracking-wider",
        method === "POST"
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
          : "border-sky-500/30 bg-sky-500/15 text-sky-300",
      ].join(" ")}
    >
      {method}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-6 items-center gap-1 rounded border border-zinc-700/70 bg-zinc-800/60 px-2 text-[10.5px] font-medium text-zinc-300 transition-colors hover:bg-zinc-700/60 hover:text-zinc-100"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJson(value: string) {
  return escapeHtml(value).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?\b/g,
    (match, quoted: string | undefined, colon: string | undefined, keyword: string | undefined) => {
      if (quoted) {
        return colon
          ? `<span class="text-sky-300">${quoted}</span>${colon}`
          : `<span class="text-amber-200/90">${quoted}</span>`;
      }
      if (keyword) return `<span class="text-violet-300">${keyword}</span>`;
      return `<span class="text-emerald-300">${match}</span>`;
    },
  );
}

function CodeBlock({
  method,
  path,
  headers,
  body,
  title,
}: {
  method?: "GET" | "POST";
  path?: string;
  headers?: Record<string, string>;
  body?: unknown;
  title?: string;
}) {
  const bodyText = useMemo(() => (body === undefined ? "" : JSON.stringify(body, null, 2)), [body]);
  const headerText = headers
    ? Object.entries(headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")
    : "";
  const copyText = [method && path ? `${method} ${path}` : "", headerText, bodyText]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-zinc-800 bg-[#0d0d0f] shadow-[0_1px_0_rgba(255,255,255,0.02)_inset]">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/40 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {method && <MethodBadge method={method} />}
          {path && <span className="truncate font-mono text-[12px] text-zinc-300">{path}</span>}
          {!path && title && (
            <span className="truncate text-[11.5px] font-medium uppercase tracking-wider text-zinc-400">
              {title}
            </span>
          )}
        </div>
        <CopyButton value={copyText} />
      </div>
      <pre className="max-h-[520px] max-w-full overflow-auto px-4 py-3 font-mono text-[12px] leading-[1.55] text-zinc-200">
        {headerText && <code className="block whitespace-pre text-zinc-400">{headerText}</code>}
        {headerText && bodyText && <code className="block">{"\n"}</code>}
        {bodyText && (
          <code
            className="block whitespace-pre"
            dangerouslySetInnerHTML={{ __html: highlightJson(bodyText) }}
          />
        )}
      </pre>
    </div>
  );
}

function EndpointList({
  endpoints,
}: {
  endpoints: Array<{ method: "GET" | "POST"; path: string }>;
}) {
  return (
    <ul className="space-y-1.5">
      {endpoints.map((endpoint) => (
        <li key={`${endpoint.method}-${endpoint.path}`} className="flex items-center gap-2">
          <MethodBadge method={endpoint.method} />
          <code className="font-mono text-[12px] text-zinc-300">{endpoint.path}</code>
        </li>
      ))}
    </ul>
  );
}

function ArtifactStates() {
  const states = ["Draft", "In review", "Replay passed", "Active", "Rolled back"];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      {states.map((state, index) => (
        <div key={state} className="flex items-center gap-2">
          <span
            className={[
              "inline-flex h-6 items-center rounded border px-2 text-[11px] font-medium",
              index === 3
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                : "border-zinc-800 bg-zinc-900 text-zinc-400",
            ].join(" ")}
          >
            {state}
          </span>
          {index < states.length - 1 && <span className="text-zinc-600">-&gt;</span>}
        </div>
      ))}
    </div>
  );
}

function DocsSection({
  number,
  title,
  subtitle,
  prose,
  code,
}: {
  number: string;
  title: string;
  subtitle: string;
  prose: ReactNode;
  code: ReactNode;
}) {
  return (
    <section
      className="grid min-w-0 grid-cols-1 gap-6 border-t border-zinc-900 pt-10 lg:grid-cols-[1fr_minmax(0,520px)] lg:gap-10"
      style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}
    >
      <div className="min-w-0 space-y-3">
        <div className="font-mono text-[11px] text-zinc-500">§{number}</div>
        <h2 className="text-[22px] font-semibold tracking-tight text-zinc-50">
          {title} <span className="text-[14px] font-normal text-zinc-500">- {subtitle}</span>
        </h2>
        <div className="max-w-[300px] space-y-3 text-[13.5px] leading-relaxed text-zinc-400 sm:max-w-none [&_code]:font-mono">
          {prose}
        </div>
      </div>
      <div className="min-w-0 lg:pt-10">{code}</div>
    </section>
  );
}

function PolicyDiagram({ example }: { example: GatingExample }) {
  const { trace } = example;

  return (
    <svg
      className="block h-auto w-full max-w-full"
      width="100%"
      viewBox="0 0 680 360"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
    >
      <title>Deterministic policy: encode the policy you already have</title>
      <defs>
        <marker
          id="pd-arr"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path
            d="M2 1L8 5L2 9"
            fill="none"
            stroke="#6b6b70"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
      <rect x="0" y="0" width="680" height="360" rx="14" fill="#0d0d0f" stroke="#1e1e22" />
      <g transform="translate(0, -14)">
        <g>
          <rect x="40" y="40" width="132" height="56" rx="9" fill="#102b25" stroke="#1D9E75" />
          <text x="106" y="64" textAnchor="middle" fill="#C8F2E2" fontSize="14" fontWeight="600">
            Your Policy
          </text>
          <text x="106" y="82" textAnchor="middle" fill="#9FE1CB" fontSize="11.5">
            PDFs, websites, code
          </text>
        </g>
        <line
          x1="176"
          y1="68"
          x2="192"
          y2="68"
          stroke="#6b6b70"
          strokeWidth="1.5"
          markerEnd="url(#pd-arr)"
        />
        <g>
          <rect x="196" y="40" width="132" height="56" rx="9" fill="#102b25" stroke="#1D9E75" />
          <text x="262" y="64" textAnchor="middle" fill="#C8F2E2" fontSize="14" fontWeight="600">
            Policy Artifact
          </text>
          <text x="262" y="82" textAnchor="middle" fill="#9FE1CB" fontSize="11.5">
            Bound + signed
          </text>
        </g>
        <line
          x1="332"
          y1="68"
          x2="348"
          y2="68"
          stroke="#6b6b70"
          strokeWidth="1.5"
          markerEnd="url(#pd-arr)"
        />
        <g>
          <rect x="352" y="40" width="132" height="56" rx="9" fill="#1c1c1f" stroke="#5F5E5A" />
          <text x="418" y="64" textAnchor="middle" fill="#EDEBE3" fontSize="14" fontWeight="600">
            ConnectWork
          </text>
          <text x="418" y="82" textAnchor="middle" fill="#D3D1C7" fontSize="11.5">
            Deterministic Engine
          </text>
        </g>
        <line
          x1="488"
          y1="68"
          x2="504"
          y2="68"
          stroke="#6b6b70"
          strokeWidth="1.5"
          markerEnd="url(#pd-arr)"
        />
        <g>
          <rect x="508" y="40" width="132" height="56" rx="9" fill="#2a1f06" stroke="#BA7517" />
          <text x="574" y="64" textAnchor="middle" fill="#FBD79A" fontSize="14" fontWeight="600">
            Trace
          </text>
          <text x="574" y="82" textAnchor="middle" fill="#FAC775" fontSize="11.5">
            Reproducible
          </text>
        </g>
        <line
          x1="574"
          y1="96"
          x2="574"
          y2="116"
          stroke="#6b6b70"
          strokeWidth="1.5"
          markerEnd="url(#pd-arr)"
        />
        <rect x="180" y="118" width="460" height="100" rx="10" fill="#2a1f06" stroke="#BA7517" />
        <text x="200" y="142" fill="#FBD79A" fontSize="13" fontWeight="600">
          {trace.title}
        </text>
        <text
          x="200"
          y="168"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize="12"
        >
          <tspan fill="#E8C99A">{trace.firstLine} -&gt; </tspan>
          <tspan fill="#F09595" fontWeight="600">
            {trace.firstBadge}
          </tspan>
        </text>
        <text
          x="200"
          y="188"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize="12"
        >
          <tspan fill="#E8C99A">{trace.secondLine} -&gt; </tspan>
          <tspan fill="#FAC775" fontWeight="600">
            {trace.secondBadge}
          </tspan>
        </text>
        <text
          x="200"
          y="208"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontSize="12"
          fill="#C9C7BF"
        >
          {trace.finalLine}
        </text>
        <text x="40" y="244" fill="#B5B4AD" fontSize="12">
          ConnectWork ships the engine and rule types. Customers own the policy values.
        </text>
        <text x="40" y="262" fill="#B5B4AD" fontSize="12">
          Developers or AI Studio publish versioned Policy Artifacts.
        </text>
        <text x="40" y="290" fill="#8A8A84" fontSize="12">
          Full pre-deployment simulation
        </text>
        <g>
          <rect x="40" y="300" width="176" height="30" rx="8" fill="#161618" stroke="#34343a" />
          <text x="128" y="319" textAnchor="middle" fill="#D9D8D2" fontSize="13">
            Backtest on history
          </text>
        </g>
        <line
          x1="216"
          y1="315"
          x2="244"
          y2="315"
          stroke="#6b6b70"
          strokeWidth="1.5"
          markerEnd="url(#pd-arr)"
        />
        <g>
          <rect x="248" y="300" width="120" height="30" rx="8" fill="#161618" stroke="#34343a" />
          <text x="308" y="319" textAnchor="middle" fill="#D9D8D2" fontSize="13">
            Shadow mode
          </text>
        </g>
        <line
          x1="368"
          y1="315"
          x2="396"
          y2="315"
          stroke="#6b6b70"
          strokeWidth="1.5"
          markerEnd="url(#pd-arr)"
        />
        <g>
          <rect x="400" y="300" width="100" height="30" rx="8" fill="#161618" stroke="#34343a" />
          <text x="450" y="319" textAnchor="middle" fill="#D9D8D2" fontSize="13">
            Enforce
          </text>
        </g>
        <rect x="40" y="348" width="10" height="10" rx="2" fill="#1D9E75" />
        <text x="56" y="357" fill="#B5B4AD" fontSize="12">
          Customer-owned
        </text>
        <rect x="210" y="348" width="10" height="10" rx="2" fill="#6f6e69" />
        <text x="226" y="357" fill="#B5B4AD" fontSize="12">
          ConnectWork engine
        </text>
        <rect x="400" y="348" width="10" height="10" rx="2" fill="#BA7517" />
        <text x="416" y="357" fill="#B5B4AD" fontSize="12">
          Auditable trace
        </text>
      </g>
    </svg>
  );
}

function GatingDocsPage() {
  const [vertical, setVertical] = useState<GatingVertical>("finance");
  const example = gatingExamples[vertical];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0c] text-zinc-200">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#0a0a0c]/85 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to="/ops"
              className="inline-flex h-7 items-center gap-1 rounded border border-zinc-800 bg-zinc-900/60 px-2 text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              <ArrowLeft className="h-3 w-3" />
              Agent Ops
            </Link>
            <span className="truncate text-[13px] font-semibold tracking-tight text-zinc-100">
              ConnectWork Platform API
            </span>
            <span className="inline-flex h-5 items-center rounded border border-zinc-700 bg-zinc-900 px-1.5 font-mono text-[10.5px] text-zinc-300">
              v2
            </span>
          </div>
          <div className="hidden text-[11.5px] text-zinc-500 sm:block">
            developers.connectwork.com
          </div>
        </div>
      </header>

      <div className="mx-auto block w-full max-w-[1320px] gap-8 px-4 py-8 sm:px-6 md:flex">
        <aside className="sticky top-[64px] hidden h-[calc(100vh-80px)] w-56 shrink-0 overflow-y-auto pr-2 md:block">
          <nav className="space-y-6">
            {gatingNav.map((section) => (
              <div key={section.label}>
                <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                  {section.label}
                </div>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item}>
                      {item === "Deterministic Gating" ? (
                        <span className="relative block rounded px-2 py-1 text-[12.5px] font-medium text-zinc-100">
                          <span className="absolute inset-y-1 left-0 w-[2px] rounded bg-emerald-400" />
                          <span className="pl-2">{item}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="block w-full cursor-default rounded px-2 py-1 text-left text-[12.5px] text-zinc-500 hover:text-zinc-300"
                        >
                          {item}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="w-full min-w-0 space-y-12 md:flex-1">
          <section style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">
              Governance
            </div>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-zinc-50">
              Deterministic Gating
            </h1>
            <p className="mt-3 max-w-[300px] text-[14px] leading-relaxed text-zinc-400 sm:max-w-[68ch]">
              Agents built on Anthropic, OpenAI, or Gemini route their action requests through our
              existing API. Deterministic policy gates then apply before any write, workflow
              transition, or approval state can commit.
            </p>
            <p className="mt-3 max-w-[300px] text-[14px] leading-relaxed text-zinc-400 sm:max-w-[68ch]">
              ConnectWork already governs who an agent may act for; gating governs whether a
              specific action is allowed to commit.
            </p>

            <div className="mt-5 inline-flex max-w-full flex-wrap items-center rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
              {VERTICALS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setVertical(item)}
                  className={[
                    "h-7 rounded-md px-3 text-[12px] font-medium capitalize transition-colors",
                    vertical === item
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-400 hover:text-zinc-200",
                  ].join(" ")}
                >
                  {item}
                </button>
              ))}
              <span className="ml-2 mr-2 text-[10.5px] text-zinc-500">swaps every example</span>
            </div>

            <div className="mt-6 w-full max-w-full overflow-hidden rounded-[14px]">
              <PolicyDiagram example={example} />
            </div>
          </section>

          <section
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
            style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
              How this fits with Agent Ops
            </div>
            <p className="mt-1.5 max-w-[300px] text-[13px] leading-relaxed text-zinc-300 sm:max-w-[68ch]">
              Agent Ops shows which Policy Artifact is active, which rules fired, and which version
              is live. This API lets developers create, test, replay, and publish the same policy
              artifacts.
            </p>
          </section>

          <section
            className="rounded-lg border-l-2 border-emerald-400/80 bg-emerald-400/[0.06] p-4"
            style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}
          >
            <p className="max-w-[300px] text-[13px] leading-relaxed text-emerald-100/90 sm:max-w-[68ch]">
              <span className="font-semibold text-emerald-200">
                Enforcement is a checkpoint, not an opt-in call.
              </span>{" "}
              The gate sits on the write/commit path. The API is for authoring policy and submitting
              action proposals for evaluation - an agent cannot route around the gate by declining
              to call it.
            </p>
          </section>

          <DocsSection
            number="1"
            title="Policy Artifact"
            subtitle="policy-as-data"
            prose={
              <>
                <p>
                  Create, version, and retrieve deterministic policy as a typed object. Policy
                  Artifacts can be attached to Agent Recipes and Work Product Contracts.
                </p>
                <EndpointList
                  endpoints={[
                    { method: "POST", path: "/v2/gating/policy-artifacts" },
                    { method: "GET", path: "/v2/gating/policy-artifacts/{id}" },
                    { method: "GET", path: "/v2/gating/policy-artifacts/{id}/versions" },
                  ]}
                />
                <ArtifactStates />
                <p className="text-[12px] text-zinc-500">
                  Transition to <span className="text-zinc-300">Active</span> is blocked unless the
                  EvalPack passes. Version history returns prior policy artifacts; rollback
                  re-activates a prior version.
                </p>
              </>
            }
            code={<CodeBlock title="policy_artifact" body={example.policyArtifact} />}
          />

          <DocsSection
            number="2"
            title="Evaluate"
            subtitle="the gate as a service"
            prose={
              <>
                <p>
                  <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-[12px] text-zinc-200">
                    POST /v2/gating/evaluate
                  </code>{" "}
                  is the pre-commit evaluation endpoint. The platform invokes it automatically on
                  action proposals; developers can also call it for preflight checks.
                </p>
                <p>
                  Firings report <code className="text-zinc-300">result</code> and{" "}
                  <code className="text-zinc-300">blocks_commit</code> - no ambiguous{" "}
                  <code>passed</code> field.
                </p>
              </>
            }
            code={
              <div className="space-y-3">
                <CodeBlock
                  method="POST"
                  path="/v2/gating/evaluate"
                  headers={{
                    "Idempotency-Key": "action_123",
                    "X-ConnectWork-Actor":
                      vertical === "finance" ? "dana" : vertical === "legal" ? "marcus" : "priya",
                  }}
                  body={example.evaluateRequest}
                />
                <CodeBlock title="200 OK - compliance_trace" body={example.evaluateResponse} />
              </div>
            }
          />

          <DocsSection
            number="2.1"
            title="Errors"
            subtitle="blocked commits"
            prose={
              <p>
                When the platform invokes the gate and a rule blocks the write, callers see a{" "}
                <code className="text-zinc-300">policy_gate_failed</code> error with the firing rule
                code and a trace id for the matching ComplianceTrace.
              </p>
            }
            code={<CodeBlock title="409 - policy_gate_failed" body={example.errorExample} />}
          />

          <DocsSection
            number="3"
            title="Replay"
            subtitle="blast-radius simulator"
            prose={
              <>
                <p>
                  Validate a process at scale, not just a prompt. Replay a draft Policy Artifact
                  across a historical corpus and get a readiness report covering block rate, leaks,
                  regression, and <code className="text-zinc-300">approval_burden</code> - the
                  buyer-facing economics number.
                </p>
                <EndpointList endpoints={[{ method: "POST", path: "/v2/gating/replay" }]} />
              </>
            }
            code={
              <div className="space-y-3">
                <CodeBlock method="POST" path="/v2/gating/replay" body={example.replayRequest} />
                <CodeBlock title="200 OK - readiness_report" body={example.replayResponse} />
              </div>
            }
          />
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

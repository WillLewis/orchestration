import { Link } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { DeveloperDocsHeader } from "@/components/docs/DeveloperDocsHeader";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import type { LiveDocsRoute } from "@/data/docsNav";
import { slugify } from "@/lib/docs-slug";

export type Endpoint = { method: "GET" | "POST"; path: string; note?: string };
export type RelatedLink = { label: string; to: LiveDocsRoute; description: string };
export type TableColumn = { key: string; label: string; align?: "left" | "right" };
export type TableRow = Record<string, ReactNode>;

type DocsHeadingIdFactory = (heading: string) => string;

const DocsHeadingContext = createContext<DocsHeadingIdFactory | null>(null);

export function DocsHeadingScope({ children }: { children: ReactNode }) {
  const seen = new Set<string>();
  const anchorForHeading = (heading: string) => slugify(heading, seen);

  return (
    <DocsHeadingContext.Provider value={anchorForHeading}>{children}</DocsHeadingContext.Provider>
  );
}

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join(" ");
  return "";
}

export function DocsHeading({
  level,
  className,
  children,
  anchorText,
}: {
  level: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
  anchorText?: string;
}) {
  const anchorForHeading = useContext(DocsHeadingContext);
  const heading = anchorText ?? textFromNode(children);
  const id = anchorForHeading ? anchorForHeading(heading) : slugify(heading, new Set<string>());

  if (level === 1) {
    return (
      <h1 id={id} className={className}>
        {children}
      </h1>
    );
  }

  if (level === 2) {
    return (
      <h2 id={id} className={className}>
        {children}
      </h2>
    );
  }

  return (
    <h3 id={id} className={className}>
      {children}
    </h3>
  );
}

export function DocsPageShell({
  eyebrow,
  title,
  description,
  children,
  related,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
  related?: RelatedLink[];
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0c] text-zinc-200">
      <DeveloperDocsHeader />

      <div className="mx-auto block w-full max-w-[1320px] gap-8 px-4 py-8 sm:px-6 md:flex">
        <DocsSidebar />

        <DocsHeadingScope>
          <main className="w-full min-w-0 space-y-8 md:flex-1">
            <section className="w-full min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">
                {eyebrow}
              </div>
              <DocsHeading
                level={1}
                className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-zinc-50"
              >
                {title}
              </DocsHeading>
              <div className="mt-3 max-w-[72ch] text-[14.5px] leading-relaxed text-zinc-400">
                {description}
              </div>
            </section>

            {children}

            {related && related.length > 0 && <RelatedLinks links={related} />}
          </main>
        </DocsHeadingScope>
      </div>

      <DocsFooter />
    </div>
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

export function DocsSection({
  label,
  title,
  children,
  aside,
}: {
  label?: string;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-6 border-t border-zinc-900 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,480px)] lg:gap-10">
      <div className="min-w-0 space-y-3">
        {label && (
          <div className="font-mono text-[11px] text-zinc-500" data-docs-corpus-skip="true">
            § {label}
          </div>
        )}
        <DocsHeading level={2} className="text-[20px] font-semibold tracking-tight text-zinc-50">
          {title}
        </DocsHeading>
        <div className="max-w-[72ch] space-y-3 text-[13.5px] leading-relaxed text-zinc-400 [&_code]:font-mono [&_code]:text-zinc-300">
          {children}
        </div>
      </div>
      {aside && <div className="min-w-0 lg:pt-8">{aside}</div>}
    </section>
  );
}

export function Callout({
  title,
  children,
  tone = "emerald",
}: {
  title?: string;
  children: ReactNode;
  tone?: "emerald" | "zinc" | "amber";
}) {
  const cls =
    tone === "amber"
      ? "border-amber-400/70 bg-amber-400/[0.06] text-amber-100/90"
      : tone === "zinc"
        ? "border-zinc-700 bg-zinc-900/50 text-zinc-300"
        : "border-emerald-400/80 bg-emerald-400/[0.06] text-emerald-100/90";

  return (
    <section className={`rounded-lg border-l-2 p-4 ${cls}`}>
      {title && (
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-emerald-300/90">
          {title}
        </div>
      )}
      <div className="max-w-[76ch] text-[13.5px] leading-relaxed">{children}</div>
    </section>
  );
}

export function MethodBadge({ method }: { method: "GET" | "POST" }) {
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

export function CodeBlock({
  method,
  path,
  headers,
  body,
  title,
  text,
}: {
  method?: "GET" | "POST";
  path?: string;
  headers?: Record<string, string>;
  body?: unknown;
  title?: string;
  text?: string;
}) {
  const bodyText = useMemo(() => {
    if (text !== undefined) return text;
    return body === undefined ? "" : JSON.stringify(body, null, 2);
  }, [body, text]);
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

export function EndpointList({ endpoints }: { endpoints: Endpoint[] }) {
  return (
    <ul className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      {endpoints.map((endpoint) => (
        <li key={`${endpoint.method}-${endpoint.path}`} className="flex flex-col gap-1 sm:flex-row">
          <div className="flex min-w-0 items-center gap-2">
            <MethodBadge method={endpoint.method} />
            <code className="break-all font-mono text-[12px] text-zinc-300">{endpoint.path}</code>
          </div>
          {endpoint.note && (
            <span className="text-[12px] leading-relaxed text-zinc-500 sm:ml-auto sm:text-right">
              {endpoint.note}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DataTable({
  columns,
  rows,
  dense = false,
}: {
  columns: TableColumn[];
  rows: TableRow[];
  dense?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-zinc-900/70 text-left text-zinc-400">
            {columns.map((column) => (
              <th
                key={column.key}
                className={[
                  dense ? "px-3 py-2" : "px-3 py-2.5",
                  "font-semibold",
                  column.align === "right" ? "text-right" : "text-left",
                ].join(" ")}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-zinc-900">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={[
                    dense ? "px-3 py-2" : "px-3 py-2.5",
                    column.align === "right" ? "text-right" : "text-left",
                    "text-zinc-300",
                  ].join(" ")}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatGrid({
  stats,
}: {
  stats: Array<{ label: string; value: ReactNode; detail: ReactNode }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
            {stat.label}
          </div>
          <div className="mt-2 text-[22px] font-semibold tracking-tight text-zinc-50">
            {stat.value}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">{stat.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function FlowSteps({
  steps,
}: {
  steps: Array<{ label: string; title: string; detail: ReactNode }>;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.label} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 font-mono text-[12px] font-semibold text-emerald-300">
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                {step.label}
              </div>
              <div className="mt-0.5 text-[13.5px] font-semibold text-zinc-100">{step.title}</div>
              <div className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">{step.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SignalList({
  items,
}: {
  items: Array<{ title: ReactNode; detail: ReactNode; tone?: "ok" | "warn" | "block" }>;
}) {
  return (
    <ul className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      {items.map((item, index) => (
        <li
          key={index}
          className={["flex gap-3 p-3", index > 0 ? "border-t border-zinc-900" : ""].join(" ")}
        >
          <span
            className={[
              "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full",
              item.tone === "block"
                ? "bg-red-300"
                : item.tone === "warn"
                  ? "bg-amber-300"
                  : "bg-emerald-400",
            ].join(" ")}
          />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-zinc-100">{item.title}</div>
            <div className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">{item.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RelatedLinks({ links }: { links: RelatedLink[] }) {
  return (
    <section className="border-t border-zinc-900 pt-8" data-docs-corpus-skip="true">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
        Related
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/[0.05]"
          >
            <div className="text-[13.5px] font-semibold text-zinc-100">{link.label}</div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">{link.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function DocLink({ to, children }: { to: LiveDocsRoute; children: ReactNode }) {
  return (
    <Link to={to} className="text-emerald-300 underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

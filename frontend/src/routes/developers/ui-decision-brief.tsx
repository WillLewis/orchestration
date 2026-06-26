import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

import { DocsPageShell } from "@/components/docs/DocsPage";
import { ProductFrame } from "@/components/docs/ProductFrame";

export const Route = createFileRoute("/developers/ui-decision-brief")({
  head: () => ({
    meta: [
      { title: "Decision Brief Interface - ConnectWork Platform API" },
      {
        name: "description",
        content:
          "Decision Brief generation shell for permission-aware ConnectAgent documentation retrieval.",
      },
    ],
  }),
  component: UiDecisionBriefDocsPage,
});

const examples = [
  "How does the policy gate decide `blocks_commit`?",
  "Why private-first responses instead of intersection permissions?",
  "Did the deterministic gate survive override attempts?",
];

function PlaceholderInset() {
  return (
    <div className="grid h-full min-h-[360px] bg-background lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="min-w-0 border-b border-border bg-[var(--canvas)] p-5 lg:border-b-0 lg:border-r">
        <div className="mx-auto max-w-2xl rounded-md border border-border bg-card p-6 shadow-card">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-fg)]">
            Generated brief
          </div>
          <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-foreground">
            Docs governance decision brief
          </h3>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--secondary-text)]">
            Placeholder generated brief. WS4 will replace this slot with the docs chat result and
            suggested questions from the decision brief surface.
          </p>
          <div className="mt-5 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-bg)] p-3 text-[12.5px] leading-relaxed text-foreground">
            The command is treated as a generate action; cited source access still controls what can
            appear in the draft.
          </div>
        </div>
      </article>
      <aside className="flex min-h-[300px] flex-col bg-background">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-semibold text-foreground">ConnectAgent command</span>
        </div>
        <div className="flex-1 space-y-3 bg-[var(--canvas)] p-4">
          <div className="rounded-lg border border-border bg-card p-3 text-[12.5px] leading-relaxed text-[var(--secondary-text)] shadow-card">
            Generate a decision brief from docs evidence.
          </div>
          <div className="rounded-lg border border-primary/25 bg-[var(--primary-tint)] p-3 text-[12.5px] leading-relaxed text-foreground">
            Placeholder response with access-aware citations.
          </div>
        </div>
      </aside>
    </div>
  );
}

function UiDecisionBriefDocsPage() {
  return (
    <DocsPageShell
      eyebrow="Interfaces"
      title="Decision Brief UI"
      description={
        <p>
          A generate-action surface for turning docs-grounded retrieval into a governed decision
          brief draft.
        </p>
      }
      related={[{ label: "RAG", to: "/developers/rag", description: "How retrieval is gated." }]}
    >
      <ProductFrame
        surface="Decision brief generation"
        title="Docs evidence into a governed draft"
        subtitle="A command asks ConnectAgent to generate a brief while the same retrieval gates decide which source content can shape the draft."
      >
        <PlaceholderInset />
      </ProductFrame>

      <section className="space-y-3 border-t border-zinc-900 pt-7">
        <div className="max-w-[72ch] space-y-3 text-[13.5px] leading-relaxed text-zinc-400">
          <p>
            The decision brief surface treats the message as a generate command, not a casual
            Q&amp;A turn. The draft can cite open and sealed derivatives, but locked source content
            remains outside the generation path.
          </p>
          <p>
            See{" "}
            <Link
              to="/developers/rag"
              className="text-emerald-300 underline-offset-2 hover:underline"
            >
              how RAG works
            </Link>{" "}
            for the full pipeline.
          </p>
        </div>
        <ExampleButtons />
      </section>
    </DocsPageShell>
  );
}

function ExampleButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      {examples.map((example) => (
        <button
          key={example}
          type="button"
          className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-left text-[12.5px] font-medium leading-snug text-zinc-300 transition-colors hover:border-emerald-400/40 hover:text-zinc-50"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
          <span>{example}</span>
        </button>
      ))}
      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-zinc-800 px-3 py-2 text-[12.5px] text-zinc-500">
        <LockKeyhole className="h-3.5 w-3.5" />
        Static examples
      </span>
    </div>
  );
}

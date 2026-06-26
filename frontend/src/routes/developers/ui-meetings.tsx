import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, LockKeyhole, ShieldCheck, Sparkles, Users } from "lucide-react";

import { DocsPageShell } from "@/components/docs/DocsPage";
import { ProductFrame } from "@/components/docs/ProductFrame";

export const Route = createFileRoute("/developers/ui-meetings")({
  head: () => ({
    meta: [
      { title: "Meetings Interface - ConnectWork Platform API" },
      {
        name: "description",
        content: "Meeting rail shell for permission-aware ConnectAgent documentation retrieval.",
      },
    ],
  }),
  component: UiMeetingsDocsPage,
});

const examples = [
  "How does the policy gate decide `blocks_commit`?",
  "Why private-first responses instead of intersection permissions?",
  "Did the deterministic gate survive override attempts?",
];

function PlaceholderInset() {
  return (
    <div className="grid h-full min-h-[360px] bg-background lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--primary-tint)] text-primary">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-foreground">
                Product review sync
              </div>
              <div className="text-[11px] text-[var(--muted-fg)]">Live docs walkthrough</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--danger)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
            Live
          </span>
        </div>
        <div className="flex-1 bg-[var(--canvas)] p-5">
          <div className="h-full rounded-md border border-border bg-card p-5 shadow-card">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-fg)]">
              Shared document
            </div>
            <h3 className="mt-2 text-[17px] font-semibold text-foreground">
              Permission-aware docs retrieval
            </h3>
            <p className="mt-3 max-w-[58ch] text-[13px] leading-relaxed text-[var(--secondary-text)]">
              Placeholder meeting content. WS4 will compose the docs inset into the rail while the
              shared document remains readable.
            </p>
          </div>
        </div>
      </div>
      <aside className="flex min-h-[300px] flex-col bg-background">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-semibold text-foreground">ConnectAgent rail</span>
        </div>
        <div className="flex-1 bg-[var(--canvas)] p-4">
          <div className="rounded-lg border border-primary/25 bg-[var(--primary-tint)] p-3 text-[12.5px] leading-relaxed text-foreground">
            Private answer placeholder for the meeting attendee who asked.
          </div>
        </div>
      </aside>
    </div>
  );
}

function UiMeetingsDocsPage() {
  return (
    <DocsPageShell
      eyebrow="Interfaces"
      title="Meetings"
      description={
        <p>
          A meeting rail for asking ConnectAgent about docs while the source discussion stays in
          view.
        </p>
      }
      related={[{ label: "RAG", to: "/developers/rag", description: "How retrieval is gated." }]}
    >
      <ProductFrame
        surface="Meeting rail"
        title="Docs answer beside a live meeting"
        subtitle="A participant can ask in the rail and receive a permission-scoped answer without leaking restricted context to everyone in the call."
      >
        <PlaceholderInset />
      </ProductFrame>

      <section className="space-y-3 border-t border-zinc-900 pt-7">
        <div className="max-w-[72ch] space-y-3 text-[13.5px] leading-relaxed text-zinc-400">
          <p>
            The meetings surface keeps the response in the asker&apos;s rail, next to the shared
            document and participant context. Open, sealed, and locked citations stay visible as
            access states instead of being flattened into a single answer.
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

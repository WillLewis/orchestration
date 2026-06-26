import { createFileRoute, Link } from "@tanstack/react-router";
import { LockKeyhole, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";

import { DocsPageShell } from "@/components/docs/DocsPage";
import { ProductFrame } from "@/components/docs/ProductFrame";

export const Route = createFileRoute("/developers/ui-chat")({
  head: () => ({
    meta: [
      { title: "Chat Interface - ConnectWork Platform API" },
      {
        name: "description",
        content: "Slack-like ConnectAgent chat shell for permission-aware documentation retrieval.",
      },
    ],
  }),
  component: UiChatDocsPage,
});

const examples = [
  "How does the policy gate decide `blocks_commit`?",
  "Why private-first responses instead of intersection permissions?",
  "Did the deterministic gate survive override attempts?",
];

function PlaceholderInset() {
  return (
    <div className="flex h-full min-h-[360px] flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--primary-tint)] text-primary">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground"># policy-review</div>
            <div className="text-[11px] text-[var(--muted-fg)]">
              Private-first replies before sharing to thread
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--info-bg)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--info)]">
          <ShieldCheck className="h-3 w-3" />
          Governed
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-hidden bg-[var(--canvas)] p-4">
        <div className="max-w-[78%] rounded-lg border border-border bg-card p-3 text-[12.5px] leading-relaxed text-foreground shadow-card">
          <span className="font-semibold">@Agent</span> why did the policy gate hold the commit?
        </div>
        <div className="ml-auto max-w-[86%] rounded-lg border border-primary/25 bg-[var(--primary-tint)] p-3 text-[12.5px] leading-relaxed text-foreground">
          Placeholder docs answer. WS4 will replace this slot with the live DocsChatInset.
        </div>
      </div>
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="rounded-full border border-border bg-card px-4 py-2 text-[12px] text-[var(--muted-fg)] shadow-card">
          Ask @Agent about the docs corpus...
        </div>
      </div>
    </div>
  );
}

function UiChatDocsPage() {
  return (
    <DocsPageShell
      eyebrow="Interfaces"
      title="Chat"
      description={
        <p>
          A Slack-like surface for asking ConnectAgent about the documentation corpus from inside a
          live team thread.
        </p>
      }
      related={[{ label: "RAG", to: "/developers/rag", description: "How retrieval is gated." }]}
    >
      <ProductFrame
        surface="Channel chat"
        title="Docs answer in a team thread"
        subtitle="Mention @Agent in the channel, receive a permission-scoped answer privately, then decide whether it should be shared."
      >
        <PlaceholderInset />
      </ProductFrame>

      <section className="space-y-3 border-t border-zinc-900 pt-7">
        <div className="max-w-[72ch] space-y-3 text-[13.5px] leading-relaxed text-zinc-400">
          <p>
            The chat surface keeps restricted retrieval private-first, so the asker can inspect
            sealed or locked citations before anything appears in a shared thread. Every answer
            remains grounded in the docs corpus and carries access-aware source chips.
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

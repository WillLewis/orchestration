import { createFileRoute, Link } from "@tanstack/react-router";

import { DocsPageShell } from "@/components/docs/DocsPage";
import { DocsChatInset } from "@/components/docs/DocsChatInset";

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

function UiChatDocsPage() {
  return (
    <DocsPageShell
      eyebrow="Interfaces"
      title="Chat"
      description={
        <p>
          Ask ConnectAgent about the docs from inside a live team thread — answers come back
          permission-scoped and private to you until you choose to share them.
        </p>
      }
      related={[{ label: "RAG", to: "/developers/rag", description: "How retrieval is gated." }]}
    >
      <div
        className="overflow-hidden rounded-lg border border-border bg-background shadow-panel"
        data-docs-corpus-skip="true"
      >
        <DocsChatInset surface="chat" />
      </div>

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
      </section>
    </DocsPageShell>
  );
}

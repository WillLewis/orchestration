import { createFileRoute, Link } from "@tanstack/react-router";

import { DocsPageShell } from "@/components/docs/DocsPage";
import { DocsChatInset } from "@/components/docs/DocsChatInset";
import { ProductFrame } from "@/components/docs/ProductFrame";
import { DOCS_CHAT_LIVE } from "@/lib/docs-chat-live";

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

function UiMeetingsDocsPage() {
  return (
    <DocsPageShell
      eyebrow="Interfaces"
      title="Meetings"
      description={
        <p>
          A meeting rail for asking ConnectAgent about the documentation corpus while the shared
          source discussion stays in view.
        </p>
      }
      related={[{ label: "RAG", to: "/developers/rag", description: "How retrieval is gated." }]}
    >
      <ProductFrame
        surface="Meeting rail"
        title="Docs answer beside a live meeting"
        subtitle="A participant can ask in the rail and receive a permission-scoped docs answer that stays private to the asker."
        variant="fullBleed"
      >
        <DocsChatInset surface="meetings" live={DOCS_CHAT_LIVE} />
      </ProductFrame>

      <section className="space-y-3 border-t border-zinc-900 pt-7">
        <div className="max-w-[72ch] space-y-3 text-[13.5px] leading-relaxed text-zinc-400">
          <p>
            The meetings surface keeps responses in the asker&apos;s rail, next to the shared
            document and participant context. Open, sealed, and locked citations behave exactly as
            they do on the Chat surface, backed by the same structured docs retrieval seam.
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

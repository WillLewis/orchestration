import { createFileRoute, Link } from "@tanstack/react-router";

import { DocsPageShell } from "@/components/docs/DocsPage";
import { DocsChatInset } from "@/components/docs/DocsChatInset";
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
        variant="fullBleed"
      >
        <DocsChatInset surface="decision_brief" />
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
      </section>
    </DocsPageShell>
  );
}

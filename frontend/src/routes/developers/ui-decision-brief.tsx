import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";

import { DocsHeading, DocsPageShell } from "@/components/docs/DocsPage";

export const Route = createFileRoute("/developers/ui-decision-brief")({
  head: () => ({
    meta: [
      { title: "Decision Brief UI - Coming Soon" },
      {
        name: "description",
        content: "Decision Brief UI documentation is coming soon.",
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
        <p>Coming soon.</p>
      }
      related={[
        {
          label: "Decision Brief",
          to: "/developers/decision-brief",
          description: "The underlying governed work product.",
        },
      ]}
    >
      <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-6">
        <div className="flex max-w-[56ch] flex-col gap-4">
          <div
            className={[
              "grid h-10 w-10 place-items-center rounded-md border border-emerald-400/25",
              "bg-emerald-400/10 text-emerald-300",
            ].join(" ")}
          >
            <Clock3 className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <DocsHeading
              level={2}
              className="text-[20px] font-semibold tracking-tight text-zinc-50"
            >
              Coming soon
            </DocsHeading>
            <p className="text-[13.5px] leading-relaxed text-zinc-400">
              This interface page is intentionally minimal while the Decision Brief UI docs are
              finalized.
            </p>
          </div>
          <Link
            to="/developers/decision-brief"
            className={[
              "inline-flex w-fit items-center rounded-md border border-zinc-800",
              "bg-zinc-900/70 px-3 py-2 text-[12px] font-semibold text-zinc-200",
              "transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/10",
              "hover:text-emerald-200",
            ].join(" ")}
          >
            Read the Decision Brief docs
          </Link>
        </div>
      </section>
    </DocsPageShell>
  );
}

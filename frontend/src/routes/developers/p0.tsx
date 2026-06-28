import { createFileRoute } from "@tanstack/react-router";

import { DocsPageShell, DocsSection } from "@/components/docs/DocsPage";

export const Route = createFileRoute("/developers/p0")({
  head: () => ({
    meta: [
      { title: "Phase 0 Narrow Wedge Loop" },
      {
        name: "description",
        content:
          "The narrow Phase 0 launch wedge: one governed Acme approval loop and the measures that prove it works.",
      },
    ],
  }),
  component: P0DocsPage,
});

const screenshots = [
  {
    src: "/developers/p0/01-narrowest-loop.png",
    title: "Narrowest closed loop",
    alt: "Phase 0 narrow value proof from blocked discount request through routed approval and recomputed brief.",
  },
  {
    src: "/developers/p0/02-primitive-correctness.png",
    title: "Primitive correctness",
    alt: "Primitive correctness table with evaluation questions and pass signals.",
  },
  {
    src: "/developers/p0/03-user-value.png",
    title: "User value",
    alt: "User value table with the smallest outcome metrics and why they matter.",
  },
];

function ScreenshotFigure({
  src,
  title,
  alt,
  index,
}: {
  src: string;
  title: string;
  alt: string;
  index: number;
}) {
  return (
    <figure className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
      <div className="border-b border-zinc-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
        {index}. {title}
      </div>
      <img src={src} alt={alt} className="block h-auto w-full" loading="lazy" />
    </figure>
  );
}

function P0DocsPage() {
  return (
    <DocsPageShell
      eyebrow="Getting started"
      title="Phase 0 Narrow Wedge Loop"
      description={
        <p>
          P0 is the smallest finance launch loop that still proves the substrate: a blocked write,
          an explained Decision Brief, a staged approval route, reviewed execution, and readiness
          recomputation after the response returns.
        </p>
      }
      related={[
        {
          label: "Roadmap",
          to: "/developers/roadmap",
          description: "Where the narrow loop sits in the phased build.",
        },
        {
          label: "Primitives",
          to: "/developers/primitives",
          description: "The primitives this loop exercises end to end.",
        },
      ]}
    >
      <DocsSection label="wedge" title="Launch wedge and measures">
        <p>
          Ship one closed Acme route before broadening the product surface. The wedge is narrow on
          purpose: it demonstrates safety, workflow movement, and recomputation in one auditable
          path instead of trying to prove every agent capability at once.
        </p>
        <p>
          Measure it in two layers: primitive correctness for deterministic substrate behavior, and
          user value for whether the loop moves regulated work forward.
        </p>
      </DocsSection>

      <section className="space-y-6" aria-label="Phase 0 screenshots">
        {screenshots.map((screenshot, index) => (
          <ScreenshotFigure key={screenshot.src} index={index + 1} {...screenshot} />
        ))}
      </section>
    </DocsPageShell>
  );
}

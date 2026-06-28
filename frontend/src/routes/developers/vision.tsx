import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { DeveloperDocsHeader } from "@/components/docs/DeveloperDocsHeader";
import { DocsHeading, DocsHeadingScope } from "@/components/docs/DocsPage";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export const Route = createFileRoute("/developers/vision")({
  head: () => ({
    meta: [
      { title: "Agent Vision" },
      {
        name: "description",
        content:
          "From describing conversations to closing the loop: an agent that grounds across the workspace and acts within policy turns proactive insight into resolved work.",
      },
    ],
  }),
  component: VisionDocsPage,
});

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="border-t border-zinc-900 pt-7"
      style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}
    >
      <DocsHeading level={2} className="text-[18px] font-semibold tracking-tight text-zinc-100">
        {title}
      </DocsHeading>
      <div className="mt-2.5 max-w-[68ch] space-y-3 text-[14px] leading-relaxed text-zinc-400">
        {children}
      </div>
    </section>
  );
}

function ModeCard({
  surface,
  title,
  children,
}: {
  surface: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-emerald-300/90">
        {surface}
      </div>
      <div className="mt-1 text-[14px] font-semibold text-zinc-100">{title}</div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">{children}</p>
    </div>
  );
}

function VisionDocsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0c] text-zinc-200">
      <DeveloperDocsHeader />

      <div className="mx-auto block w-full max-w-[1320px] gap-8 px-4 py-8 sm:px-6 md:flex">
        <DocsSidebar />

        <DocsHeadingScope>
          <main className="w-full min-w-0 space-y-7 md:flex-1">
            <section style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">
                Getting started
              </div>
              <DocsHeading
                level={1}
                className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-zinc-50"
              >
                Agent Vision
              </DocsHeading>
              <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-zinc-300">
                The Conversational Insights Agent grows from something you ask into something that
                closes the loop. Today it describes what was said. The vision is an agent that
                understands a decision, drafts it, and — within policy — carries it through to done.
                Its deliverable stops being an answer and becomes a closed, governed work product.
              </p>
            </section>

            <Block title="What fundamentally changes for the user">
              <p>
                Today, Dana asks the agent to summarize a meeting — then spends the next hour doing
                the real work by hand: reconciling figures across a memo and a model, routing
                approvals, chasing owners, documenting what was decided. The agent describes; she
                does the rest.
              </p>
              <p>
                The enhanced agent collapses that gap. Because it can both see the true state across
                her sources and act on it, the work between the meeting and the outcome happens
                inside one governed thread — it drafts the decision, proposes the follow-ups, and
                routes them. Dana approves the consequential steps instead of performing all of
                them. The improvement isn't a smarter answer; it's that the agent absorbs the work
                between the decision and the done, and she stops being the integration layer between
                her own tools.
              </p>
            </Block>

            <Block title="What happens when grounding meets action">
              <p>
                Grounding and action are each modest alone. Grounding by itself is a better answer
                engine — it knows the state but can't change it. Safe actions by themselves are a
                tool executor — they can change things but don't know what's true. Fused, the agent
                can see what's true and what's missing, and resolve the gap within policy.
              </p>
              <p>
                It also closes a longer loop than a single meeting. Because the agent reads from
                live sources and writes governed records, it notices when a sealed decision goes
                stale and re-validates it. A read-only agent hands you an answer that rots silently;
                an agent that reads and writes stays accountable for whether "done" is still true.
              </p>
            </Block>

            <section
              className="rounded-lg border-l-2 border-emerald-400/80 bg-emerald-400/[0.06] p-4"
              style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}
            >
              <p className="max-w-[68ch] text-[14px] leading-relaxed text-emerald-100/90">
                <span className="font-semibold text-emerald-50">
                  A proactive insight that can act is a resolution, not a notification — and a
                  grounded action is a decision, not a guess.
                </span>{" "}
                That product, not either half alone, is what "proactive and actionable" actually
                means.
              </p>
            </section>

            <Block title="Why this raises the stakes — and the answer">
              <p>
                The same fusion that creates the value is why governance can't be an afterthought.
                The moment an agent that reads untrusted content can also write, a wrong read — or
                an instruction injected into a document — becomes an action, not just a bad
                sentence. Power and exposure rise together.
              </p>
              <p>
                So the agent works across two surfaces, with a deterministic gate as the boundary
                between them. The gate — not the model — decides what is allowed to commit, which is
                what lets one agent safely cross from telling you the state to changing it.
              </p>
              <div className="space-y-0 pt-1">
                <ModeCard surface="Read surface" title="Inform">
                  Grounds across the workspace (permission-aware), drafts the decision brief, and
                  surfaces what changed, what's missing, and what's blocked.
                </ModeCard>
                <ModeCard surface="Write surface" title="Act">
                  Proposes actions — create a task, route an approval, update a status — each
                  previewed as a diff and committed only through the gate.
                </ModeCard>
              </div>
            </Block>
          </main>
        </DocsHeadingScope>
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

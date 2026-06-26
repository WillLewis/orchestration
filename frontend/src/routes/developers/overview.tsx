import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { DeveloperDocsHeader } from "@/components/docs/DeveloperDocsHeader";
import { DocsHeading, DocsHeadingScope } from "@/components/docs/DocsPage";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export const Route = createFileRoute("/developers/overview")({
  head: () => ({
    meta: [
      { title: "Overview - ConnectWork Platform API" },
      {
        name: "description",
        content:
          "Executive summary: turning the Conversational Insights Agent into a single governed agent that closes the loop, with finance as the initial wedge.",
      },
    ],
  }),
  component: OverviewDocsPage,
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

export function OverviewDocsPage() {
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
                Overview
              </DocsHeading>
              <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-zinc-300">
                Today's Conversational Insights Agent describes conversations. We turn it into a
                single governed agent that closes the loop from discussed to done — it grounds
                across the workspace, drafts the decision, acts on it through a deterministic policy
                gate, orchestrates the follow-ups across owners, and seals an audit-ready record
                that knows when it's gone stale. The hard part isn't a smarter model; it's the
                orchestration substrate that makes every output permission-safe, deterministically
                verified, and auditable.
              </p>
            </section>

            <Block title="Why this, not a smarter chatbot">
              <p>
                Integrating RAG with our Conversational Agent was step one — but it's not enough.
                Model capability is commoditizing fast, and we've made a deliberate bet: rather than
                build our own frontier model, we give clients flexibility across the leading ones
                (OpenAI, Anthropic, and more). That prevents lock-in. But it isn't the moat.
              </p>
              <p>
                The moat is what comes after model choice. As agents grow more capable, our
                regulated clients in Finance, Law, and Health need a governance layer that scales
                with that capability — permission-aware context, deterministic verification,
                auditable decisions — across content wherever it lives.
              </p>
              <p>
                That's what lets our clients put frontier-model agents on their most sensitive work
                with provable controls, without building the control plane themselves. The agent is
                the visible surface; the substrate is the product.
              </p>
            </Block>

            <Block title="What it is">
              <p>
                We build the unglamorous substrate underneath the model: permission-aware context,
                deterministic verification, safe actions, multi-owner orchestration, lifecycle, and
                a privacy-preserving evaluation loop. It's powered by our{" "}
                <Link
                  to="/developers/gating"
                  className="text-emerald-300 underline-offset-2 hover:underline"
                >
                  Deterministic Gating Engine
                </Link>
                .
              </p>
            </Block>

            <Block title="How we chose what to build">
              <p>
                The list of themes we prioritize on our{" "}
                <Link
                  to="/developers/prioritization"
                  className="text-emerald-300 underline-offset-2 hover:underline"
                >
                  Prioritization
                </Link>{" "}
                page is the minimal set of capabilities an agent needs to cross from describing to
                doing on regulated work: ground (read), decide (brief), act safely (gate),
                orchestrate (batch), and stay true (lifecycle). Each maps to a phase of the build.
              </p>
              <p>
                We then scored eight candidate themes against the brief's own criteria — value,
                platform leverage, differentiation, and risk — and let the ranking, not instinct,
                order them. Cross-source grounding ranked first as the foundation; deterministic
                gating second as the rail that makes acting safe.
              </p>
            </Block>

            <Block title="Why finance first">
              <p>
                We lead with a financial-services credit decision because that's where the trust
                problem bites hardest. When the agent gets a number wrong on a credit memo, it isn't
                a bad summary — it's a sanctioned decision. It's also where the deterministic layer
                is most legible (a 22%-over-15%-authority breach is computed, not guessed) and where
                the audit requirement is already real.
              </p>
              <p>
                Finance is a beachhead, not a vertical bet: the same primitives extend to Legal and
                Health by swapping the Policy Artifact and the evaluation pack. Prove it for one
                regulated cohort, then expand.
              </p>
            </Block>

            <section
              className="rounded-lg border-l-2 border-emerald-400/80 bg-emerald-400/[0.06] p-4"
              style={{ maxWidth: "100%", width: "calc(100vw - 2rem)" }}
            >
              <p className="max-w-[68ch] text-[14px] leading-relaxed text-emerald-100/90">
                <span className="font-semibold text-emerald-50">
                  Finance is the wedge, not the architecture.
                </span>{" "}
                The platform is shared primitives, measured by typed signals — the orchestration
                layer this work is really about.
              </p>
            </section>

            <Block title="The shape of the build">
              <p>
                Substrate first — context, policy, action preview, evaluation — then read before
                write, then govern the lifecycle of what the agent produces. The phased plan and its
                sequencing logic live on the{" "}
                <Link
                  to="/developers/roadmap"
                  className="text-emerald-300 underline-offset-2 hover:underline"
                >
                  Roadmap
                </Link>
                . The north star is decision → closed-work-product cycle time for regulated review;
                everything else is a driver.
              </p>
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
    </div>
  );
}

// Single source of truth for the developer-docs left nav.
// Set `live: true` on an item once its route actually exists; until then it
// renders as an inert placeholder, matching the prototype convention.

export type LiveDocsRoute =
  | "/developers/overview"
  | "/developers/vision"
  | "/developers/prioritization"
  | "/developers/roadmap"
  | "/developers/gating";

export type DocsNavItem =
  | {
      label: string;
      to?: string;
      live?: false;
    }
  | {
      label: string;
      to: LiveDocsRoute;
      live: true;
    };

export type DocsNavSection = {
  label: string;
  items: DocsNavItem[];
};

export const docsNav: DocsNavSection[] = [
  {
    label: "Getting started",
    items: [
      { label: "Overview", to: "/developers/overview", live: true },
      { label: "Agent Vision", to: "/developers/vision", live: true },
      { label: "Prioritization", to: "/developers/prioritization", live: true },
      { label: "Roadmap", to: "/developers/roadmap", live: true },
      { label: "Success Metrics", to: "/developers/metrics" },
      { label: "Risks & Mitigations", to: "/developers/risks" },
    ],
  },
  {
    label: "Substrate",
    items: [
      { label: "Context Assembly", to: "/developers/context-assembly" },
      { label: "Deterministic Gating", to: "/developers/gating", live: true },
      { label: "Action Diff", to: "/developers/action-diff" },
      { label: "Eval Trace", to: "/developers/eval-trace" },
      { label: "Compliance Trace", to: "/developers/compliance-trace" },
    ],
  },
  {
    label: "Read",
    items: [
      { label: "RAG", to: "/developers/rag" },
      { label: "Decision Brief", to: "/developers/decision-brief" },
      { label: "Insight Cards", to: "/developers/insight-cards" },
    ],
  },
  {
    label: "Actions",
    items: [
      { label: "Action Packets", to: "/developers/action-packets" },
      { label: "Orchestration", to: "/developers/orchestration" },
      { label: "Audit log", to: "/developers/audit-log" },
    ],
  },
  {
    label: "Lifecycle",
    items: [
      { label: "Sealed records", to: "/developers/sealed-records" },
      { label: "Revalidation", to: "/developers/revalidation" },
      { label: "AI Studio", to: "/developers/ai-studio" },
      { label: "Verticals", to: "/developers/verticals" },
    ],
  },
];

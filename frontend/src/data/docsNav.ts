// Single source of truth for the developer-docs left nav.
// Set `live: true` on an item once its route actually exists; until then it
// renders as an inert placeholder, matching the prototype convention.

export type LiveDocsRoute =
  | "/developers/overview"
  | "/developers/vision"
  | "/developers/prioritization"
  | "/developers/roadmap"
  | "/developers/primitives"
  | "/developers/whats-live"
  | "/developers/metrics"
  | "/developers/risks"
  | "/developers/context-assembly"
  | "/developers/gating"
  | "/developers/action-diff"
  | "/developers/eval-trace"
  | "/developers/compliance-trace"
  | "/developers/ui-chat"
  | "/developers/ui-meetings"
  | "/developers/ui-decision-brief"
  | "/developers/rag"
  | "/developers/decision-brief"
  | "/developers/insight-cards"
  | "/developers/action-packets"
  | "/developers/orchestration"
  | "/developers/audit-log"
  | "/developers/sealed-records"
  | "/developers/revalidation"
  | "/developers/ai-studio"
  | "/developers/verticals";

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
      { label: "Primitives", to: "/developers/primitives", live: true },
      { label: "What's Live", to: "/developers/whats-live", live: true },
      { label: "Success Metrics", to: "/developers/metrics", live: true },
      { label: "Risks & Mitigations", to: "/developers/risks", live: true },
    ],
  },
  {
    label: "Substrate",
    items: [
      { label: "Context Assembly", to: "/developers/context-assembly", live: true },
      { label: "Deterministic Gating", to: "/developers/gating", live: true },
      { label: "Action Diff", to: "/developers/action-diff", live: true },
      { label: "Eval Trace", to: "/developers/eval-trace", live: true },
      { label: "Compliance Trace", to: "/developers/compliance-trace", live: true },
    ],
  },
  {
    label: "Interfaces",
    items: [
      { label: "Chat", to: "/developers/ui-chat", live: true },
      { label: "Meetings", to: "/developers/ui-meetings", live: true },
      { label: "Decision Brief UI", to: "/developers/ui-decision-brief", live: true },
    ],
  },
  {
    label: "Read",
    items: [
      { label: "RAG", to: "/developers/rag", live: true },
      { label: "Decision Brief", to: "/developers/decision-brief", live: true },
      { label: "Insight Cards", to: "/developers/insight-cards", live: true },
    ],
  },
  {
    label: "Actions",
    items: [
      { label: "Action Packets", to: "/developers/action-packets", live: true },
      { label: "Orchestration", to: "/developers/orchestration", live: true },
      { label: "Audit log", to: "/developers/audit-log", live: true },
    ],
  },
  {
    label: "Lifecycle",
    items: [
      { label: "Sealed records", to: "/developers/sealed-records", live: true },
      { label: "Revalidation", to: "/developers/revalidation", live: true },
      { label: "AI Studio", to: "/developers/ai-studio", live: true },
      { label: "Verticals", to: "/developers/verticals", live: true },
    ],
  },
];

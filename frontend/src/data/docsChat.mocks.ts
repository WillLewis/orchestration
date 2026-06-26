// Phase 0 Docs RAG contract fixture.
// These types mirror api.models DocsChat* models so WS4 can build against stable mocks before
// `/docs/chat`, docs routes, or the real docs corpus exist.

export type DocsSurface = "chat" | "meetings" | "decision_brief";
export type DocsAccess = "open" | "sealed" | "locked";
export type DocsChatStatus = "answered" | "no_results" | "error";
export type DocsConfidence = "grounded" | "partial" | "weak";
export type DocsTitleVisibility = "reveal" | "redact";
export type DocsTier = 1 | 2 | "sealed" | 3;

export type DocsChatMessage = {
  role: "user" | "agent";
  content: string;
};

export type DocsChatRequest = {
  surface: DocsSurface;
  message: string;
  history?: DocsChatMessage[];
};

export type DocsCitation = {
  doc_id: string;
  title?: string;
  route?: string | null;
  anchor?: string | null;
  section?: string;
  snippet?: string;
  access: DocsAccess;
  tier: DocsTier;
};

export type DocsChatResponse = {
  response: string;
  citations: DocsCitation[];
  confidence: DocsConfidence;
  missing: string[];
  status: DocsChatStatus;
  suggested_questions?: string[];
};

export type DocsDoc = {
  id: string;
  title: string;
  route?: string | null;
  in_nav: boolean;
  viewer_permitted: boolean;
  title_visibility: DocsTitleVisibility;
  owner?: string;
  request_access_to?: string | null;
  body?: string;
  cleared_derivative?: string | null;
  tier: DocsTier;
  seal: boolean;
  access: DocsAccess;
};

export const docsSurfaceRoutes: Record<DocsSurface, string> = {
  chat: "/developers/ui-chat",
  meetings: "/developers/ui-meetings",
  decision_brief: "/developers/ui-decision-brief",
};

export type DocsChatMockKey =
  | "tier1Open"
  | "tier2Open"
  | "sealed"
  | "tier3Locked"
  | "noResults"
  | "error";

export const docsChatMocks = {
  tier1Open: {
    status: "answered",
    response:
      "The policy gate computes whether a proposed action can commit by reading the permitted " +
      "context bundle and deterministic rule result. The docs page explains the gate as a " +
      "separate pass/fail layer, not model prose.",
    confidence: "grounded",
    missing: [],
    citations: [
      {
        doc_id: "gating",
        title: "Deterministic Gating",
        route: "/developers/gating",
        anchor: "policy-gate",
        section: "Policy gate",
        snippet: "The deterministic gate consumes the permission-filtered bundle.",
        access: "open",
        tier: 1,
      },
    ],
    suggested_questions: ["What happens when a gate fails?", "How are citations validated?"],
  },
  tier2Open: {
    status: "answered",
    response:
      "Private-first responses keep sensitive agent findings visible to the asker before they are " +
      "shared into a channel or meeting. This note is permitted, but it is not reachable from the " +
      "docs navigation.",
    confidence: "partial",
    missing: ["Navigation-visible public docs page for the private-first design note."],
    citations: [
      {
        doc_id: "orchestration-design-notes",
        title: "Orchestration Design Notes",
        route: null,
        anchor: "private-first-responses",
        section: "Private-first responses",
        snippet: "The agent answers privately first, then lets the user share to the thread.",
        access: "open",
        tier: 2,
      },
    ],
    suggested_questions: ["Why not auto-post locked findings?"],
  },
  sealed: {
    status: "answered",
    response:
      "The red-team evaluation is sealed. ConnectAgent can use the cleared derivative: the docs " +
      "RAG layer should prove restricted bodies never enter answer context, while still showing " +
      "a safe summary of the test intent.",
    confidence: "partial",
    missing: ["Raw sealed source text is intentionally unavailable."],
    citations: [
      {
        doc_id: "red-team-eval",
        title: "Red-Team Eval Notes",
        route: null,
        anchor: "cleared-derivative",
        section: "Cleared derivative",
        access: "sealed",
        tier: "sealed",
      },
    ],
    suggested_questions: ["What does sealed mean here?"],
  },
  tier3Locked: {
    status: "answered",
    response:
      "I found a matching document, but you do not have access to its contents. I can name the " +
      "source if its title is revealable, but I cannot quote or summarize it.",
    confidence: "weak",
    missing: ["Permission to inspect the restricted source body."],
    citations: [
      {
        doc_id: "revenue-fy26",
        title: "ConnectWork Revenue - FY26",
        route: null,
        anchor: null,
        access: "locked",
        tier: 3,
      },
    ],
    suggested_questions: ["Who owns this document?", "Ask about public roadmap metrics"],
  },
  noResults: {
    status: "no_results",
    response:
      "I could not find documentation that answers that. Try asking about RAG grounding, policy " +
      "gates, private-first responses, sealed notes, or restricted-source behavior.",
    confidence: "weak",
    missing: ["A relevant docs section for the question."],
    citations: [],
    suggested_questions: [
      "How does permission-aware RAG work?",
      "What does a locked citation mean?",
    ],
  },
  error: {
    status: "error",
    response:
      "The docs RAG service did not respond. Retry the question or continue with the static docs.",
    confidence: "weak",
    missing: ["A successful docs RAG service response."],
    citations: [],
    suggested_questions: ["Retry", "Open the RAG docs"],
  },
} satisfies Record<DocsChatMockKey, DocsChatResponse>;

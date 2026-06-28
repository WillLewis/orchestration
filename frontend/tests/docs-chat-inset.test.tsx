import React from "react";
import { describe, expect, it, mock } from "bun:test";

mock.module("@tanstack/react-router", () => ({
  Link: ({ to, href, children, className, ...props }: Record<string, unknown>) =>
    React.createElement(
      "a",
      {
        href: (to as string | undefined) ?? (href as string | undefined) ?? "#",
        className,
        "aria-label": props["aria-label"],
        "aria-current": props["aria-current"],
      },
      children as React.ReactNode,
    ),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: "/developers/ui-chat" } }),
}));

const { renderToStaticMarkup } = await import("react-dom/server");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { DocsChatInset } = await import("../src/components/docs/DocsChatInset/DocsChatInset");
const { docsChatMocks } = await import("../src/data/docsChat.mocks");

const surfaces = ["chat", "meetings", "decision_brief"] as const;
const dispositions = [
  "tier1Open",
  "tier2Open",
  "sealed",
  "tier3Locked",
  "noResults",
  "error",
] as const;

function renderInset(
  surface: (typeof surfaces)[number],
  disposition: (typeof dispositions)[number],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <DocsChatInset surface={surface} initialMock={disposition} />
    </QueryClientProvider>,
  );
}

function renderEmptyInset(surface: (typeof surfaces)[number]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <DocsChatInset surface={surface} />
    </QueryClientProvider>,
  );
}

describe("DocsChatInset", () => {
  for (const surface of surfaces) {
    for (const disposition of dispositions) {
      it(`renders ${surface} ${disposition}`, () => {
        const html = renderInset(surface, disposition);

        expect(html).toContain(docsChatMocks[disposition].response);
        if (docsChatMocks[disposition].status === "answered") {
          expect(html).toContain("Confidence");
          expect(html).toContain("Missing");
          expect(html).toContain("Anchors");
        }
      });
    }
  }

  it("builds anchored citation links for open docs", () => {
    const html = renderInset("chat", "tier1Open");

    expect(html).toContain("/developers/gating#policy-gate");
  });

  it("renders the runtime LLM live/off toggle by default", () => {
    const html = renderEmptyInset("chat");

    expect(html).toContain("Docs chat LLM mode");
    expect(html).toContain("Off");
    expect(html).toContain("Live");
    expect(html).not.toContain("Selected: LLM live");
    expect(html).not.toContain("requested");
    expect(html).not.toContain("Phase-0 mocks");
  });

  it("renders the revised private channel copy", () => {
    const html = renderEmptyInset("chat");

    expect(html).toContain("# docs-rag-questions");
    expect(html).toContain("@Agent answers only to you until shared.");
    expect(html).not.toContain("# docs-rag-fidelity");
    expect(html).not.toContain("Ask docs questions in-channel.");
  });

  it("removes source prefaces from visible answer prose", () => {
    const original = docsChatMocks.tier1Open.response;
    docsChatMocks.tier1Open.response =
      "According to the Engineering FAQ, the backend logic shown in the video is real.";

    try {
      const html = renderInset("chat", "tier1Open");

      expect(html).toContain("The backend logic shown in the video is real.");
      expect(html).not.toContain("According to the Engineering FAQ");
    } finally {
      docsChatMocks.tier1Open.response = original;
    }
  });

  it("renders concise phrasing states from response metadata", () => {
    expect(renderInset("chat", "tier3Locked")).toContain("Deterministic");
    expect(renderInset("chat", "tier1Open")).toContain("LLM");
    expect(renderInset("chat", "tier1Open")).not.toContain("LLM prose");
    expect(renderInset("chat", "tier1Open")).not.toContain("docs-phrasing-mock");
    expect(renderInset("chat", "tier1Open")).not.toContain("Accepted: LLM prose");
    expect(renderInset("chat", "tier2Open")).toContain("Fallback: deterministic");
    expect(renderInset("chat", "sealed")).toContain("Fallback: deterministic");
    expect(renderInset("chat", "noResults")).toContain("Fallback: deterministic");
    expect(renderInset("chat", "error")).toContain("Backend offline");
  });

  it("hides the normal grounded-answer banner on the chat surface", () => {
    const html = renderInset("chat", "tier1Open");

    expect(html).not.toContain("Grounded answer");
    expect(html).toContain("LLM");
  });

  it("keeps LLM selected when backend metadata reports an LLM fallback", () => {
    const html = renderInset("chat", "tier2Open");

    expect(html).toContain('aria-label="Use live LLM docs-chat prose" aria-pressed="true"');
    expect(html).toContain("Fallback: deterministic");
  });

  it("keeps locked citations snippet-free", () => {
    const html = renderInset("chat", "tier3Locked");

    expect(docsChatMocks.tier3Locked.citations[0].snippet).toBeUndefined();
    expect(html).toContain("Locked source found");
    expect(html).toContain("no snippet shown");
  });

  it("presents sealed citations as cleared-derivative only", () => {
    const html = renderInset("chat", "sealed");

    expect(html).toContain("cleared derivative only");
    expect(html.toLowerCase()).not.toContain("raw-source access");
  });
});

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

function renderInset(surface: (typeof surfaces)[number], disposition: (typeof dispositions)[number]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <DocsChatInset surface={surface} initialMock={disposition} />
    </QueryClientProvider>,
  );
}

function renderLiveInset(surface: (typeof surfaces)[number]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <DocsChatInset surface={surface} live />
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

  it("renders the live adapter state when enabled", () => {
    const html = renderLiveInset("chat");

    expect(html).toContain("Live /docs/chat");
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

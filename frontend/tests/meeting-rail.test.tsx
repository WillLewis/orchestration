import React from "react";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Turn } from "../src/components/agent/ChatThread";

type RouterStateSelector = {
  select: (state: { location: { pathname: string } }) => unknown;
};

mock.module("@tanstack/react-router", () => ({
  Link: ({ to, href, children, className, ...props }: Record<string, unknown>) =>
    React.createElement(
      "a",
      {
        href: (to as string | undefined) ?? (href as string | undefined) ?? "#",
        className,
        "aria-label": props["aria-label"],
      },
      children as React.ReactNode,
    ),
  createFileRoute: (routePath: string) => (options: Record<string, unknown>) => ({
    path: routePath,
    options,
  }),
  useRouterState: ({ select }: RouterStateSelector) =>
    select({ location: { pathname: "/developers/ui-chat" } }),
}));

const { renderToStaticMarkup } = await import("react-dom/server");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { AgentPanel } = await import("../src/components/agent/AgentPanel");
const { ChatThread } = await import("../src/components/agent/ChatThread");
const { SharedDocViewer } = await import("../src/components/meeting/SharedDocViewer");
const { resetRevalidation, routeToCreditOfficer, simulateCreditOfficerResponse } =
  await import("../src/lib/revalidation-store");
const {
  agentPrompt,
  getAgentInvocation,
  isDecisionBriefCommand,
  privateUserTurn,
  publicMeetingTurn,
} = await import("../src/components/agent/thread-utils");

function renderWithQuery(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
}

beforeEach(() => {
  resetRevalidation();
});

describe("meeting rail agent invocation", () => {
  it("requires @Agent for private agent turns", () => {
    expect(getAgentInvocation("Apply the 22% discount")).toBeNull();
    expect(getAgentInvocation("@agent apply the 22% discount")).toEqual({
      display: "@Agent apply the 22% discount",
      message: "apply the 22% discount",
    });
    expect(getAgentInvocation("@Agent: generate decision brief")).toEqual({
      display: "@Agent generate decision brief",
      message: "generate decision brief",
    });
  });

  it("detects decision brief commands after the mention is stripped", () => {
    expect(isDecisionBriefCommand("generate decision brief")).toBe(true);
    expect(isDecisionBriefCommand("draft the decision brief")).toBe(true);
    expect(isDecisionBriefCommand("what changed since last review")).toBe(false);
  });

  it("builds public and private turn shapes explicitly", () => {
    expect(publicMeetingTurn("Visible to the meeting")).toMatchObject({
      role: "user",
      author: "Dana R.",
      visibility: "public",
    });
    expect(privateUserTurn(agentPrompt("Summarize this meeting"))).toMatchObject({
      role: "user",
      content: "@Agent Summarize this meeting",
      visibility: "private",
    });
  });
});

describe("meeting rail rendering", () => {
  it("renders the chat rail without the old idle copy or extra scope chips", () => {
    const html = renderWithQuery(<AgentPanel />);

    expect(html).toContain(">Chat<");
    expect(html).toContain("@Agent for questions about this meeting.");
    expect(html).toContain("Chris O.");
    expect(html).toContain("Priya N.");
    expect(html).toContain("What changed since last review?");
    expect(html).toContain("Agent Actions");
    expect(html).toContain("Summarize this meeting");
    expect(html).toContain("Monitor this decision");
    expect(html).not.toContain("Check approval readiness");
    expect(html).not.toContain("Grounded in this meeting + linked content.");
    expect(html).not.toContain("Permissions-aware");
  });

  it("renders visible @Agent turns and the private visibility note", () => {
    const messages: Turn[] = [
      privateUserTurn(agentPrompt("apply the 22% discount")),
      {
        role: "assistant",
        content: "I can't apply that.",
        author: "Agent",
        visibility: "private",
      },
    ];
    const html = renderWithQuery(<ChatThread messages={messages} pending={false} />);

    expect(html).toContain("@Agent apply the 22% discount");
    expect(html).toContain("I can&#x27;t apply that.");
    expect(html).toContain("only you can see this");
  });

  it("renders inline decision brief previews as private agent work", () => {
    const messages: Turn[] = [
      privateUserTurn(agentPrompt("generate decision brief")),
      {
        role: "assistant",
        content: "Decision Brief · Draft",
        author: "Agent",
        visibility: "private",
        kind: "brief_preview",
      },
    ];
    const html = renderWithQuery(<ChatThread messages={messages} pending={false} />);

    expect(html).toContain("@Agent generate decision brief");
    expect(html).toContain("Decision Brief · Draft");
    expect(html).toContain("Decision needed");
    expect(html).toContain("Open full brief");
    expect(html).toContain("only you can see this");
  });

  it("moves the decision brief CTA into the shared document header", () => {
    const html = renderWithQuery(<SharedDocViewer />);

    expect(html).toContain("Generate Decision Brief");
    expect(html).toContain("Acme credit memo · v3");
  });

  it("does not reveal the CS-plan conflict in the initial shared memo", () => {
    const html = renderWithQuery(<SharedDocViewer />);

    expect(html).toContain("Credit Officer approval is outstanding");
    expect(html).toContain("final covenant tracker has not been uploaded");
    expect(html).not.toContain("customer success plan");
    expect(html).not.toContain("18% discount");
    expect(html).not.toContain("conflicting with the approved 22%");
  });

  it("does not reveal the CS-plan conflict in the initial brief preview", () => {
    const messages: Turn[] = [
      privateUserTurn(agentPrompt("generate decision brief")),
      {
        role: "assistant",
        content: "Decision Brief · Draft",
        author: "Agent",
        visibility: "private",
        kind: "brief_preview",
      },
    ];
    const html = renderWithQuery(<ChatThread messages={messages} pending={false} />);

    expect(html).toContain("Decision Brief · Draft");
    expect(html).toContain("Credit Officer approval");
    expect(html).toContain("Legal approval");
    expect(html).not.toContain("customer success plan");
    expect(html).not.toContain("18% discount");
    expect(html).not.toContain("Source conflict");
  });

  it("reveals the CS-plan conflict only after the visible Credit Officer response", () => {
    routeToCreditOfficer();

    const pendingMemo = renderWithQuery(<SharedDocViewer />);
    expect(pendingMemo).toContain("Credit Officer approval is outstanding");
    expect(pendingMemo).not.toContain("customer success plan");
    expect(pendingMemo).not.toContain("18% discount");

    expect(simulateCreditOfficerResponse()).toBe(true);

    const signedMemo = renderWithQuery(<SharedDocViewer />);
    expect(signedMemo).toContain("the Credit Officer has signed off");
    expect(signedMemo).toContain("customer success plan");
    expect(signedMemo).toContain("references an 18% discount");
    expect(signedMemo).toContain("conflicting with the approved 22%");

    const messages: Turn[] = [
      privateUserTurn(agentPrompt("generate decision brief")),
      {
        role: "assistant",
        content: "Decision Brief · Draft",
        author: "Agent",
        visibility: "private",
        kind: "brief_preview",
      },
    ];
    const signedBrief = renderWithQuery(<ChatThread messages={messages} pending={false} />);
    expect(signedBrief).toContain("Source conflict");
    expect(signedBrief).toContain("customer success plan");
    expect(signedBrief).toContain("18% discount assumption");
  });
});

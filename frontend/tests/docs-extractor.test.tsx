import React from "react";
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { LiveDocsRoute } from "../src/data/docsNav";
import {
  docsRoutesToIndex,
  extractAllDocsPages,
  extractSectionsFromHtml,
  renderedHeadingIdsFromHtml,
  renderRouteHtml,
} from "../scripts/extract-docs";

const expectedHeadingsByRoute: Record<LiveDocsRoute, string[]> = {
  "/developers/overview": ["Overview", "Why this, not a smarter chatbot"],
  "/developers/vision": ["Agent Vision", "What fundamentally changes for the user"],
  "/developers/prioritization": ["Prioritization", "How the themes rank"],
  "/developers/roadmap": ["Roadmap", "Substrate"],
  "/developers/primitives": ["Primitives", "Primitive map"],
  "/developers/whats-live": ["What's Live", "Substrate - real vs simulated"],
  "/developers/metrics": ["Success Metrics", "Measure value and trust separately"],
  "/developers/risks": ["Risks & Mitigations", "The risky transition is read to write"],
  "/developers/context-assembly": ["Context Assembly", "From workspace objects to a usable bundle"],
  "/developers/gating": ["Deterministic Gating", "Policy Artifact - policy-as-data"],
  "/developers/action-diff": ["Action Diff", "Every write starts as a diff"],
  "/developers/eval-trace": ["Eval Trace", "Cases run through the same substrate"],
  "/developers/compliance-trace": [
    "Compliance Trace",
    "The deterministic decision is the authority",
  ],
  "/developers/ui-chat": ["Chat"],
  "/developers/ui-meetings": ["Meetings"],
  "/developers/ui-decision-brief": ["Decision Brief UI", "Coming soon"],
  "/developers/rag": ["RAG", "RAG reads the ContextBundle, not the whole workspace"],
  "/developers/decision-brief": ["Decision Brief", "The brief is a typed work product"],
  "/developers/insight-cards": [
    "Insight Cards",
    "Cards turn substrate state into proactive signals",
  ],
  "/developers/action-packets": [
    "Action Packets",
    "Actions are tool calls with governance attached",
  ],
  "/developers/orchestration": [
    "Orchestration",
    "The controlled loop is deterministic state transition",
  ],
  "/developers/audit-log": ["Audit log", "Execution emits an ordered audit record"],
  "/developers/sealed-records": ["Sealed records", "Mint a governed work product"],
  "/developers/revalidation": ["Revalidation", "Source changes mark sections stale"],
  "/developers/ai-studio": ["AI Studio", "Author configs, not new engines"],
  "/developers/verticals": ["Verticals", "Same substrate, swapped vertical packs"],
};

const forbiddenChrome = [
  "Document management",
  "Team communication",
  "Project organization",
  "developers.connectwork.com",
  "Back to Meeting",
  "Agent Actions",
  "Share to channel",
  "Copy Copy",
  "swaps every example",
];

const shortRoutes = new Set<LiveDocsRoute>(["/developers/ui-decision-brief"]);

describe("docs corpus extractor", () => {
  it("extracts non-empty sections with expected headings for every live route", async () => {
    const pages = await extractAllDocsPages();

    expect(pages).toHaveLength(docsRoutesToIndex.length);

    for (const page of pages) {
      const totalTextLength = page.sections.reduce(
        (total, section) => total + section.text.length,
        0,
      );
      const headings = page.sections.map((section) => section.heading);
      const minimumTextLength = shortRoutes.has(page.route) ? 80 : 300;

      expect(totalTextLength).toBeGreaterThan(minimumTextLength);
      expect(page.sections.every((section) => section.text.length > 0)).toBe(true);

      for (const heading of expectedHeadingsByRoute[page.route]) {
        expect(headings).toContain(heading);
      }

      const pageText = page.sections
        .map((section) => `${section.heading} ${section.text}`)
        .join(" ");

      for (const chrome of forbiddenChrome) {
        expect(pageText).not.toContain(chrome);
      }
    }
  });

  it("does not render removed developer header or footer version chrome", async () => {
    for (const route of docsRoutesToIndex) {
      const html = await renderRouteHtml(route);

      expect(html).not.toContain("ConnectWork Platform API</span>");
      expect(html).not.toContain("Platform API v2");
    }
  });

  it("renders docs tables without horizontal-scroll minimum widths", async () => {
    for (const route of docsRoutesToIndex) {
      const html = await renderRouteHtml(route);

      expect(html).not.toContain("overflow-x-auto");
      expect(html).not.toContain("min-w-[560px]");
    }
  });

  it("keeps extracted anchors identical to rendered heading ids", async () => {
    for (const route of docsRoutesToIndex) {
      const html = await renderRouteHtml(route);
      const sections = extractSectionsFromHtml(html);
      const renderedHeadings = renderedHeadingIdsFromHtml(html);

      expect(renderedHeadings.map((heading) => heading.id)).toEqual(
        sections.map((section) => section.anchor),
      );
      expect(renderedHeadings.every((heading) => heading.id.length > 0)).toBe(true);
    }
  });

  it("matches duplicate heading collision anchors", async () => {
    const { DocsHeading, DocsHeadingScope } = await import("../src/components/docs/DocsPage");
    const html = renderToStaticMarkup(
      <main>
        <DocsHeadingScope>
          <DocsHeading level={1}>Overview</DocsHeading>
          <p>First overview section for the extractor.</p>
          <DocsHeading level={2}>Overview</DocsHeading>
          <p>Second overview section for the extractor.</p>
          <DocsHeading level={3}>Overview!</DocsHeading>
          <p>Third overview section for the extractor.</p>
        </DocsHeadingScope>
      </main>,
    );

    const sections = extractSectionsFromHtml(html);
    const renderedHeadings = renderedHeadingIdsFromHtml(html);
    const expectedAnchors = ["overview", "overview-1", "overview-2"];

    expect(renderedHeadings.map((heading) => heading.id)).toEqual(expectedAnchors);
    expect(sections.map((section) => section.anchor)).toEqual(expectedAnchors);
  });
});

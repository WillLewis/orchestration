import { mock } from "bun:test";
import { load } from "cheerio";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { docsNav, type LiveDocsRoute } from "../src/data/docsNav";
import { slugify } from "../src/lib/docs-slug";

type RouteModule = {
  Route: {
    options?: {
      component?: ComponentType;
    };
    component?: ComponentType;
  };
};

export type DocsCorpusSection = {
  heading: string;
  anchor: string;
  text: string;
};

export type DocsCorpusPage = {
  id: string;
  route: LiveDocsRoute;
  title: string;
  sections: DocsCorpusSection[];
};

type RouterStateSelector = {
  select: (state: { location: { pathname: string } }) => unknown;
};

type CheerioNode = {
  type?: string;
  name?: string;
  data?: string;
  children?: CheerioNode[];
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(scriptDir, "../../api/docs_corpus/generated/pages.json");

let currentPathname: LiveDocsRoute = "/developers/overview";

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
      children as ReactNode,
    ),
  createFileRoute: (routePath: string) => (options: RouteModule["Route"]["options"]) => ({
    path: routePath,
    options,
  }),
  useRouterState: ({ select }: RouterStateSelector) =>
    select({ location: { pathname: currentPathname } }),
}));

const routeModuleLoaders = {
  "/developers/overview": () => import("../src/routes/developers/overview"),
  "/developers/vision": () => import("../src/routes/developers/vision"),
  "/developers/prioritization": () => import("../src/routes/developers/prioritization"),
  "/developers/roadmap": () => import("../src/routes/developers/roadmap"),
  "/developers/p0": () => import("../src/routes/developers/p0"),
  "/developers/primitives": () => import("../src/routes/developers/primitives"),
  "/developers/whats-live": () => import("../src/routes/developers/whats-live"),
  "/developers/metrics": () => import("../src/routes/developers/metrics"),
  "/developers/risks": () => import("../src/routes/developers/risks"),
  "/developers/context-assembly": () => import("../src/routes/developers/context-assembly"),
  "/developers/gating": () => import("../src/routes/developers/gating"),
  "/developers/action-diff": () => import("../src/routes/developers/action-diff"),
  "/developers/work-product-contract": () =>
    import("../src/routes/developers/work-product-contract"),
  "/developers/eval-trace": () => import("../src/routes/developers/eval-trace"),
  "/developers/compliance-trace": () => import("../src/routes/developers/compliance-trace"),
  "/developers/ui-chat": () => import("../src/routes/developers/ui-chat"),
  "/developers/ui-meetings": () => import("../src/routes/developers/ui-meetings"),
  "/developers/ui-decision-brief": () => import("../src/routes/developers/ui-decision-brief"),
  "/developers/rag": () => import("../src/routes/developers/rag"),
  "/developers/decision-brief": () => import("../src/routes/developers/decision-brief"),
  "/developers/insight-cards": () => import("../src/routes/developers/insight-cards"),
  "/developers/action-packets": () => import("../src/routes/developers/action-packets"),
  "/developers/orchestration": () => import("../src/routes/developers/orchestration"),
  "/developers/audit-log": () => import("../src/routes/developers/audit-log"),
  "/developers/sealed-records": () => import("../src/routes/developers/sealed-records"),
  "/developers/lifecycle-events": () => import("../src/routes/developers/lifecycle-events"),
  "/developers/revalidation": () => import("../src/routes/developers/revalidation"),
  "/developers/ai-studio": () => import("../src/routes/developers/ai-studio"),
  "/developers/verticals": () => import("../src/routes/developers/verticals"),
} satisfies Record<LiveDocsRoute, () => Promise<RouteModule>>;

export const docsRoutesToIndex: LiveDocsRoute[] = Array.from(
  new Set(
    docsNav.flatMap((section) => section.items.flatMap((item) => (item.live ? [item.to] : []))),
  ),
);

export async function extractAllDocsPages(): Promise<DocsCorpusPage[]> {
  const pages: DocsCorpusPage[] = [];

  for (const route of docsRoutesToIndex) {
    pages.push(await extractDocsPage(route));
  }

  return pages;
}

export async function extractDocsPage(route: LiveDocsRoute): Promise<DocsCorpusPage> {
  const html = await renderRouteHtml(route);
  const sections = extractSectionsFromHtml(html);
  const title = sections[0]?.heading;

  if (!title) {
    throw new Error(`No h1/h2/h3 content found for ${route}`);
  }

  return {
    id: routeToPageId(route),
    route,
    title,
    sections,
  };
}

export async function renderRouteHtml(route: LiveDocsRoute): Promise<string> {
  currentPathname = route;
  const routeModule = await routeModuleLoaders[route]();
  const Component = routeModule.Route.options?.component ?? routeModule.Route.component;

  if (!Component) {
    throw new Error(`Route ${route} does not expose a component`);
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(Component),
    ),
  );
}

export function extractSectionsFromHtml(html: string): DocsCorpusSection[] {
  const $ = load(html);
  const root = $("main, article").first();
  const contentRoot = root.length ? root : $.root();

  contentRoot
    .find(
      [
        "header",
        "footer",
        "aside",
        "nav",
        "script",
        "style",
        "noscript",
        "button",
        "[data-docs-corpus-skip='true']",
        "[aria-hidden='true']",
      ].join(","),
    )
    .remove();

  const seen = new Set<string>();
  const sections: Array<DocsCorpusSection & { parts: string[] }> = [];

  function currentSection() {
    return sections[sections.length - 1];
  }

  function pushText(value: string | undefined) {
    const normalized = normalizeText(value ?? "");
    if (!normalized || !currentSection()) return;
    currentSection().parts.push(normalized);
  }

  function walk(node: CheerioNode) {
    if (node.type === "text") {
      pushText(node.data);
      return;
    }

    if (node.type !== "tag" && node.type !== "root") return;

    const tagName = node.name?.toLowerCase();

    if (tagName && ["h1", "h2", "h3"].includes(tagName)) {
      const heading = normalizeText($(node).text());
      sections.push({
        heading,
        anchor: slugify(heading, seen),
        text: "",
        parts: [],
      });
      return;
    }

    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  for (const node of contentRoot.contents().toArray() as CheerioNode[]) {
    walk(node);
  }

  return sections.map(({ heading, anchor, parts }) => ({
    heading,
    anchor,
    text: normalizeText(parts.join(" ")),
  }));
}

export function renderedHeadingIdsFromHtml(html: string): Array<{ heading: string; id: string }> {
  const $ = load(html);
  const root = $("main, article").first();
  const contentRoot = root.length ? root : $.root();

  contentRoot.find("[data-docs-corpus-skip='true']").remove();

  return contentRoot
    .find("h1,h2,h3")
    .toArray()
    .map((node) => ({
      heading: normalizeText($(node).text()),
      id: $(node).attr("id") ?? "",
    }));
}

export function routeToPageId(route: LiveDocsRoute): string {
  return route.replace(/^\/developers\//, "");
}

export async function writeDocsCorpus(generatedPath = outputPath): Promise<DocsCorpusPage[]> {
  const pages = await extractAllDocsPages();
  await mkdir(path.dirname(generatedPath), { recursive: true });
  await writeFile(generatedPath, `${JSON.stringify(pages, null, 2)}\n`);
  return pages;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

if (import.meta.main) {
  const pages = await writeDocsCorpus();
  console.log(`Wrote ${pages.length} developer docs pages to ${outputPath}`);
}

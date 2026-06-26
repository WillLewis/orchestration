import { describe, expect, it } from "bun:test";

import { slugify } from "../src/lib/docs-slug";

describe("slugify", () => {
  it("normalizes headings into anchor ids", () => {
    const seen = new Set<string>();

    expect(slugify("Policy Gate", seen)).toBe("policy-gate");
    expect(slugify("  RAG: citations & access  ", seen)).toBe("rag-citations-and-access");
    expect(slugify("Decision brief's status", seen)).toBe("decision-briefs-status");
  });

  it("appends numeric suffixes for duplicate collisions", () => {
    const seen = new Set<string>();

    expect(slugify("Overview", seen)).toBe("overview");
    expect(slugify("Overview", seen)).toBe("overview-1");
    expect(slugify("Overview!", seen)).toBe("overview-2");
  });

  it("uses a stable fallback for punctuation-only headings", () => {
    const seen = new Set<string>();

    expect(slugify(" !!! ", seen)).toBe("section");
    expect(slugify("---", seen)).toBe("section-1");
  });
});

import { useState } from "react";

import { DocsChatInset } from "./DocsChatInset";
import type { DocsChatMockKey, DocsSurface } from "@/data/docsChat.mocks";

const MOCK_KEYS: DocsChatMockKey[] = [
  "tier1Open",
  "tier2Open",
  "sealed",
  "tier3Locked",
  "noResults",
  "error",
];

const SURFACES: DocsSurface[] = ["chat", "meetings", "decision_brief"];

export function DocsChatInsetHarness() {
  const [surface, setSurface] = useState<DocsSurface>("chat");

  return (
    <div className="min-h-screen bg-[var(--canvas)] p-4">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold text-foreground">Docs chat inset harness</h1>
            <p className="mt-1 text-[13px] text-[var(--secondary-text)]">
              Renders every Phase-0 mock disposition and exercises citation panels, the @Agent menu,
              and agent empty/loading/success states.
            </p>
          </div>
          <div className="flex rounded-md border border-border bg-card p-1">
            {SURFACES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSurface(item)}
                className={[
                  "h-8 rounded px-3 text-[12px] font-semibold transition-colors",
                  surface === item
                    ? "bg-primary text-white"
                    : "text-[var(--secondary-text)] hover:bg-[var(--canvas)]",
                ].join(" ")}
              >
                {item.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="xl:col-span-2">
            <DocsChatInset surface={surface} />
          </div>
          {MOCK_KEYS.map((key) => (
            <div key={key} className="min-h-[640px]">
              <div className="mb-2 text-[11px] font-semibold uppercase text-[var(--muted-fg)]">
                {key}
              </div>
              <DocsChatInset surface={surface} initialMock={key} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

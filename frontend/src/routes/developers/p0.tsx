import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";

import { DocsHeading, DocsPageShell, DocsSection } from "@/components/docs/DocsPage";

export const Route = createFileRoute("/developers/p0")({
  head: () => ({
    meta: [
      { title: "Phase 0 Narrow Wedge Loop" },
      {
        name: "description",
        content:
          "The narrow Phase 0 launch wedge: one governed Acme approval loop and the measures that prove it works.",
      },
    ],
  }),
  component: P0DocsPage,
});

type TableColumn = {
  label: string;
  widthClass: string;
};

type TableRow = {
  cells: ReactNode[];
};

const loopSteps = [
  "Dana asks for a 22% discount",
  "Agent refuses direct mutation",
  "Decision Brief explains the blocker",
  "Dana stages the Credit Officer route",
  "Reviewed route executes through the drawer",
  "Credit Officer response returns",
  "Brief recomputes readiness",
];

const loopProofRows: TableRow[] = [
  {
    cells: [
      "Source changes require a staged, validated, human-approved diff",
      "Permission boundary + Policy Artifact gate + action-diff execution",
    ],
  },
  {
    cells: ["Brief explains the blocker", "Context bundle + Policy Artifact"],
  },
  {
    cells: [
      "Route is derived from the readiness row",
      "DecisionReadiness row + no-drift action composition",
    ],
  },
  {
    cells: ["Drawer is the execution surface", "ToolCard / ActionDiff"],
  },
  {
    cells: ["Returned approval changes the work product", "Lifecycle event to recompute"],
  },
  {
    cells: [
      "System still shows not ready if dependencies remain",
      "PolicyGraph / readiness recomputation",
    ],
  },
  {
    cells: ["Trace can be evaluated without relying on user trust", "EvalTrace"],
  },
];

const primitiveCorrectnessRows: TableRow[] = [
  {
    cells: [
      "Permission boundary",
      "Did restricted content stay out of retrieval and generation?",
      "No restricted-source leakage",
    ],
  },
  {
    cells: [
      "Policy Artifact",
      "Did the active policy artifact block 22% and allow 15%?",
      "Correct allow/block decision from the deterministic verifier",
    ],
  },
  {
    cells: [
      "DecisionReadiness row",
      "Did the brief create the right blocker?",
      "Correct row type, owner, and evidence",
    ],
  },
  {
    cells: [
      "Action composition",
      "Did staging create exactly one drawer card from that row?",
      "No orphan action; row provenance preserved",
    ],
  },
  {
    cells: [
      "ActionDiff / ToolCard",
      "Did the drawer show the right side effect before execution?",
      "Valid route preview",
    ],
  },
  {
    cells: [
      "Lifecycle event",
      "Did approval return recompute readiness?",
      "Correct state transition",
    ],
  },
  {
    cells: ["EvalTrace", "Can the run be replayed and scored?", "Trace complete; schema valid"],
  },
];

const userValueRows: TableRow[] = [
  {
    cells: ["Time from request to routed approval", "Proves the agent moves work forward"],
  },
  {
    cells: [
      "Percent of decision packets with complete blockers identified",
      "Proves readiness value",
    ],
  },
  {
    cells: ["Invalid write attempts blocked", "Proves safety value"],
  },
  {
    cells: ["Approval route correctness", "Proves workflow value"],
  },
  {
    cells: ["User accept/edit/reject on staged route", "Proves trust and usability"],
  },
  {
    cells: ["Number of manual follow-up messages avoided", "Proves operational value"],
  },
];

const twoColumnTable: TableColumn[] = [
  { label: "What must be true", widthClass: "w-1/2" },
  { label: "Substrate primitive proven", widthClass: "w-1/2" },
];

const primitiveColumns: TableColumn[] = [
  { label: "Primitive", widthClass: "w-1/4" },
  { label: "Evaluation question", widthClass: "w-5/12" },
  { label: "Pass signal", widthClass: "w-1/3" },
];

const userValueColumns: TableColumn[] = [
  { label: "User-value metric", widthClass: "w-7/12" },
  { label: "Why it matters", widthClass: "w-5/12" },
];

function LoopStrip() {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
        Narrowest value proof
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {loopSteps.map((step, index) => (
          <li
            key={step}
            className="grid min-h-[72px] grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-md border border-zinc-800/80 bg-zinc-900/35 p-3"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 font-mono text-[11px] font-semibold text-emerald-300">
              {index + 1}
            </span>
            <span className="text-[13px] leading-relaxed text-zinc-300">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function NormalizedTable({
  label,
  title,
  description,
  columns,
  rows,
}: {
  label: string;
  title: string;
  description: ReactNode;
  columns: TableColumn[];
  rows: TableRow[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/30">
      <div className="border-b border-zinc-800 bg-zinc-900/40 px-4 py-3">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">
          {label}
        </div>
        <DocsHeading
          level={2}
          className="mt-1 text-[18px] font-semibold tracking-tight text-zinc-50"
        >
          {title}
        </DocsHeading>
        <p className="mt-1.5 max-w-[72ch] text-[12.5px] leading-relaxed text-zinc-500">
          {description}
        </p>
      </div>
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse text-left">
          <thead className="border-b border-zinc-800">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={[
                    column.widthClass,
                    "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500",
                  ].join(" ")}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex > 0 ? "border-t border-zinc-900" : ""}>
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={columns[cellIndex].label}
                    className={[
                      "min-w-0 px-4 py-3.5 pr-8 align-top",
                      cellIndex === 0 ? "text-zinc-100" : "text-zinc-300",
                    ].join(" ")}
                  >
                    <div className="text-[13px] leading-relaxed">{cell}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div data-docs-corpus-skip="true" className="md:hidden">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={[
              "space-y-3 px-4 py-3.5",
              rowIndex > 0 ? "border-t border-zinc-900" : "",
            ].join(" ")}
          >
            {row.cells.map((cell, cellIndex) => (
              <div
                key={columns[cellIndex].label}
                className={["min-w-0", cellIndex === 0 ? "text-zinc-100" : "text-zinc-300"].join(
                  " ",
                )}
              >
                <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-600">
                  {columns[cellIndex].label}
                </div>
                <div className="text-[13px] leading-relaxed">{cell}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function P0DocsPage() {
  return (
    <DocsPageShell
      eyebrow="Getting started"
      title="Phase 0 Narrow Wedge Loop"
      description={
        <p>
          P0 is the smallest finance launch loop that still proves the substrate: a blocked write,
          an explained Decision Brief, a staged approval route, reviewed execution, and readiness
          recomputation after the response returns.
        </p>
      }
      related={[
        {
          label: "Roadmap",
          to: "/developers/roadmap",
          description: "Where the narrow loop sits in the phased build.",
        },
        {
          label: "Primitives",
          to: "/developers/primitives",
          description: "The primitives this loop exercises end to end.",
        },
      ]}
    >
      <DocsSection label="wedge" title="Launch wedge and measures">
        <p>
          Ship one closed Acme route before broadening the product surface. The wedge is narrow on
          purpose: it demonstrates safety, workflow movement, and recomputation in one auditable
          path instead of trying to prove every agent capability at once.
        </p>
        <p>
          Terminology is deliberate: <strong>Policy Artifact</strong> is the product primitive. The
          internal <code>RulePack</code> is the locked verifier schema / compiled rule subset that a
          Policy Artifact feeds. P0 measures the public Policy Artifact behavior, not a second
          RulePack primitive.
        </p>
        <p>
          Measure it in two layers: primitive correctness for deterministic substrate behavior, and
          user value for whether the loop moves regulated work forward.
        </p>
      </DocsSection>

      <section className="space-y-5" aria-label="Phase 0 proof tables">
        <LoopStrip />
        <NormalizedTable
          label="Closed loop proof"
          title="What the wedge proves"
          description="The loop stays small, but each transition proves a reusable substrate primitive."
          columns={twoColumnTable}
          rows={loopProofRows}
        />
        <NormalizedTable
          label="1. Primitive correctness"
          title="Deterministic pass signals"
          description="These checks prove the substrate behaves correctly without asking users to trust the output."
          columns={primitiveColumns}
          rows={primitiveCorrectnessRows}
        />
        <NormalizedTable
          label="2. User value"
          title="Smallest valuable outcomes"
          description="These metrics prove the loop moves real work forward instead of only proving infrastructure."
          columns={userValueColumns}
          rows={userValueRows}
        />
      </section>
    </DocsPageShell>
  );
}

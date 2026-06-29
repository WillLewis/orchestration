import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import {
  Callout,
  DataTable,
  DocsPageShell,
  DocsSection,
  FlowSteps,
} from "@/components/docs/DocsPage";

export const Route = createFileRoute("/developers/use-cases")({
  head: () => ({
    meta: [
      { title: "Use Cases" },
      {
        name: "description",
        content:
          "How to choose which regulated decisions become Decision Briefs, and how use cases map to AgentRecipes.",
      },
    ],
  }),
  component: UseCasesDocsPage,
});

type Vertical = "finance" | "legal" | "health";

type UseCaseRow = {
  criterion: ReactNode;
  modelWhen: ReactNode;
  doNotModelWhen: ReactNode;
  examples: Record<Vertical, ReactNode>;
};

const VERTICALS: Vertical[] = ["finance", "legal", "health"];

const VERTICAL_LABELS: Record<Vertical, string> = {
  finance: "Finance",
  legal: "Legal",
  health: "Health",
};

const useCaseRows: UseCaseRow[] = [
  {
    criterion: "Governance weight",
    modelWhen: "The decision requires evidence, approval, policy, audit, or permissions.",
    doNotModelWhen: "The work is ordinary coordination with low consequence.",
    examples: {
      finance: "Approve a 22% pricing exception above delegated authority.",
      legal: "Approve a non-standard liability cap in a customer MSA.",
      health: "Approve release of a prior-authorization appeal packet with PHI controls.",
    },
  },
  {
    criterion: "Repeatability",
    modelWhen: "The decision class recurs and has a recognizable structure.",
    doNotModelWhen: "It is a one-off strategic debate with no stable pattern.",
    examples: {
      finance: "Credit renewals with pricing exceptions and covenant changes.",
      legal: "Contract redline exceptions against the legal playbook.",
      health: "Prior-authorization appeal packets assembled from clinical evidence.",
    },
  },
  {
    criterion: "Readiness criteria",
    modelWhen:
      "Ready can be expressed as rows: approver, evidence, conflict, threshold, or stale source.",
    doNotModelWhen: "Readiness is mostly subjective or conversational.",
    examples: {
      finance:
        "Credit Officer approval, Legal approval, final covenant tracker, CS-plan reconciliation.",
      legal:
        "Legal owner approval, verified clause citation, privilege check, final redline version.",
      health:
        "Attending sign-off, consent evidence, minimum-necessary PHI check, current protocol version.",
    },
  },
  {
    criterion: "Action path",
    modelWhen: "The system can stage a legitimate next action.",
    doNotModelWhen: "There is no governed next step beyond summarizing.",
    examples: {
      finance: "Route approval, request evidence, reconcile a source, seal the record.",
      legal: "Route Legal review, request clause evidence, apply an approved redline.",
      health: "Request missing consent, route clinical review, redact packet fields.",
    },
  },
  {
    criterion: "Source graph",
    modelWhen: "The decision depends on identifiable sources that can be cited and revalidated.",
    doNotModelWhen: "The decision has no durable evidence base.",
    examples: {
      finance: "Meeting, credit memo, financial model, approval workflow, customer success plan.",
      legal: "Email thread, MSA, redline, playbook, matter approval workflow.",
      health: "Care note, prior-auth form, consent record, protocol, reviewer task.",
    },
  },
  {
    criterion: "Business value",
    modelWhen: "The decision is frequent, costly, slow, or risky enough to justify modeling.",
    doNotModelWhen: "The cost of modeling exceeds the value of control.",
    examples: {
      finance: "High-volume exceptions that slow revenue or create approval risk.",
      legal: "Contract exceptions that slow deals or create negotiation risk.",
      health: "Documentation packets where missing evidence delays care or reimbursement.",
    },
  },
  {
    criterion: "Admin configurability",
    modelWhen:
      "An admin can define triggers, required evidence, Policy Artifact, readiness rows, and allowed actions.",
    doNotModelWhen: "It requires bespoke logic every time.",
    examples: {
      finance: "Any discount above 15% requires Credit Officer approval.",
      legal: "Any liability cap above the playbook limit requires Legal approval.",
      health: "Any external packet must pass minimum-necessary PHI policy before sharing.",
    },
  },
];

const recipeRows = [
  {
    recipeField: "Decision class",
    mapsTo: "The governed work object the agent is allowed to create.",
    example: {
      finance: "Acme renewal pricing exception",
      legal: "MSA redline exception review",
      health: "Prior-authorization appeal packet",
    },
  },
  {
    recipeField: "Trigger surfaces",
    mapsTo: "Where candidate decisions can be detected or invoked.",
    example: {
      finance: "Meeting rail, chat, credit memo comment, approval workflow.",
      legal: "Email thread, contract comment, Slack request, matter workflow.",
      health: "Care-team thread, task queue, packet comment, reviewer workflow.",
    },
  },
  {
    recipeField: "Source scopes",
    mapsTo: "Objects allowed into the permission-filtered ContextBundle.",
    example: {
      finance: "Memo, model, approval workflow, tracker, customer success plan.",
      legal: "MSA, redline, playbook, matter notes, approval workflow.",
      health: "Clinical note, consent form, protocol, packet draft, reviewer task.",
    },
  },
  {
    recipeField: "Policy Artifact",
    mapsTo: "Deterministic rules for readiness, blockers, thresholds, and refusals.",
    example: {
      finance: "finance_credit_v1",
      legal: "legal_contract_v1",
      health: "health_packet_v1",
    },
  },
  {
    recipeField: "Allowed ToolCards",
    mapsTo: "The actions that can be staged, validated, and human-approved.",
    example: {
      finance: "Route approval, request tracker, reconcile CS plan.",
      legal: "Route Legal review, request citation, accept redline diff.",
      health: "Route attending review, request consent, redact PHI fields.",
    },
  },
  {
    recipeField: "EvalPack",
    mapsTo: "Replay cases proving the recipe behaves safely before activation.",
    example: {
      finance: "Threshold, citation, approval, conflict, and stale-source cases.",
      legal: "Privilege, playbook exception, citation, and redline-version cases.",
      health: "PHI, consent, clinical-review, and protocol-version cases.",
    },
  },
];

const simplifiedFrameworkRows = [
  {
    dimension: "Governed",
    qualifiesWhen:
      "The decision needs evidence, approval, policy, or a permission boundary, draws on citable sources, and has a legitimate next action to stage.",
    disqualifiesWhen:
      "It is ordinary low-risk coordination with no durable evidence base and nothing to stage beyond a summary.",
    sharpestTest: (
      <>
        <strong className="font-semibold text-zinc-100">
          Is there a condition the agent must refuse outright?
        </strong>{" "}
        A clean hard-block line, such as 22% -&gt; no direct mutation, is the strongest signal.
      </>
    ),
  },
  {
    dimension: "Repeatable",
    qualifiesWhen:
      'It is a recurring decision class with recognizable structure, so "ready" decomposes into typed rows: approver, evidence, conflict, threshold, stale source.',
    disqualifiesWhen: "It is a one-off with no stable pattern and readiness is subjective.",
    sharpestTest: (
      <>
        <strong className="font-semibold text-zinc-100">
          Could an admin write the readiness rows once and have them fire every time?
        </strong>{" "}
        Credit renewal, contract redline, and data-access approval are strong candidates.
      </>
    ),
  },
  {
    dimension: "Expressible",
    qualifiesWhen:
      "An admin can define the trigger, required evidence, Policy Artifact, readiness rows, and allowed actions as an AgentRecipe - no bespoke code per instance.",
    disqualifiesWhen: "It needs bespoke logic every time.",
    sharpestTest: (
      <>
        <strong className="font-semibold text-zinc-100">
          Does it reduce to "any X above Y requires Z"?
        </strong>{" "}
        If yes, it is a recipe.
      </>
    ),
  },
];

function VerticalToggle({
  vertical,
  onChange,
}: {
  vertical: Vertical;
  onChange: (vertical: Vertical) => void;
}) {
  return (
    <div
      className="inline-flex max-w-full flex-wrap items-center rounded-lg border border-zinc-800 bg-zinc-900/50 p-1"
      data-docs-corpus-skip="true"
    >
      {VERTICALS.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={[
            "h-7 rounded-md px-3 text-[12px] font-medium transition-colors",
            vertical === item ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-200",
          ].join(" ")}
        >
          {VERTICAL_LABELS[item]}
        </button>
      ))}
      <span className="ml-2 mr-2 text-[10.5px] text-zinc-500">swaps every example</span>
    </div>
  );
}

function UseCasesDocsPage() {
  const [vertical, setVertical] = useState<Vertical>("finance");
  const exampleColumn = `${VERTICAL_LABELS[vertical]} example`;

  return (
    <DocsPageShell
      eyebrow="Getting started"
      title="Use Cases"
      description={
        <p>
          Model a decision when it has enough governance weight, repeatability, readiness criteria,
          actionability, and source evidence to justify becoming a Decision Brief. Meetings, Slack,
          email, documents, and workflows are capture surfaces. The use case is the decision class.
        </p>
      }
      related={[
        {
          label: "Agent Vision",
          to: "/developers/vision",
          description: "Why the agent moves from conversation summary to governed work.",
        },
        {
          label: "Primitives",
          to: "/developers/primitives",
          description: "The substrate objects each use case composes.",
        },
      ]}
    >
      <Callout title="Scoping rule">
        <p>
          Model decisions where the enterprise already has a shadow checklist, approval path, or
          audit burden. Do not turn every workplace choice into a Decision Brief.
        </p>
      </Callout>

      <DocsSection
        label="scope"
        title="Which decisions become briefs"
        aside={
          <FlowSteps
            steps={[
              {
                label: "detect",
                title: "Find a candidate decision",
                detail: "Signals can come from meetings, Slack, email, docs, tasks, or workflows.",
              },
              {
                label: "classify",
                title: "Match a configured use case",
                detail: "Only governed decision classes become Decision Briefs.",
              },
              {
                label: "govern",
                title: "Run the same substrate",
                detail: "Context, Policy Artifact, readiness rows, actions, lifecycle, record.",
              },
            ]}
          />
        }
      >
        <p>
          The mapping should be <code>decision class -&gt; Decision Brief</code>, not document to
          brief or meeting to brief. A single meeting can contain multiple decision candidates; a
          single source document can support many decisions.
        </p>
        <p>
          The product scales by keeping the capture surfaces broad while activating the governed
          path only for configured decision classes.
        </p>
      </DocsSection>

      <VerticalToggle vertical={vertical} onChange={setVertical} />

      <DataTable
        columns={[
          { key: "criterion", label: "Criterion" },
          { key: "modelWhen", label: "Model when" },
          { key: "doNotModelWhen", label: "Do not model when" },
          { key: "example", label: exampleColumn },
        ]}
        rows={useCaseRows.map(({ examples, ...row }) => ({
          ...row,
          example: examples[vertical],
        }))}
      />

      <DocsSection label="framework" title="Simplified framework">
        <p>
          The detailed test can be reduced to three questions. A decision class should be governed,
          repeatable, and expressible before it becomes a modeled use case.
        </p>
      </DocsSection>

      <DataTable
        columns={[
          { key: "dimension", label: "Dimension" },
          { key: "qualifiesWhen", label: "Qualifies when..." },
          { key: "disqualifiesWhen", label: "Disqualifies when..." },
          { key: "sharpestTest", label: "Sharpest test" },
        ]}
        rows={simplifiedFrameworkRows}
      />

      <DocsSection label="recipes" title="Use cases map to AgentRecipes">
        <p>
          An <code>AgentRecipe</code> is the configuration object that turns a use case into a
          governed runtime path. It tells the agent which decision class it may create, which
          surfaces can trigger it, which sources are in scope, which Policy Artifact evaluates it,
          which ToolCards are allowed, and which EvalPack proves it before activation.
        </p>
        <p>
          That keeps expansion from becoming bespoke workflow code. Finance, Legal, and Health swap
          recipes, policy artifacts, and eval packs while sharing the same context, gating, action,
          lifecycle, and record substrate.
        </p>
      </DocsSection>

      <DataTable
        columns={[
          { key: "recipeField", label: "AgentRecipe field" },
          { key: "mapsTo", label: "Maps to" },
          { key: "example", label: exampleColumn },
        ]}
        rows={recipeRows.map(({ example, ...row }) => ({
          ...row,
          example: example[vertical],
        }))}
      />
    </DocsPageShell>
  );
}

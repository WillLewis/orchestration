import type { ReactNode } from "react";

import {
  Callout,
  CodeBlock,
  DataTable,
  DocLink,
  DocsPageShell,
  DocsSection,
  EndpointList,
  FlowSteps,
  SignalList,
  StatGrid,
  type RelatedLink,
} from "@/components/docs/DocsPage";
import { action_plan, cascade_action, tool_labels } from "@/data/actions";
import {
  decision_brief,
  decision_readiness,
  rulepack_id,
  rulepack_version,
  sources,
} from "@/data/brief";
import { gatingExamples } from "@/data/gating";
import { loop_state, loop_ui, escalationsInFlightLabel } from "@/data/loop";
import {
  METRIC_LABELS,
  TAXONOMY_LABELS,
  eval_rows,
  failure_taxonomy,
  privacy,
  recipes,
  telemetry_sample,
  vertical_scores,
} from "@/data/ops";
import {
  governance_certificate,
  verify_result_financials,
  verify_result_stale,
} from "@/data/record";
import type { DeveloperDocPageId } from "@/data/developerDocMeta";

type PageDefinition = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  related: RelatedLink[];
  content: () => ReactNode;
};

const financeReplay = gatingExamples.finance.replayResponse;
const approvalBurden = financeReplay.approval_burden as {
  escalations: number;
  est_per_week: number;
  by_approver: Record<string, number>;
};
const topFailureModes = financeReplay.top_failure_modes as Array<{ mode: string; count: number }>;
const regressionStats = financeReplay.regression as { passed: number; total: number };
const dscr = decision_brief.policy_gates.calculations[0];
const routeApprovalAction = action_plan.actions.find((action) => action.tool === "route_approval");
const blockedAction = action_plan.actions.find((action) => action.blocked_reason);

function Pill({
  children,
  tone = "zinc",
}: {
  children: ReactNode;
  tone?: "green" | "red" | "amber" | "zinc";
}) {
  const cls =
    tone === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "red"
        ? "border-red-500/30 bg-red-500/10 text-red-300"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
          : "border-zinc-700 bg-zinc-900 text-zinc-300";

  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

function pct(value: unknown) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : String(value);
}

function labelMetric(key: string) {
  return METRIC_LABELS[key] ?? key.replace(/_/g, " ");
}

function metricRows(metrics: Record<string, number>) {
  return Object.entries(metrics).map(([metric, value]) => ({
    metric: labelMetric(metric),
    value: pct(value),
  }));
}

function statusTone(status: string): "green" | "red" | "amber" | "zinc" {
  if (["used", "approved", "passed", "ready", "current"].includes(status)) return "green";
  if (["missing", "blocking", "blocked", "restricted", "stale"].includes(status)) return "red";
  if (["pending", "conflicting", "escalated"].includes(status)) return "amber";
  return "zinc";
}

const pages: Record<DeveloperDocPageId, PageDefinition> = {
  metrics: {
    eyebrow: "Getting started",
    title: "Success Metrics",
    description: (
      <p>
        The north star is decision-to-closed-work-product cycle time for regulated review. Every
        other metric is a driver or guardrail: permission safety, deterministic rule pass rate,
        citation support, approval burden, freshness, latency, and cost.
      </p>
    ),
    related: [
      {
        label: "Roadmap",
        to: "/developers/roadmap",
        description: "How the metrics line up with the phased build.",
      },
      {
        label: "Eval Trace",
        to: "/developers/eval-trace",
        description: "Where these scores are generated and replayed.",
      },
    ],
    content: MetricsPage,
  },
  risks: {
    eyebrow: "Getting started",
    title: "Risks & Mitigations",
    description: (
      <p>
        The product gets more valuable exactly when it gets more exposed: it reads across the
        workspace and can propose changes. The mitigation is to make every risky boundary explicit,
        deterministic, and reviewable before anything commits.
      </p>
    ),
    related: [
      {
        label: "Context Assembly",
        to: "/developers/context-assembly",
        description: "Permission filtering and mosaic protection start before retrieval.",
      },
      {
        label: "Action Packets",
        to: "/developers/action-packets",
        description: "How risky writes are previewed, approved, or blocked.",
      },
    ],
    content: RisksPage,
  },
  contextAssembly: {
    eyebrow: "Substrate",
    title: "Context Assembly",
    description: (
      <p>
        Context assembly turns a user and intent into a permission-safe <code>ContextBundle</code>.
        The permission filter runs first, then the assembler builds sources, claims, missing
        evidence, conflicts, and a source graph over only the objects the user may use.
      </p>
    ),
    related: [
      {
        label: "RAG",
        to: "/developers/rag",
        description: "Read from the assembled bundle, scoped to accessible sources.",
      },
      {
        label: "Deterministic Gating",
        to: "/developers/gating",
        description: "The gate consumes the same bundle and never sees denied content.",
      },
    ],
    content: ContextAssemblyPage,
  },
  actionDiff: {
    eyebrow: "Substrate",
    title: "Action Diff",
    description: (
      <p>
        The action diff is the write boundary. Before an agent changes a workflow, routes an
        approval, creates a task, or edits a document, the user sees the exact before and after
        fields that would change.
      </p>
    ),
    related: [
      {
        label: "Decision Brief",
        to: "/developers/decision-brief",
        description: "The typed work product that supplies next steps.",
      },
      {
        label: "Action Packets",
        to: "/developers/action-packets",
        description: "How multiple previewed diffs become governed action packets.",
      },
    ],
    content: ActionDiffPage,
  },
  evalTrace: {
    eyebrow: "Substrate",
    title: "Eval Trace",
    description: (
      <p>
        Eval traces keep the agent measurable. Eval packs run cases through the same substrate,
        score content-free signals, and replay persisted records without storing raw prompts,
        documents, transcripts, or responses.
      </p>
    ),
    related: [
      {
        label: "Success Metrics",
        to: "/developers/metrics",
        description: "The product and trust metrics generated from eval traces.",
      },
      {
        label: "AI Studio",
        to: "/developers/ai-studio",
        description: "Where admins author policy artifacts and replay them before activation.",
      },
    ],
    content: EvalTracePage,
  },
  complianceTrace: {
    eyebrow: "Substrate",
    title: "Compliance Trace",
    description: (
      <p>
        Compliance Trace is the deterministic record of why the gate passed or failed. It carries
        rule firings, approval matrix state, calculation checks, schema validation, and the policy
        artifact id and version.
      </p>
    ),
    related: [
      {
        label: "Deterministic Gating",
        to: "/developers/gating",
        description: "The policy model behind these trace objects.",
      },
      {
        label: "Audit log",
        to: "/developers/audit-log",
        description: "How deterministic decisions are carried into execution records.",
      },
    ],
    content: ComplianceTracePage,
  },
  rag: {
    eyebrow: "Read",
    title: "RAG",
    description: (
      <p>
        Retrieval-augmented generation is read-only here. It grounds the answer in the
        permission-filtered bundle, cites accessible sources, surfaces missing evidence, and refuses
        to summarize restricted material.
      </p>
    ),
    related: [
      {
        label: "Context Assembly",
        to: "/developers/context-assembly",
        description: "The bundle RAG reads from.",
      },
      {
        label: "Decision Brief",
        to: "/developers/decision-brief",
        description: "The first structured work product built from grounded claims.",
      },
    ],
    content: RagPage,
  },
  decisionBrief: {
    eyebrow: "Read",
    title: "Decision Brief",
    description: (
      <p>
        The Decision Brief is the agent's first governed work product: a typed summary of the
        decision, facts, changes, gate state, missing evidence, conflicts, open questions, and next
        steps.
      </p>
    ),
    related: [
      {
        label: "RAG",
        to: "/developers/rag",
        description: "How grounded claims become brief sections.",
      },
      {
        label: "Action Diff",
        to: "/developers/action-diff",
        description: "How next steps become previewed changes.",
      },
    ],
    content: DecisionBriefPage,
  },
  insightCards: {
    eyebrow: "Read",
    title: "Insight Cards",
    description: (
      <p>
        Insight cards are proactive, read-only signals. They tell the user what changed, what is
        missing, which approval is open, and whether a sealed record has gone stale before the user
        asks.
      </p>
    ),
    related: [
      {
        label: "Decision Brief",
        to: "/developers/decision-brief",
        description: "The structured decision state that many cards summarize.",
      },
      {
        label: "Revalidation",
        to: "/developers/revalidation",
        description: "How cards learn that a sealed decision is stale.",
      },
    ],
    content: InsightCardsPage,
  },
  actionPackets: {
    eyebrow: "Actions",
    title: "Action Packets",
    description: (
      <p>
        Action packets package proposed tool calls with sources, side-effect class, risk, required
        approver, blocked reason, and an exact diff. The model proposes; the deterministic engine
        decides whether each action can run.
      </p>
    ),
    related: [
      {
        label: "Action Diff",
        to: "/developers/action-diff",
        description: "The preview surface inside every packet.",
      },
      {
        label: "Orchestration",
        to: "/developers/orchestration",
        description: "How approved packets fan out to owners.",
      },
    ],
    content: ActionPacketsPage,
  },
  orchestration: {
    eyebrow: "Actions",
    title: "Orchestration",
    description: (
      <p>
        The controlled work loop distributes follow-ups, collects replies, escalates blocked
        approvals, schedules the next step, and closes the loop cycle without claiming every item is
        resolved.
      </p>
    ),
    related: [
      {
        label: "Action Packets",
        to: "/developers/action-packets",
        description: "The governed inputs the loop distributes.",
      },
      {
        label: "Audit log",
        to: "/developers/audit-log",
        description: "The execution record emitted by approved actions.",
      },
    ],
    content: OrchestrationPage,
  },
  auditLog: {
    eyebrow: "Actions",
    title: "Audit log",
    description: (
      <p>
        Audit log is the ordered execution record. It captures what was approved, what ran, what was
        skipped, who acted, and the details needed to build a rollback plan or a governed record.
      </p>
    ),
    related: [
      {
        label: "Action Packets",
        to: "/developers/action-packets",
        description: "Every audit event starts from a gated action packet.",
      },
      {
        label: "Sealed records",
        to: "/developers/sealed-records",
        description: "How audit and provenance become a durable work product.",
      },
    ],
    content: AuditLogPage,
  },
  sealedRecords: {
    eyebrow: "Lifecycle",
    title: "Sealed records",
    description: (
      <p>
        A sealed record turns the decision packet into a governed work product. It stores the brief,
        gate result, source-version snapshot, permission omissions, dependency map, and integrity
        seal.
      </p>
    ),
    related: [
      {
        label: "Audit log",
        to: "/developers/audit-log",
        description: "Execution provenance that can be carried into records.",
      },
      {
        label: "Revalidation",
        to: "/developers/revalidation",
        description: "How a sealed record detects that it is no longer fresh.",
      },
    ],
    content: SealedRecordsPage,
  },
  revalidation: {
    eyebrow: "Lifecycle",
    title: "Revalidation",
    description: (
      <p>
        Revalidation keeps sealed work products true after sources change. A source event maps into
        affected sections, stale states, gate changes, and reapproval routes.
      </p>
    ),
    related: [
      {
        label: "Sealed records",
        to: "/developers/sealed-records",
        description: "The pinned contract that revalidation checks.",
      },
      {
        label: "Insight Cards",
        to: "/developers/insight-cards",
        description: "How stale states surface proactively.",
      },
    ],
    content: RevalidationPage,
  },
  aiStudio: {
    eyebrow: "Lifecycle",
    title: "AI Studio",
    description: (
      <p>
        AI Studio is the admin surface for authoring recipes, policy artifacts, and eval packs. It
        opens the primitives once the core patterns are proven: draft, replay, review, activate,
        monitor, and roll back.
      </p>
    ),
    related: [
      {
        label: "Deterministic Gating",
        to: "/developers/gating",
        description: "The policy artifact lifecycle AI Studio manages.",
      },
      {
        label: "Verticals",
        to: "/developers/verticals",
        description: "How authored recipes generalize across industries.",
      },
    ],
    content: AiStudioPage,
  },
  verticals: {
    eyebrow: "Lifecycle",
    title: "Verticals",
    description: (
      <p>
        Vertical expansion swaps recipes, policy artifacts, and eval packs while keeping the same
        substrate: permission-aware context, deterministic gates, action packets, lifecycle, and
        privacy-preserving evals.
      </p>
    ),
    related: [
      {
        label: "AI Studio",
        to: "/developers/ai-studio",
        description: "Where vertical packs are authored and replayed.",
      },
      {
        label: "Eval Trace",
        to: "/developers/eval-trace",
        description: "How each vertical proves it passes the same substrate checks.",
      },
    ],
    content: VerticalsPage,
  },
};

export function DeveloperDocPage({ pageId }: { pageId: DeveloperDocPageId }) {
  const page = pages[pageId];

  return (
    <DocsPageShell
      eyebrow={page.eyebrow}
      title={page.title}
      description={page.description}
      related={page.related}
    >
      {page.content()}
    </DocsPageShell>
  );
}

function MetricsPage() {
  const financeScore = vertical_scores.finance;

  return (
    <>
      <StatGrid
        stats={[
          {
            label: "North star",
            value: "decision -> closed",
            detail:
              "Cycle time from discussed decision to sealed, governed work product with open follow-ups routed.",
          },
          {
            label: "Replay sample",
            value: String(financeReplay.cases_evaluated),
            detail: "Finance replay cases evaluated before a policy artifact is activated.",
          },
          {
            label: "Regression",
            value: `${regressionStats.passed} / ${regressionStats.total}`,
            detail: "Regression checks passing for the finance policy replay.",
          },
          {
            label: "Guardrail leaks",
            value: String(financeReplay.permission_leaks),
            detail:
              "Permission leaks, unsupported approval claims, and stale-source misses stay at zero.",
          },
        ]}
      />

      <DocsSection
        label="drivers"
        title="Measure value and trust separately"
        aside={
          <DataTable
            columns={[
              { key: "metric", label: "Metric" },
              { key: "value", label: "Value", align: "right" },
            ]}
            rows={[
              { metric: "Projected block rate", value: pct(financeReplay.projected_block_rate) },
              {
                metric: "Policy violations caught",
                value: String(financeReplay.policy_violations_caught),
              },
              { metric: "Approval escalations", value: approvalBurden.escalations },
              { metric: "Estimated p95 latency", value: `${financeReplay.est_latency_p95_ms} ms` },
              { metric: "Estimated replay cost", value: `$${financeReplay.est_cost_usd}` },
            ]}
          />
        }
      >
        <p>
          The product goal is not "more agent output." It is fewer manual handoffs between a
          decision and a finished record. The guardrails make that value safe: zero permission
          leaks, zero unsupported approval claims, zero stale-source misses, and no raw content in
          telemetry.
        </p>
        <p>
          The finance replay makes those guardrails visible before deployment. It estimates approval
          burden, caught violations, latency, and cost so admins can see operational impact before a
          Policy Artifact becomes active.
        </p>
      </DocsSection>

      <DocsSection
        label="evals"
        title="The three-vertical proof is part of the score"
        aside={
          <DataTable
            dense
            columns={[
              { key: "metric", label: "Finance metric" },
              { key: "value", label: "Score", align: "right" },
            ]}
            rows={metricRows(financeScore.metrics)}
          />
        }
      >
        <p>
          Success also means the same substrate works outside finance. The Agent Ops scorecard
          tracks finance, legal, and health recipes over deterministic rule pass, citation
          correctness, permission denial, missing evidence honesty, and vertical-specific gates.
        </p>
        <p>
          Lower-level metrics stay content-free. Rows expose intent classes, expected signals, and
          observed signals; they do not expose prompts, documents, transcripts, or response text.
        </p>
      </DocsSection>

      <Callout title="Operating readout">
        <p>
          The operational readout combines cycle time, approval burden, replay pass rate, privacy
          telemetry, and freshness. A faster agent that leaks content, bypasses a gate, or silently
          goes stale does not count as successful.
        </p>
      </Callout>
    </>
  );
}

function RisksPage() {
  return (
    <>
      <DataTable
        columns={[
          { key: "risk", label: "Risk" },
          { key: "mitigation", label: "Mitigation" },
          { key: "owner", label: "Primitive" },
        ]}
        rows={[
          {
            risk: "Permission leakage",
            mitigation: "Permission filter runs before retrieval; denied ids stay in the boundary.",
            owner: <DocLink to="/developers/context-assembly">Context Assembly</DocLink>,
          },
          {
            risk: "Hallucinated fact or citation",
            mitigation: "Unsupported claims become open questions; evals score citation support.",
            owner: <DocLink to="/developers/rag">RAG</DocLink>,
          },
          {
            risk: "Approval or policy bypass",
            mitigation: "WS-C owns pass/fail; WS-E recomputes blocked_reason server-side.",
            owner: <DocLink to="/developers/gating">Gating</DocLink>,
          },
          {
            risk: "Stale work product",
            mitigation: "Source dependency graph marks sections stale and emits reapproval routes.",
            owner: <DocLink to="/developers/revalidation">Revalidation</DocLink>,
          },
          {
            risk: "Approval fatigue",
            mitigation: "Replay estimates escalation volume before activation.",
            owner: <DocLink to="/developers/metrics">Metrics</DocLink>,
          },
          {
            risk: "Prompt injection",
            mitigation: "Action engine strips hidden-instruction content and blocks action use.",
            owner: <DocLink to="/developers/action-packets">Action Packets</DocLink>,
          },
          {
            risk: "Raw telemetry exposure",
            mitigation:
              "TelemetryEvent forbids extra raw fields; aggregates use k-anonymity and DP.",
            owner: <DocLink to="/developers/eval-trace">Eval Trace</DocLink>,
          },
          {
            risk: "Vertical drift",
            mitigation:
              "Each vertical ships as recipe + policy artifact + eval pack over shared primitives.",
            owner: <DocLink to="/developers/verticals">Verticals</DocLink>,
          },
        ]}
      />

      <DocsSection
        label="boundary"
        title="The risky transition is read to write"
        aside={
          <FlowSteps
            steps={[
              {
                label: "read",
                title: "Permission-safe context",
                detail: "Only accessible sources become claims, citations, or prompts.",
              },
              {
                label: "decide",
                title: "Deterministic gate",
                detail: "Policy and approval readiness are computed, not drafted.",
              },
              {
                label: "write",
                title: "Previewed action",
                detail: "Every side effect is diffed, approved, audited, and rollback-capable.",
              },
            ]}
          />
        }
      >
        <p>
          A read-only assistant can be wrong and still only produce text. A governed agent can
          change work. The platform treats that transition as a protocol boundary: deterministic
          policy and human approval sit between model output and side effects.
        </p>
      </DocsSection>

      <Callout title="Fail closed">
        <p>
          The recurring rule is fail closed. Missing evidence blocks status advancement, restricted
          content is acknowledged but not summarized, stale records are marked stale, and model
          output never clears a hard gate.
        </p>
      </Callout>
    </>
  );
}

function ContextAssemblyPage() {
  return (
    <>
      <DocsSection
        label="pipeline"
        title="From workspace objects to a usable bundle"
        aside={
          <FlowSteps
            steps={[
              {
                label: "objects",
                title: "Load workspace",
                detail: "Documents, meetings, workflows, tasks, chats, and ACL metadata.",
              },
              {
                label: "permissions",
                title: "Filter first",
                detail: "Restricted and barrier-crossing objects are excluded before content use.",
              },
              {
                label: "claims",
                title: "Scrub citations",
                detail: "Claims are supported only if at least one accessible citation remains.",
              },
              {
                label: "bundle",
                title: "Emit ContextBundle",
                detail: "Sources, SourceGraph, ClaimMap, missing evidence, conflicts, boundary.",
              },
            ]}
          />
        }
      >
        <p>
          The assembler implements the <code>ContextAssembler</code> protocol. Its output is the
          shared input to RAG, the verifier, the brief synthesizer, action validation, and
          revalidation.
        </p>
        <p>
          For Acme, the relationship manager can use the meeting, credit memo, financial model, and
          approval workflow. The restricted legal memo is excluded, and barrier material that would
          cross a public/private information wall is held out.
        </p>
      </DocsSection>

      <DocsSection
        label="api"
        title="Debug the exact context used downstream"
        aside={
          <CodeBlock
            method="POST"
            path="/context"
            body={{
              user_id: "u_rm",
              intent: "prepare_decision_brief",
              sources: ["mtg_committee_0612", "doc_credit_memo", "doc_financials", "wf_approval"],
              source_graph: {
                edges: [
                  { from_id: "doc_credit_memo", to_id: "doc_financials", relation: "derived_from" },
                  { from_id: "mtg_committee_0612", to_id: "doc_credit_memo", relation: "cites" },
                ],
              },
              permission_boundary: {
                excluded_object_ids: ["doc_legal_memo"],
                reason: "permission_restricted",
              },
              missing_evidence: ["missing_covenant_tracker"],
              conflicts: ["Pricing doc and CS plan show different discount levels."],
            }}
          />
        }
      >
        <p>
          <code>/context</code> is primarily a debugging endpoint. It lets developers inspect the
          precise bundle that downstream stages consume, including denied source ids and missing
          evidence codes.
        </p>
      </DocsSection>

      <SignalList
        items={[
          {
            title: "Permission filter runs first",
            detail: "Denied content never enters sources, claims, graphs, prompts, or summaries.",
          },
          {
            title: "Claim support is deterministic",
            detail: "An LLM may propose claims, but citation scrubbing decides support.",
          },
          {
            title: "Mosaic protection is explicit",
            detail: "Readable barrier-tagged material can still be held out of a shared packet.",
            tone: "warn",
          },
        ]}
      />
    </>
  );
}

function ActionDiffPage() {
  return (
    <>
      <DocsSection
        label="preview"
        title="Every write starts as a diff"
        aside={
          <CodeBlock
            title="ActionDiff"
            body={{
              tool: routeApprovalAction?.tool,
              reason: routeApprovalAction?.reason,
              required_approver: routeApprovalAction?.required_approver,
              diff: routeApprovalAction?.diff,
            }}
          />
        }
      >
        <p>
          Action Diff makes the user's approval concrete. The agent does not ask for permission to
          "handle this." It shows the target object, source evidence, side-effect class, required
          approver, and exact before/after values.
        </p>
        <p>
          The same shape powers dry runs and rollback. A new task has an empty <code>before</code>;
          a workflow update or document edit shows the changed fields.
        </p>
      </DocsSection>

      <DocsSection
        label="execution"
        title="Diffs are still gated before execution"
        aside={
          <EndpointList
            endpoints={[
              { method: "POST", path: "/actions/compose", note: "Return previewable ActionPlan" },
              {
                method: "POST",
                path: "/actions/execute",
                note: "Recompose and execute approved indices",
              },
            ]}
          />
        }
      >
        <p>
          A client cannot submit a hand-edited plan to bypass the gate.{" "}
          <code>/actions/execute</code>
          recomposes the server-side plan, checks approved indices against non-blocked actions, and
          emits audit events only for actions that are still executable.
        </p>
      </DocsSection>

      <Callout title="Approval target">
        <p>
          The approved object is the specific diff. If the source changes after preview, the agent
          must re-run composition and show the updated diff before commit.
        </p>
      </Callout>
    </>
  );
}

function EvalTracePage() {
  return (
    <>
      <DocsSection
        label="loop"
        title="Cases run through the same substrate"
        aside={
          <CodeBlock
            title="EvalTrace"
            body={{
              case_id: "fin_thresh_01",
              model: "offline_stub",
              source_types: ["document", "workflow"],
              rule_firings: [{ rule_id: "approval_threshold", passed: true }],
              citation_coverage: 0.97,
              claim_support: 0.95,
              latency_ms: 240,
              cost_usd: 1.92,
            }}
          />
        }
      >
        <p>
          Eval packs are not separate demos. They exercise the same typed primitives the product
          uses: context, verifier, brief, action safety, lifecycle, and telemetry. Replay records
          can be rescored without re-running the pipeline because the scoring view is content-free.
        </p>
      </DocsSection>

      <DocsSection
        label="ops"
        title="Agent Ops shows typed signals, not raw content"
        aside={
          <DataTable
            dense
            columns={[
              { key: "case", label: "Case" },
              { key: "check", label: "Check" },
              { key: "status", label: "Status", align: "right" },
            ]}
            rows={eval_rows.slice(0, 6).map((row) => ({
              case: row.case_id,
              check: row.check,
              status: (
                <Pill tone={row.passed ? "green" : "amber"}>
                  {row.passed ? "passed" : "review"}
                </Pill>
              ),
            }))}
          />
        }
      >
        <p>
          The drill-in on a failed row contains <code>input_class</code>, expected signal, observed
          signal, and failure category. It intentionally omits the prompt, response, document text,
          and transcript.
        </p>
        <p>
          Telemetry is safe by construction: <code>TelemetryEvent</code> forbids extra fields, and
          aggregate learning is gated by privacy thresholds and differential privacy budget.
        </p>
      </DocsSection>

      <CodeBlock title="TelemetryEvent sample" body={telemetry_sample} />
    </>
  );
}

function ComplianceTracePage() {
  return (
    <>
      <DocsSection
        label="decision"
        title="The deterministic decision is the authority"
        aside={
          <CodeBlock
            method="POST"
            path="/verify"
            body={{
              approval_ready: decision_brief.policy_gates.approval_ready,
              firings: decision_brief.policy_gates.firings,
              approvals: decision_brief.required_approvals,
              calculations: decision_brief.policy_gates.calculations,
              rulepack_id,
              rulepack_version,
            }}
          />
        }
      >
        <p>
          Compliance Trace is the machine-readable reason a work product is or is not
          approval-ready. The LLM can explain the result in prose, but it never changes
          <code>approval_ready</code>, rule firings, approval requirements, or calculations.
        </p>
      </DocsSection>

      <DocsSection
        label="checks"
        title="Rules carry evidence, not just labels"
        aside={
          <DataTable
            columns={[
              { key: "check", label: "Check" },
              { key: "result", label: "Result" },
              { key: "detail", label: "Detail" },
            ]}
            rows={[
              ...decision_brief.policy_gates.firings.map((firing) => ({
                check: firing.rule_id,
                result: (
                  <Pill tone={firing.passed ? "green" : "red"}>
                    {firing.passed ? "pass" : "fail"}
                  </Pill>
                ),
                detail: firing.detail,
              })),
              {
                check: dscr.name,
                result: <Pill tone={dscr.matches ? "green" : "red"}>{dscr.computed}</Pill>,
                detail: `${dscr.formula}; tolerance ${dscr.tolerance}`,
              },
            ]}
          />
        }
      >
        <p>
          Threshold rules carry the typed numbers behind the outcome, and calculation checks carry
          inputs, formula, expected value, computed value, and tolerance. The Acme example is
          intentionally legible: 22 percent requested exceeds 15 percent authority.
        </p>
      </DocsSection>

      <Callout title="Trace scope">
        <p>
          Compliance Trace explains deterministic policy. It does not replace the broader audit log,
          which records later human approvals and executed actions.
        </p>
      </Callout>
    </>
  );
}

function RagPage() {
  const sourceRows = sources.slice(0, 9).map((source) => ({
    source: source.title,
    type: source.type,
    status: <Pill tone={statusTone(source.status)}>{source.status}</Pill>,
  }));

  return (
    <>
      <DocsSection
        label="grounding"
        title="RAG reads the ContextBundle, not the whole workspace"
        aside={
          <DataTable
            dense
            columns={[
              { key: "source", label: "Source" },
              { key: "type", label: "Type" },
              { key: "status", label: "Status", align: "right" },
            ]}
            rows={sourceRows}
          />
        }
      >
        <p>
          The retrieval layer is scoped to accessible, assembled sources. Used sources can support
          facts; conflicting sources are surfaced as conflicts; missing sources are named as gaps;
          restricted sources are acknowledged as unavailable and never summarized.
        </p>
      </DocsSection>

      <DocsSection
        label="claims"
        title="Unsupported claims become questions"
        aside={
          <SignalList
            items={[
              {
                title: "Supported",
                detail: "Revenue forecast revised from $42M to $38M with financial model citation.",
              },
              {
                title: "Missing",
                detail: "Final covenant tracker not uploaded; blocking evidence gap.",
                tone: "block",
              },
              {
                title: "Restricted",
                detail: "Legal memo is excluded because the user lacks clearance.",
                tone: "warn",
              },
            ]}
          />
        }
      >
        <p>
          RAG does not decide approval-readiness. It supplies the grounded material that the
          verifier and brief consume. Unsupported claims stay visible as limitations or open
          questions so the agent does not fill a missing source with plausible prose.
        </p>
      </DocsSection>

      <Callout title="Read-only phase">
        <p>
          In Phase 1, grounding delivers value without changing anything: answer from the right
          sources, cite the evidence, show gaps, and leave writes to the gated action layer.
        </p>
      </Callout>
    </>
  );
}

function DecisionBriefPage() {
  return (
    <>
      <DocsSection
        label="shape"
        title="The brief is a typed work product"
        aside={
          <CodeBlock
            method="POST"
            path="/brief"
            body={{
              decision_needed: decision_brief.decision_needed,
              confidence: decision_brief.confidence,
              policy_gates: {
                approval_ready: decision_brief.policy_gates.approval_ready,
              },
              next_steps: decision_brief.next_steps,
            }}
          />
        }
      >
        <p>
          The brief synthesizer drafts language from already-filtered evidence, but structured
          control fields are copied through from deterministic stages. The gate result remains
          unchanged, required approvals remain unchanged, and unsupported evidence becomes open
          questions or limitations.
        </p>
      </DocsSection>

      <DocsSection
        label="readiness"
        title="Readiness rows explain what blocks the packet"
        aside={
          <DataTable
            columns={[
              { key: "gate", label: "Gate" },
              { key: "status", label: "Status", align: "right" },
              { key: "details", label: "Details" },
            ]}
            rows={decision_readiness.rows.map((row) => ({
              gate: row.gate,
              status: <Pill tone={statusTone(row.status)}>{row.status}</Pill>,
              details: row.details,
            }))}
          />
        }
      >
        <p>
          Readiness is the user-facing view of the same deterministic state. It points to concrete
          remediation actions, such as routing the Credit Officer approval or creating a task for
          the missing covenant tracker.
        </p>
      </DocsSection>

      <Callout title="Never override the gate">
        <p>
          The Acme packet remains not approval-ready even when the prose is well formed. Confidence
          reflects evidence quality and gate state; it is not a substitute for approval readiness.
        </p>
      </Callout>
    </>
  );
}

function InsightCardsPage() {
  return (
    <>
      <DocsSection
        label="cards"
        title="Cards turn substrate state into proactive signals"
        aside={
          <SignalList
            items={[
              {
                title: "Changed source",
                detail:
                  "Financial model changed from revenue $38M to $36.5M and DSCR 1.28 to 1.18.",
                tone: "warn",
              },
              {
                title: "Blocking evidence",
                detail: "Final covenant tracker is missing and blocks status advancement.",
                tone: "block",
              },
              {
                title: "Open approval",
                detail: "Credit Officer approval is required because 22 percent exceeds authority.",
                tone: "warn",
              },
              {
                title: "Stale record",
                detail: "Legal workflow changed to Needs Review after the packet was sealed.",
                tone: "block",
              },
            ]}
          />
        }
      >
        <p>
          Insight cards are not a separate reasoning layer. They are small projections of existing
          typed state: context missing evidence, brief readiness rows, action plan blockers,
          compliance trace firings, and revalidation results.
        </p>
      </DocsSection>

      <DocsSection
        label="safety"
        title="A card can suggest, but not commit"
        aside={
          <CodeBlock
            title="card source"
            body={{
              kind: "open_approval",
              source: "decision_readiness.rows[credit_officer_approval]",
              suggested_action: decision_readiness.rows[1].action,
              commit_path: "/actions/compose",
            }}
          />
        }
      >
        <p>
          A proactive card may offer to route an approval or create a task, but it does so by moving
          into Action Packets. The card itself stays read-only; writes still require diff preview,
          gate validation, and human approval.
        </p>
      </DocsSection>
    </>
  );
}

function ActionPacketsPage() {
  return (
    <>
      <DocsSection
        label="packet"
        title="Actions are tool calls with governance attached"
        aside={
          <DataTable
            columns={[
              { key: "tool", label: "Tool" },
              { key: "effect", label: "Effect" },
              { key: "status", label: "Status", align: "right" },
            ]}
            rows={action_plan.actions.map((action) => ({
              tool: tool_labels[action.tool],
              effect: action.side_effect,
              status: (
                <Pill
                  tone={
                    action.blocked_reason ? "red" : action.required_approver ? "amber" : "green"
                  }
                >
                  {action.blocked_reason
                    ? "blocked"
                    : action.required_approver
                      ? "approval"
                      : "ready"}
                </Pill>
              ),
            }))}
          />
        }
      >
        <p>
          <code>SafeActionComposer</code> maps brief next steps onto registered ToolCards, then the
          deterministic engine validates permission, mosaic, injection, missing evidence, and
          approval gates. Model-supplied safety claims are ignored.
        </p>
      </DocsSection>

      <DocsSection
        label="blocked"
        title="Blocked actions remain visible but unexecutable"
        aside={<CodeBlock title="blocked action" body={blockedAction} />}
      >
        <p>
          The blocked action in the Acme packet proposes scheduling the final committee meeting. The
          engine keeps it blocked because the covenant tracker and Credit Officer approval are still
          unresolved.
        </p>
        <p>
          This is important product behavior: the agent can show what it would do next without
          pretending the prerequisite is complete.
        </p>
      </DocsSection>

      <Callout title="Rollback-ready">
        <p>
          Executed packets emit audit events with enough before/after detail to build a rollback
          plan. Preview, approval, execution, audit, and rollback all refer to the same diff.
        </p>
      </Callout>
    </>
  );
}

function OrchestrationPage() {
  return (
    <>
      <DocsSection
        label="loop"
        title="The controlled loop is deterministic state transition"
        aside={
          <FlowSteps
            steps={[
              {
                label: "distribute",
                title: "Assign owners",
                detail: "Route action packets to Credit, Legal, and Analyst.",
              },
              {
                label: "collect",
                title: "Gather replies",
                detail: "Record sign-off, escalation, or acknowledgement.",
              },
              {
                label: "escalate",
                title: "Handle blocked owners",
                detail: "Legal escalates covenant modification to Compliance.",
              },
              {
                label: "schedule",
                title: "Queue next meeting",
                detail: "Schedule only after prerequisites are understood.",
              },
              {
                label: "close",
                title: "Close cycle",
                detail: "Cycle completes even while escalation remains open.",
              },
            ]}
          />
        }
      >
        <p>
          The loop runs on action packets and personas, but control flow is deterministic. Replies
          can be model-drafted in the future; assignments, escalations, approvals, scheduled work,
          and audit remain typed state.
        </p>
      </DocsSection>

      <DocsSection
        label="state"
        title="Closed means cycle-completed, not fully resolved"
        aside={
          <CodeBlock
            method="POST"
            path="/actions/loop"
            body={{
              assignments: loop_state.assignments.length,
              replies: loop_state.replies.length,
              escalations: loop_state.escalations,
              scheduled: loop_state.scheduled,
              closed: loop_state.closed,
              open_summary: loop_ui.open_summary,
            }}
          />
        }
      >
        <p>
          <code>LoopState.closed</code> mirrors the backend: the loop cycle finished. The UI derives
          "open" status from escalations and unresolved prerequisites. In the Acme mock,{" "}
          {escalationsInFlightLabel(loop_state)} keeps the loop open.
        </p>
      </DocsSection>
    </>
  );
}

function AuditLogPage() {
  return (
    <>
      <DocsSection
        label="events"
        title="Execution emits an ordered audit record"
        aside={
          <DataTable
            columns={[
              { key: "actor", label: "Actor" },
              { key: "action", label: "Action" },
              { key: "time", label: "Time", align: "right" },
            ]}
            rows={loop_state.audit.map((event) => ({
              actor: event.actor,
              action: event.action,
              time: event.timestamp,
            }))}
          />
        }
      >
        <p>
          The executor applies only approved, non-blocked actions. Skipped and blocked actions do
          not become side effects. Executed actions become <code>AuditEvent</code> entries that can
          be reviewed, sealed, or used to construct a rollback.
        </p>
      </DocsSection>

      <DocsSection
        label="api"
        title="Execution recomposes before it writes"
        aside={
          <EndpointList
            endpoints={[
              { method: "POST", path: "/actions/execute", note: "Returns list[AuditEvent]" },
              { method: "POST", path: "/actions/loop", note: "Returns LoopState with audit" },
            ]}
          />
        }
      >
        <p>
          The audit log is intentionally downstream of the gate. If an approved index points at an
          action that now fails validation, the executor refuses it and the audit trail records only
          actions that actually ran.
        </p>
      </DocsSection>

      <Callout title="Bridge to records">
        <p>
          A sealed governed record carries the decision, evidence, gate result, source versions, and
          permission omissions. The audit log supplies the execution trail around that record.
        </p>
      </Callout>
    </>
  );
}

function SealedRecordsPage() {
  const governance = governance_certificate.governance;

  return (
    <>
      <DocsSection
        label="mint"
        title="Mint a governed work product"
        aside={
          <CodeBlock
            method="POST"
            path="/workproducts/mint"
            body={{
              record_id: governance_certificate.record_id,
              work_product_id: governance_certificate.work_product_id,
              approval_stamp: governance.approval_stamp,
              seal: governance.seal,
            }}
          />
        }
      >
        <p>
          Minting does not make the Acme packet approval-ready. It seals exactly what is true at
          mint time: the brief, policy state, permission omissions, source versions, section
          dependencies, and integrity seal.
        </p>
      </DocsSection>

      <DocsSection
        label="contract"
        title="The record knows what it depends on"
        aside={
          <DataTable
            columns={[
              { key: "section", label: "Section" },
              { key: "sources", label: "Source dependencies" },
            ]}
            rows={Object.entries(governance.section_dependencies).map(([section, deps]) => ({
              section,
              sources: Array.from(deps).join(", "),
            }))}
          />
        }
      >
        <p>
          The section dependency map is the bridge to lifecycle. It says which source objects can
          make each section stale later. Approval sections depend on approval workflow sources;
          factual sections depend on documents and models.
        </p>
      </DocsSection>

      <SignalList
        items={[
          {
            title: "Permission omissions are explicit",
            detail: "The legal memo was restricted at mint time and was not summarized.",
            tone: "warn",
          },
          {
            title: "Source versions are pinned",
            detail: `${governance.source_versions.length} source snapshots travel with the record.`,
          },
          {
            title: "Integrity is server-minted",
            detail: "The seal is HMAC-SHA256 over canonical JSON.",
          },
        ]}
      />
    </>
  );
}

function RevalidationPage() {
  return (
    <>
      <DocsSection
        label="events"
        title="Source changes mark sections stale"
        aside={
          <CodeBlock
            method="POST"
            path="/revalidate"
            body={{
              event: "legal_needs_review",
              changed_object_id: "wf_approval",
              stale_sections: verify_result_stale.stale_sections,
              reapproval_routes: verify_result_stale.reapproval_routes,
            }}
          />
        }
      >
        <p>
          Revalidation consumes a pinned work product and a changed source. If the source appears in
          the section dependency graph, the affected sections are marked stale. Approval-related
          changes also route the section back to the relevant approver.
        </p>
      </DocsSection>

      <DocsSection
        label="data"
        title="Data changes can stale facts without reapproval routes"
        aside={
          <CodeBlock
            method="POST"
            path="/workproducts/{record_id}/verify"
            body={{
              event: "financials_v2",
              changed_sources: verify_result_financials.changed_sources,
              gate_changes: verify_result_financials.gate_changes,
              stale_sections: verify_result_financials.stale_sections,
              reapproval_routes: verify_result_financials.reapproval_routes,
            }}
          />
        }
      >
        <p>
          A financial model update marks factual sections stale and can change deterministic gate
          outcomes, such as DSCR breaching the covenant floor. It does not automatically route legal
          reapproval because it is a data source change, not an approval-source change.
        </p>
      </DocsSection>

      <Callout title="Freshness is separate from integrity">
        <p>
          A record can keep a valid integrity seal and still be stale. Verification checks
          integrity, freshness, and approval-readiness independently.
        </p>
      </Callout>
    </>
  );
}

function AiStudioPage() {
  return (
    <>
      <DocsSection
        label="author"
        title="Author configs, not new engines"
        aside={
          <FlowSteps
            steps={[
              {
                label: "draft",
                title: "Create policy artifact",
                detail: "Recipe, Policy Artifact, EvalPack, owner, version, status.",
              },
              {
                label: "replay",
                title: "Run EvalPack",
                detail: "Estimate failures, approval burden, latency, cost, and regressions.",
              },
              {
                label: "review",
                title: "Approve changes",
                detail: "Human owner signs off on policy and expected operational impact.",
              },
              {
                label: "activate",
                title: "Promote version",
                detail: "Set active artifact; retain prior version for rollback.",
              },
              {
                label: "monitor",
                title: "Watch eval trace",
                detail: "Failures feed typed reason codes and regression cases.",
              },
            ]}
          />
        }
      >
        <p>
          AI Studio should expose the primitives the repo already has: AgentRecipe, Policy Artifact,
          EvalPack, RegressionSuite, and RecipeScorecard. It does not let admins bypass
          deterministic engines; it lets them configure and prove them.
        </p>
      </DocsSection>

      <DocsSection
        label="artifact"
        title="The policy lifecycle mirrors Gating"
        aside={<CodeBlock title="policy artifact" body={gatingExamples.finance.policyArtifact} />}
      >
        <p>
          The finance policy artifact shows the lifecycle shape: versioned, owned, tied to an eval
          pack, and run in advisory human-in-the-loop write mode. AI Studio is the authoring surface
          for that same object family.
        </p>
      </DocsSection>

      <DataTable
        columns={[
          { key: "recipe", label: "Recipe" },
          { key: "rulepack", label: "Policy Artifact" },
          { key: "evalpack", label: "EvalPack" },
        ]}
        rows={recipes.map((recipe) => ({
          recipe: recipe.id,
          rulepack: recipe.rulepack_id,
          evalpack: recipe.eval_pack_id,
        }))}
      />
    </>
  );
}

function VerticalsPage() {
  return (
    <>
      <DocsSection
        label="proof"
        title="Same substrate, swapped vertical packs"
        aside={
          <DataTable
            columns={[
              { key: "vertical", label: "Vertical" },
              { key: "passed", label: "Cases", align: "right" },
              { key: "proves", label: "Proves" },
            ]}
            rows={Object.entries(vertical_scores).map(([vertical, score]) => ({
              vertical,
              passed: `${score.passed}/${score.total}`,
              proves: score.proves,
            }))}
          />
        }
      >
        <p>
          Vertical expansion is not three agents. It is one set of primitives with different
          recipes, policy artifacts, eval packs, evidence requirements, and approval rules.
        </p>
        <p>
          Finance proves authority thresholds and calculation checks. Legal proves verified
          citations and privilege gates. Healthcare proves PHI minimum-necessary, version checks,
          and required reviewers.
        </p>
      </DocsSection>

      <DocsSection
        label="signals"
        title="Each vertical reports compatible signals"
        aside={
          <DataTable
            dense
            columns={[
              { key: "case", label: "Case" },
              { key: "vertical", label: "Vertical" },
              { key: "check", label: "Check" },
              { key: "status", label: "Status", align: "right" },
            ]}
            rows={eval_rows.map((row) => ({
              case: row.case_id,
              vertical: row.vertical,
              check: row.check,
              status: (
                <Pill tone={row.passed ? "green" : "amber"}>{row.passed ? "pass" : "review"}</Pill>
              ),
            }))}
          />
        }
      >
        <p>
          Because rows are typed, Agent Ops can compare different verticals without reading their
          raw content. The scorecard is a platform proof: policy changes by vertical, but the
          substrate stays constant.
        </p>
      </DocsSection>

      <Callout title="Expansion rule">
        <p>
          Add a vertical by authoring an AgentRecipe, Policy Artifact, and EvalPack. Do not fork the
          context assembler, verifier, action engine, lifecycle engine, or telemetry model.
        </p>
      </Callout>
    </>
  );
}

function EvalTracePrivacyPanel() {
  return (
    <CodeBlock
      title="privacy"
      body={{
        tenant_local: privacy.tenant_local,
        dp_epsilon: privacy.dp_epsilon,
        caveat: privacy.caveat,
        failure_taxonomy: failure_taxonomy.map((row) => ({
          category: TAXONOMY_LABELS[row.category] ?? row.category,
          count: row.count,
        })),
      }}
    />
  );
}

// Keep this near the end so the main page flow above stays focused.
pages.evalTrace.content = function EvalTracePageWithPrivacy() {
  return (
    <>
      <EvalTracePage />
      <DocsSection
        label="privacy"
        title="Privacy constraints are part of the trace"
        aside={<EvalTracePrivacyPanel />}
      >
        <p>
          Tenant-local runs, redacted failure packets, k-anonymity thresholds, and differential
          privacy budget are product requirements, not reporting add-ons. They let the platform
          learn aggregate trends without exposing row-level customer content.
        </p>
      </DocsSection>
    </>
  );
};

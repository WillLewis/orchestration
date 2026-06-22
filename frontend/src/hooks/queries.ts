// React Query data layer for the four surfaces.
//
// DEFAULT: every hook serves the bundled mock from `src/data/*` via `initialData`,
// so the vendored app renders identically to Lovable with no loading flash.
// LIVE: set `VITE_USE_MOCKS=false` (+ `VITE_API_URL`) to fetch from the FastAPI
// gateway (`api/main.py`). Responses are contract-shaped (core/schemas.py) and are
// merged over the mock, so UI-only fields (labels, derived status, telemetry) survive
// and only real values are overlaid.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approval_role_labels,
  decision_brief as mockBrief,
  decision_readiness as mockDecisionReadiness,
  rulepack_id as mockRulepackId,
  rulepack_version as mockRulepackVersion,
  source_count as mockSourceCount,
  sources as mockSources,
  type ApprovalStatus,
  type DecisionReadiness,
  type DecisionReadinessAction,
} from "@/data/brief";
import { action_key, action_plan as mockActionPlan, type Action } from "@/data/actions";
import { entry_actions, meeting as mockMeeting, plan_steps } from "@/lib/meeting-data";
import {
  eval_rows as mockEvalRows,
  eval_source_mix as mockEvalSourceMix,
  failure_taxonomy as mockFailureTaxonomy,
  telemetry_sample as mockTelemetrySample,
  vertical_scores as mockVerticalScores,
  type EvalRow,
  type Vertical,
  type VerticalScore,
} from "@/data/ops";
import { loop_state as mockLoop, type LoopState } from "@/data/loop";
import {
  governance_certificate,
  verify_result_financials,
  verify_result_stale,
  type GovernanceCertificate,
  type VerifyResult,
} from "@/data/record";
import { PREVIEW_FALLBACK_RESPONSE, scriptedChatResponse } from "@/data/demo-chat";
import { setLatestRecordId } from "@/lib/record-store";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? "";
// Mocks on by default → Lovable parity. Live only when explicitly disabled + a base URL.
export const LIVE = import.meta.env.VITE_USE_MOCKS === "false" && API_BASE.length > 0;
// Mock mode: never refetch (instant, no flash). Live mode: 0 so the mock seed is
// immediately stale and React Query fetches the gateway on mount.
const STALE = LIVE ? 0 : Infinity;

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

/* ----------------------------- Decision Brief (surfaces 1 & 2) ---------------------------- */

const briefData = {
  decision_brief: mockBrief,
  decision_readiness: mockDecisionReadiness,
  sources: mockSources,
  source_count: mockSourceCount,
  approval_role_labels,
  rulepack_id: mockRulepackId,
  rulepack_version: mockRulepackVersion,
};
export type BriefData = typeof briefData;

interface LiveBriefResponse {
  decision_brief: Partial<typeof mockBrief> & {
    required_approvals?: { requirements: Array<{ role: string; present: boolean }> };
  };
  decision_readiness?: DecisionReadiness;
  source_count?: number;
  rulepack_id?: string;
  rulepack_version?: number;
}

// The contract has no UI-only `status`; derive it client-side from present + role.
function deriveApprovalStatus(role: string, present: boolean): ApprovalStatus {
  if (present) return "approved";
  return role === "legal" ? "pending" : "missing";
}

function pct(n: number | undefined, fallback: number) {
  return typeof n === "number" ? Math.round(n * 100) : fallback;
}

function deriveDecisionReadiness(db: typeof mockBrief): DecisionReadiness {
  const threshold = db.policy_gates.firings.find((f) => f.rule_id === "approval_threshold")
    ?.threshold as { requested_discount?: number; delegated_authority?: number } | undefined;
  const requested = pct(threshold?.requested_discount, 22);
  const delegated = pct(threshold?.delegated_authority, 15);
  const dscr =
    db.policy_gates.calculations.find(
      (c) => c.name.toLowerCase() === "dscr" || c.name.toLowerCase().includes("coverage"),
    )?.computed ?? 1.28;
  const has = (role: string) =>
    db.required_approvals.requirements.some((r) => r.role === role && r.present);

  return {
    summary:
      "Committee packet is not ready. Two blockers remain: Credit Officer approval and final covenant tracker.",
    rows: [
      {
        id: "covenant_tracker",
        gate: "Covenant tracker",
        status: "blocking",
        details: "Final tracker is required before the committee can decide.",
        source_ids: ["doc_covenant_tracker"],
        action: {
          label: "Request from analyst",
          tool: "create_task",
          target_object_id: "task_new_1",
        },
      },
      {
        id: "credit_officer_approval",
        gate: "Credit Officer approval",
        status: has("credit_officer") ? "approved" : "blocking",
        details: `Requested discount is ${requested}%, above the RM approval threshold of ${delegated}%.`,
        source_ids: ["doc_pricing_exception", "wf_approval"],
        explainer: { kind: "threshold", rule_id: "approval_threshold" },
        action: {
          label: "Route to Credit Officer",
          tool: "route_approval",
          target_object_id: "doc_pricing_exception",
          required_approver: "credit_officer",
        },
      },
      {
        id: "legal_approval",
        gate: "Legal approval",
        status: has("legal") ? "approved" : "pending",
        details: "Legal review has not completed.",
        source_ids: ["wf_approval"],
        action: {
          label: "View in workflow",
          tool: "route_approval",
          target_object_id: "wf_approval",
          required_approver: "legal",
        },
      },
      {
        id: "dscr_calculation",
        gate: "DSCR calculation",
        status: "passed",
        details: `Recalculated at ${dscr.toFixed(2)}x and matches the updated financial model.`,
        source_ids: ["doc_financials"],
        explainer: { kind: "calculation", calculation_name: "dscr" },
      },
      {
        id: "relationship_manager_approval",
        gate: "Relationship Manager approval",
        status: has("relationship_manager") ? "approved" : "blocking",
        details: "RM has signed off on the renewal package.",
        source_ids: ["wf_approval"],
      },
    ],
  };
}

export function useBriefQuery() {
  return useQuery({
    queryKey: ["brief"],
    initialData: briefData,
    staleTime: STALE,
    queryFn: async (): Promise<BriefData> => {
      if (!LIVE) return briefData;
      const live = await getJSON<LiveBriefResponse>("/api/brief");
      const db = live.decision_brief ?? {};
      const reqs = (db.required_approvals?.requirements ?? []).map((r) => ({
        ...r,
        status: deriveApprovalStatus(r.role, r.present),
      }));
      const mergedBrief = {
        ...mockBrief,
        ...db,
        required_approvals: {
          requirements: reqs.length ? reqs : mockBrief.required_approvals.requirements,
        },
      };
      return {
        ...briefData,
        decision_brief: mergedBrief,
        decision_readiness: live.decision_readiness ?? deriveDecisionReadiness(mergedBrief),
        source_count: live.source_count ?? briefData.source_count,
        rulepack_id: live.rulepack_id ?? briefData.rulepack_id,
        rulepack_version: live.rulepack_version ?? briefData.rulepack_version,
      };
    },
  });
}

/* --------------------------------- Meeting (surface 1) ----------------------------------- */

const meetingData = { meeting: mockMeeting, entry_actions, plan_steps };
export type MeetingData = typeof meetingData;

interface LiveMeetingResponse {
  source_count?: number;
}

export function useMeetingQuery() {
  return useQuery({
    queryKey: ["meeting"],
    initialData: meetingData,
    staleTime: STALE,
    queryFn: async (): Promise<MeetingData> => {
      if (!LIVE) return meetingData;
      const live = await getJSON<LiveMeetingResponse>("/api/meeting");
      return {
        ...meetingData,
        meeting: { ...mockMeeting, source_count: live.source_count ?? mockMeeting.source_count },
      };
    },
  });
}

/* ------------------------------ Action plan (surface 3) ---------------------------------- */

const actionData = { actions: mockActionPlan.actions };
export type ActionData = typeof actionData;

export function resolveReadinessAction(
  selector: DecisionReadinessAction | null | undefined,
  planActions: Action[],
): string | null {
  if (!selector) return null;
  const match = planActions.find((a) => {
    if (a.tool !== selector.tool) return false;
    if (a.diff.target_object_id !== selector.target_object_id) return false;
    if (!selector.required_approver) return true;
    return a.required_approver === selector.required_approver;
  });
  return match ? action_key(match) : null;
}

export function useActionPlanQuery() {
  // Live mode fetches the real composed ActionPlan (`GET /api/actions`, full typed diffs +
  // blocked_reasons); mock is the bundled plan. `initialData` keeps the globally-mounted drawer
  // safe — a failed/absent fetch falls back to the mock instead of throwing on every route.
  return useQuery({
    queryKey: ["actions"],
    initialData: actionData,
    staleTime: STALE,
    queryFn: async (): Promise<ActionData> => {
      if (!LIVE) return actionData;
      try {
        const live = await getJSON<{ actions: ActionData["actions"] }>("/api/actions");
        return live.actions?.length ? { actions: live.actions } : actionData;
      } catch {
        return actionData;
      }
    },
  });
}

/* --------------------------------- Agent Ops (surface 4) --------------------------------- */

interface LiveScorecard {
  pack_id: string;
  scores: Array<{
    vertical: Vertical;
    deterministic_rule_pass: number;
    citation_correctness: number;
    permission_denial_pass: number;
    missing_evidence_honesty: number;
    cases_passed: number;
    cases_total: number;
  }>;
}

export function useOpsQuery() {
  return useQuery({
    queryKey: ["ops"],
    initialData: mockVerticalScores,
    staleTime: STALE,
    queryFn: async (): Promise<Record<Vertical, VerticalScore>> => {
      if (!LIVE) return mockVerticalScores;
      const sc = await getJSON<LiveScorecard>("/api/ops/scorecard");
      // Overlay the real per-vertical pass counts + shared metrics onto the mock
      // scaffold (keeps vertical-specific metric labels like privilege_gate / phi).
      const next: Record<Vertical, VerticalScore> = { ...mockVerticalScores };
      for (const s of sc.scores) {
        const base = mockVerticalScores[s.vertical];
        next[s.vertical] = {
          ...base,
          passed: s.cases_passed,
          total: s.cases_total,
          metrics: {
            ...base.metrics,
            deterministic_rule_pass: s.deterministic_rule_pass,
            citation_correctness: s.citation_correctness,
            permission_denial_pass: s.permission_denial_pass,
            missing_evidence_honesty: s.missing_evidence_honesty,
          },
        };
      }
      return next;
    },
  });
}

/* ----------------------- Agent Ops full report (GET /ops/evals) ----------------------- */

// The full OpsReport (eval rows + telemetry sample + source mix + failure taxonomy). Live mode
// fetches the real run; mock is the bundled static data. Eval rows carry content-free trace signals
// (input_class/expected_signal/observed_signal) for the failed-row drill-in.
export interface OpsReportData {
  eval_rows: EvalRow[];
  telemetry_sample: Record<string, unknown>;
  eval_source_mix: { synthetic: number; tenant_local: number; redacted: number; aggregate: number };
  failure_taxonomy: Array<{ category: string; count: number }>;
}

const opsReportData: OpsReportData = {
  eval_rows: mockEvalRows,
  telemetry_sample: mockTelemetrySample,
  eval_source_mix: mockEvalSourceMix,
  failure_taxonomy: mockFailureTaxonomy,
};

export function useOpsReportQuery() {
  return useQuery({
    queryKey: ["ops-report"],
    initialData: opsReportData,
    staleTime: STALE,
    queryFn: async (): Promise<OpsReportData> => {
      if (!LIVE) return opsReportData;
      const r = await getJSON<Partial<OpsReportData>>("/ops/evals");
      return {
        eval_rows: r.eval_rows?.length ? r.eval_rows : opsReportData.eval_rows,
        telemetry_sample: r.telemetry_sample ?? opsReportData.telemetry_sample,
        eval_source_mix: r.eval_source_mix ?? opsReportData.eval_source_mix,
        failure_taxonomy: r.failure_taxonomy?.length
          ? r.failure_taxonomy
          : opsReportData.failure_taxonomy,
      };
    },
  });
}

/* --------------------------------- Work Loop (surface 5) --------------------------------- */

// The canonical loop dossier. Default serves the bundled mock; live mode reads the gateway's
// read-only convenience endpoint (`GET /api/loop`) and merges canonical fields over the mock
// scaffold so a missing/nested field falls back. (To RUN the loop server-side instead, the
// gateway also exposes `POST /actions/loop` with the same shape.)
export function useLoopQuery() {
  return useQuery({
    queryKey: ["loop"],
    initialData: mockLoop,
    staleTime: STALE,
    queryFn: async (): Promise<LoopState> => {
      if (!LIVE) return mockLoop;
      const live = await getJSON<Partial<LoopState>>(
        "/api/loop?user_id=u_rm&intent=prepare_decision_brief",
      );
      return { ...mockLoop, ...live };
    },
  });
}

/* --------------------------------- Governed record (surface 6) --------------------------------- */

// The sealed governed-record certificate + its verification. Mock by default (the bundled
// `governance_certificate`); live mode hits the gateway's `/workproducts/*` endpoints. The mint
// response wraps the sealed record under `record` (backend contract) — we also accept `certificate`
// so the hook tolerates either noun. `useVerification` holds the latest verify result client-side
// (set by the verify mutation on the same page); it never fetches on its own.
const recordKey = (id: string) => ["workproduct", id] as const;
const verifyKey = (id: string) => ["workproduct", id, "verification"] as const;

export function useRecordQuery(recordId: string) {
  const initialRecord = { ...governance_certificate, record_id: recordId } as GovernanceCertificate;
  return useQuery<GovernanceCertificate>({
    queryKey: recordKey(recordId),
    initialData: initialRecord,
    staleTime: STALE,
    queryFn: async (): Promise<GovernanceCertificate> => {
      if (!LIVE) return initialRecord;
      return getJSON<GovernanceCertificate>(`/workproducts/${recordId}`);
    },
  });
}

export function useVerification(recordId: string) {
  // Null until the user verifies; the verify mutation populates this cache entry. Never fetches.
  return useQuery<VerifyResult | null>({
    queryKey: verifyKey(recordId),
    queryFn: async () => null,
    initialData: null,
    staleTime: Infinity,
    enabled: false,
  });
}

export function useMintWorkProductMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { work_product_id?: string; certificate?: GovernanceCertificate } = {},
    ): Promise<{ record_id: string; certificate: GovernanceCertificate }> => {
      if (!LIVE) {
        const certificate = input.certificate ?? governance_certificate;
        return {
          record_id: certificate.record_id,
          certificate,
        };
      }
      const { certificate: _certificate, ...request } = input;
      const res = await fetch(`${API_BASE}/workproducts/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error(`/workproducts/mint → ${res.status}`);
      const data = await res.json();
      // Backend returns { record_id, record }; tolerate { certificate } too.
      return { record_id: data.record_id, certificate: data.record ?? data.certificate };
    },
    onSuccess: (data) => {
      setLatestRecordId(data.record_id);
      qc.setQueryData(recordKey(data.record_id), data.certificate);
      qc.setQueryData(verifyKey(data.record_id), null);
    },
  });
}

export function useVerifyWorkProductMutation(recordId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { event?: string } = { event: "legal_needs_review" },
    ): Promise<VerifyResult> => {
      if (!LIVE) {
        const result =
          input.event === "financials_v2" ? verify_result_financials : verify_result_stale;
        return { ...result, record_id: recordId };
      }
      const res = await fetch(`${API_BASE}/workproducts/${recordId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`/workproducts/${recordId}/verify → ${res.status}`);
      return (await res.json()) as VerifyResult;
    },
    onSuccess: (data) => {
      qc.setQueryData(verifyKey(recordId), data);
    },
  });
}

/* --------------------------------- Safe actions — live execute (POST /actions/execute) --------------------------------- */

// One server-side execution outcome (core/schemas.py AuditEvent). The executor re-gates the plan
// server-side: a blocked action is `skipped` (with its blocked_reason) even when its index is
// submitted as approved — so a client can't bypass a gate. `executed` carries the applied diff.
export interface ServerAuditEvent {
  actor: string;
  action: "executed" | "skipped" | string;
  detail: {
    index?: number;
    tool?: string;
    target?: string;
    reason?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
}

// POST approved indices to the gateway; it recomposes + executes the gated plan and returns the
// audit. Live-only (the drawer keeps its client-side simulation for offline/mock). Used to prove
// the anti-bypass guarantee: approve every index, the blocked ones still come back `skipped`.
export function useExecuteActionsMutation() {
  return useMutation({
    mutationFn: async (input: { approved_indices: number[] }): Promise<ServerAuditEvent[]> => {
      const res = await fetch(`${API_BASE}/actions/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "u_rm",
          intent: "prepare_decision_brief",
          approved_indices: input.approved_indices,
        }),
      });
      if (!res.ok) throw new Error(`/actions/execute → ${res.status}`);
      return (await res.json()) as ServerAuditEvent[];
    },
  });
}

/* --------------------------------- Governed chat (POST /chat) --------------------------------- */

// One conversational turn. `role`/`content` are the wire shape the gateway accepts as `history`;
// the panel layers UI-only fields (an assistant turn's governance `meta`) on top and never sends
// them upstream.
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// A governed chat suggested-action button (api/models.py ChatAction). `kind` drives the panel's
// transition; `explain`/`route_credit_officer`/`apply_capped` come from the backend block, the
// flow kinds (`open_cascade`/`propose_followups`) are appended by the panel as the arc advances.
export interface ChatAction {
  id: string;
  label: string;
  kind: "explain" | "route_credit_officer" | "apply_capped" | "open_cascade" | "propose_followups";
}

// Contract-shaped response (api/models.py ChatResponse). Everything but `reply` is optional so a
// future backend field never breaks decode, and an absent boolean never falsely lights a chip.
export interface ChatResponse {
  reply: string;
  citations?: Array<{ object_id: string; span?: string }>;
  permission_boundary_hit?: boolean;
  gate_held?: boolean;
  missing_evidence?: boolean;
  actions?: ChatAction[];
}

// POST a governed question to the gateway. Mirrors the workproduct mutations above (inline
// fetch(POST) + throw on !ok). Chat is ephemeral UI state, so there is no query-cache write.
// `user_id`/`intent` are hardcoded for the Acme scenario exactly like the loop query; `intent` is
// REQUIRED by the contract (no default) — omitting it 422s.
export function useChatMutation() {
  return useMutation({
    mutationFn: async (input: {
      message: string;
      history: ChatMessage[];
    }): Promise<ChatResponse> => {
      // Mock mode: the revalidation demo runs under VITE_USE_MOCKS, so the scripted demo prompts
      // return pinned governed replies that MIRROR the backend block — a demo script, not
      // governance-in-JS. Any non-scripted question gets a bounded preview answer; the live gateway
      // owns the real, general refusals.
      if (!LIVE) {
        const scripted = scriptedChatResponse(input.message);
        if (scripted) return scripted;
        return PREVIEW_FALLBACK_RESPONSE;
      }
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "u_rm",
          intent: "prepare_decision_brief",
          message: input.message,
          history: input.history,
        }),
      });
      if (!res.ok) throw new Error(`/chat → ${res.status}`);
      return (await res.json()) as ChatResponse;
    },
  });
}

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
  rulepack_id as mockRulepackId,
  rulepack_version as mockRulepackVersion,
  source_count as mockSourceCount,
  sources as mockSources,
  type ApprovalStatus,
} from "@/data/brief";
import { action_plan as mockActionPlan } from "@/data/actions";
import { entry_actions, meeting as mockMeeting, plan_steps } from "@/lib/meeting-data";
import {
  vertical_scores as mockVerticalScores,
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

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? "";
// Mocks on by default → Lovable parity. Live only when explicitly disabled + a base URL.
const LIVE = import.meta.env.VITE_USE_MOCKS === "false" && API_BASE.length > 0;
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
  source_count?: number;
  rulepack_id?: string;
  rulepack_version?: number;
}

// The contract has no UI-only `status`; derive it client-side from present + role.
function deriveApprovalStatus(role: string, present: boolean): ApprovalStatus {
  if (present) return "approved";
  return role === "legal" ? "pending" : "missing";
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
      return {
        ...briefData,
        decision_brief: {
          ...mockBrief,
          ...db,
          required_approvals: {
            requirements: reqs.length ? reqs : mockBrief.required_approvals.requirements,
          },
        },
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

export function useActionPlanQuery() {
  // Actions stay on the bundled mock in BOTH modes: the live action engine (WS-E) isn't
  // merged yet, and its stub output carries null diffs the drawer doesn't model. The
  // drawer is globally mounted, so a live fetch here would crash every route. Flip the
  // queryFn to fetch "/api/actions" once WS-E lands (the gateway endpoint already exists).
  return useQuery({
    queryKey: ["actions"],
    initialData: actionData,
    staleTime: Infinity,
    queryFn: (): ActionData => actionData,
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
  return useQuery<GovernanceCertificate>({
    queryKey: recordKey(recordId),
    initialData: governance_certificate,
    staleTime: STALE,
    queryFn: async (): Promise<GovernanceCertificate> => {
      if (!LIVE) return governance_certificate;
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
      input: { work_product_id?: string } = {},
    ): Promise<{ record_id: string; certificate: GovernanceCertificate }> => {
      if (!LIVE) {
        return {
          record_id: governance_certificate.record_id,
          certificate: governance_certificate,
        };
      }
      const res = await fetch(`${API_BASE}/workproducts/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`/workproducts/mint → ${res.status}`);
      const data = await res.json();
      // Backend returns { record_id, record }; tolerate { certificate } too.
      return { record_id: data.record_id, certificate: data.record ?? data.certificate };
    },
    onSuccess: (data) => {
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
      if (!LIVE)
        return input.event === "financials_v2" ? verify_result_financials : verify_result_stale;
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

/* --------------------------------- Governed chat (POST /chat) --------------------------------- */

// One conversational turn. `role`/`content` are the wire shape the gateway accepts as `history`;
// the panel layers UI-only fields (an assistant turn's governance `meta`) on top and never sends
// them upstream.
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Contract-shaped response (api/models.py ChatResponse). Everything but `reply` is optional so a
// future backend field never breaks decode, and an absent boolean never falsely lights a chip.
export interface ChatResponse {
  reply: string;
  citations?: Array<{ object_id: string; span?: string }>;
  permission_boundary_hit?: boolean;
  gate_held?: boolean;
  missing_evidence?: boolean;
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
      // Chat needs the live gateway — there is no single canned reply. Degrade gracefully (no
      // crash). Never re-implement the refusals in JS; that would recreate the canned-state problem
      // this wiring exists to kill.
      if (!LIVE) {
        return {
          reply:
            "Live chat is offline in this preview. Run the gateway (make api) and set " +
            "VITE_USE_MOCKS=false to ask governed questions.",
          citations: [],
          permission_boundary_hit: false,
          gate_held: false,
          missing_evidence: false,
        };
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

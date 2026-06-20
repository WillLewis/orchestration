// React Query data layer for the four surfaces.
//
// DEFAULT: every hook serves the bundled mock from `src/data/*` via `initialData`,
// so the vendored app renders identically to Lovable with no loading flash.
// LIVE: set `VITE_USE_MOCKS=false` (+ `VITE_API_URL`) to fetch from the FastAPI
// gateway (`api/main.py`). Responses are contract-shaped (core/schemas.py) and are
// merged over the mock, so UI-only fields (labels, derived status, telemetry) survive
// and only real values are overlaid.
import { useQuery } from "@tanstack/react-query";

import {
  approval_role_labels,
  decision_brief as mockBrief,
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
};
export type BriefData = typeof briefData;

interface LiveBriefResponse {
  decision_brief: Partial<typeof mockBrief> & {
    required_approvals?: { requirements: Array<{ role: string; present: boolean }> };
  };
  source_count?: number;
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

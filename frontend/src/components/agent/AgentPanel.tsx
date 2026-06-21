import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AgentHeader } from "./AgentHeader";
import { ScopeStrip } from "./ScopeStrip";
import { IdleState } from "./IdleState";
import { ThinkingState } from "./ThinkingState";
import { ResultBrief } from "./ResultBrief";
import { InputBar } from "./InputBar";
import { ChatThread, type Turn } from "./ChatThread";
import { useChatMutation, type ChatAction } from "@/hooks/queries";
import { FLOW, PENDING_CREDIT_OFFICER } from "@/data/demo-chat";
import {
  useGovernedBrief,
  useRevalidation,
  routeToCreditOfficer,
  resetRevalidation,
  type GovernedBrief,
} from "@/lib/revalidation-store";
import { openDrawer } from "@/lib/actions-store";

type AgentState = "idle" | "thinking" | "result";

const STARTER_LABELS: Record<string, string> = {
  changed: "What changed since last review?",
  approval: "Check approval readiness",
  summary: "Summarize this meeting",
  monitor: "Monitor this decision",
};

function starterResponse(id: string, governed: GovernedBrief): Turn | null {
  const brief = governed.decision_brief;
  const blockingRows = governed.decision_readiness.rows.filter((row) => row.status === "blocking");
  const pendingRows = governed.decision_readiness.rows.filter((row) => row.status === "pending");
  const nextBlocker = blockingRows[0] ?? pendingRows[0];

  if (id === "changed") {
    return {
      role: "assistant",
      content:
        `What changed since last review: 1. ${brief.what_changed[0]} 2. ${brief.what_changed[1]} ` +
        `3. ${brief.what_changed[2]} I used the financial model, approval workflow, and sources ` +
        "Dana can access; the restricted Legal memo was not used.",
      meta: {
        reply: "",
        citations: [
          { object_id: "doc_financials" },
          { object_id: "wf_approval" },
          { object_id: "doc_legal_memo" },
        ],
        permission_boundary_hit: true,
      },
    };
  }

  if (id === "approval") {
    const failedRules = brief.policy_gates.firings.filter((f) => !f.passed).map((f) => f.detail);
    const gateCopy = failedRules.length
      ? `Failing gates: ${failedRules.join(" ")}`
      : "Credit Officer approval and discount-authority gates are cleared.";
    const blockerCopy = nextBlocker
      ? `Next blocker: ${nextBlocker.gate} — ${nextBlocker.details}`
      : "No open blockers remain.";
    return {
      role: "assistant",
      content: `Approval-ready: ${brief.policy_gates.approval_ready ? "Yes" : "No"}. ${gateCopy} ${blockerCopy}`,
      meta: {
        reply: "",
        citations: [{ object_id: "wf_approval" }, { object_id: "doc_pricing_exception" }],
        gate_held: !brief.policy_gates.approval_ready,
      },
    };
  }

  if (id === "summary") {
    return {
      role: "assistant",
      content:
        "Acme is renewing a commercial facility with a 22% pricing exception and a covenant " +
        "modification. The packet is not approval-ready: Legal is still pending, the final " +
        "covenant tracker is missing, and the governed record must stay clear about which " +
        "approval and conflict items have actually been resolved.",
      meta: {
        reply: "",
        citations: [
          { object_id: "mtg_committee_0612" },
          { object_id: "doc_pricing_exception" },
          { object_id: "doc_covenant_tracker" },
        ],
        missing_evidence: true,
      },
    };
  }

  if (id === "monitor") {
    const status =
      governed.stage === "initial"
        ? "Monitoring is armed for source changes."
        : `Monitoring is armed from the ${governed.stage.replace(/_/g, " ")} state.`;
    return {
      role: "assistant",
      content:
        `${status} I will revalidate if the approval workflow, financial model, pricing exception, ` +
        "customer success plan, or covenant tracker changes. Approval workflow changes can require " +
        "reapproval; financial or dependent-document changes can mark factual sections stale.",
      meta: {
        reply: "",
        citations: [{ object_id: "wf_approval" }, { object_id: "doc_financials" }],
      },
    };
  }

  return null;
}

export function AgentPanel() {
  const [state, setState] = useState<AgentState>("idle");
  const [messages, setMessages] = useState<Turn[]>([]);
  const chat = useChatMutation();
  // The revalidation arc's deterministic state (CO sign-off, cascade) drives store-pushed turns.
  const reval = useRevalidation();
  const governed = useGovernedBrief();
  const signedRef = useRef(false);
  const reconciledRef = useRef(false);

  // Entry buttons → "generate" (the brief flow). Free text → "ask" (the governed chat below).
  const start = useCallback(
    (id: string) => {
      if (id === "followups") {
        openDrawer({ mode: "plan", source: "Acme renewal — pre-committee review" });
        return;
      }
      if (id !== "brief") {
        const response = starterResponse(id, governed);
        if (response) {
          setState("idle");
          setMessages([
            { role: "user", content: STARTER_LABELS[id] ?? "Review this meeting" },
            response,
          ]);
          return;
        }
      }
      setState("thinking");
    },
    [governed],
  );

  // Header reset is the panel-wide "start over": return to idle, drop the conversation, AND reset the
  // revalidation arc so the entry buttons reappear and the demo can be re-run cleanly.
  const reset = useCallback(() => {
    setState("idle");
    setMessages([]);
    signedRef.current = false;
    reconciledRef.current = false;
    resetRevalidation();
  }, []);

  const send = useCallback(
    (text: string) => {
      if (chat.isPending) return;
      // Prior turns only (strip UI-only meta); the new message is sent separately, not in history.
      const history = messages.map(({ role, content }) => ({ role, content }));
      setMessages((m) => [...m, { role: "user", content: text }]);
      chat.mutate(
        { message: text, history },
        {
          onSuccess: (data) =>
            setMessages((m) => [...m, { role: "assistant", content: data.reply, meta: data }]),
          onError: () => {
            toast.error("Couldn't reach the agent", {
              description: "The governed chat gateway didn't respond. Is `make api` running?",
            });
            // Roll back the optimistic user turn so no question is left dangling without a reply.
            setMessages((m) => m.slice(0, -1));
          },
        },
      );
    },
    [chat, messages],
  );

  // A suggested-action button under an assistant turn. Each kind advances the governed-change arc.
  const onAction = useCallback(
    (action: ChatAction) => {
      switch (action.kind) {
        case "explain":
          // Re-ask through the normal channel so the permission-aware explanation reads as a turn.
          send("Why does this need approval?");
          break;
        case "route_credit_officer":
          setMessages((m) => [
            ...m,
            { role: "user", content: "Route to Credit Officer" },
            {
              role: "assistant",
              content: FLOW.routed.reply,
              meta: FLOW.routed,
              pending: PENDING_CREDIT_OFFICER,
            },
          ]);
          routeToCreditOfficer(); // arms the deterministic CO sign-off (store-owned timer)
          break;
        case "apply_capped":
          setMessages((m) => [
            ...m,
            { role: "user", content: "Use the max I can authorize (15%)" },
            { role: "assistant", content: FLOW.capped.reply, meta: FLOW.capped },
          ]);
          break;
        case "open_cascade":
          openDrawer({ mode: "revalidation_edit", source: "Revalidation — Acme renewal" });
          break;
        case "propose_followups":
          openDrawer({ mode: "plan", source: "Acme renewal — pre-committee review" });
          break;
      }
    },
    [send],
  );

  // CO signs off (store timer) → push the honest partial-recompute turn + the cascade dependency.
  useEffect(() => {
    if (reval.creditSigned && !signedRef.current) {
      signedRef.current = true;
      setMessages((m) => [
        ...m,
        { role: "assistant", content: FLOW.signed.reply, meta: FLOW.signed },
      ]);
    }
  }, [reval.creditSigned]);

  // Dana accepts the cascade edit → push the conflict-cleared turn + the follow-ups handoff.
  useEffect(() => {
    if (reval.csReconciled && !reconciledRef.current) {
      reconciledRef.current = true;
      setMessages((m) => [
        ...m,
        { role: "assistant", content: FLOW.accepted.reply, meta: FLOW.accepted },
      ]);
    }
  }, [reval.csReconciled]);

  const hasChat = messages.length > 0;

  return (
    <aside
      className="flex h-full w-full flex-col overflow-hidden border-l border-border bg-background shadow-panel"
      aria-label="ConnectAgent"
    >
      <div className="shrink-0">
        <AgentHeader onReset={reset} />
        <ScopeStrip />
        <div className="mt-4 border-b border-border" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {state === "idle" && !hasChat && <IdleState onStart={start} />}
        {state === "thinking" && <ThinkingState onDone={() => setState("result")} />}
        {state === "result" && <ResultBrief onFollowups={() => start("followups")} />}
        {hasChat && <ChatThread messages={messages} pending={chat.isPending} onAction={onAction} />}
      </div>

      <InputBar onSubmit={send} pending={chat.isPending} />
    </aside>
  );
}

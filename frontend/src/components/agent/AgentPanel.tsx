import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AgentHeader } from "./AgentHeader";
import { InputBar } from "./InputBar";
import { ChatThread, type Turn } from "./ChatThread";
import {
  LIVE,
  useChatMutation,
  useLifecycleResetMutation,
  useMeetingQuery,
  type ChatAction,
  type ChatMessage,
} from "@/hooks/queries";
import { FLOW, PENDING_CREDIT_OFFICER } from "@/data/demo-chat";
import {
  useGovernedBrief,
  useRevalidation,
  simulateCreditOfficerResponse,
  resetRevalidation,
  type GovernedBrief,
} from "@/lib/revalidation-store";
import {
  openDrawer,
  recordReturnedChangeNotification,
  resetActions,
  stageDecisionReadinessRemediation,
} from "@/lib/actions-store";
import {
  agentPrompt,
  getAgentInvocation,
  isDecisionBriefCommand,
  privateUserTurn,
  publicMeetingTurn,
  seedMeetingTurns,
} from "./thread-utils";

const STARTER_LABELS: Record<string, string> = {
  changed: "What changed since last review?",
  followups: "Agent Actions",
  summary: "Summarize this meeting",
  monitor: "Monitor this decision",
};

function privateAssistantTurn(content: string, meta?: Turn["meta"], pending?: string): Turn {
  return {
    role: "assistant",
    content,
    author: "Agent",
    visibility: "private",
    meta,
    pending,
  };
}

function starterResponse(id: string, governed: GovernedBrief): Turn | null {
  const brief = governed.decision_brief;

  if (id === "changed") {
    return privateAssistantTurn(
      `What changed since last review: 1. ${brief.what_changed[0]} 2. ${brief.what_changed[1]} ` +
        `3. ${brief.what_changed[2]} I used the financial model, approval workflow, and sources ` +
        "Dana can access; the restricted Legal memo was not used.",
      {
        reply: "",
        citations: [
          { object_id: "doc_financials" },
          { object_id: "wf_approval" },
          { object_id: "doc_legal_memo" },
        ],
        permission_boundary_hit: true,
      },
    );
  }

  if (id === "summary") {
    return privateAssistantTurn(
      "Acme is renewing a commercial facility with a 22% pricing exception and a covenant " +
        "modification. The packet is not approval-ready: Legal is still pending, the final " +
        "covenant tracker is missing, and the governed record must stay clear about which " +
        "approval and conflict items have actually been resolved.",
      {
        reply: "",
        citations: [
          { object_id: "mtg_committee_0612" },
          { object_id: "doc_pricing_exception" },
          { object_id: "doc_covenant_tracker" },
        ],
        missing_evidence: true,
      },
    );
  }

  if (id === "monitor") {
    const status =
      governed.stage === "initial"
        ? "Monitoring is armed for source changes."
        : `Monitoring is armed from the ${governed.stage.replace(/_/g, " ")} state.`;
    return privateAssistantTurn(
      `${status} I will revalidate if the approval workflow, financial model, pricing exception, ` +
        "customer success plan, or covenant tracker changes. Approval workflow changes can require " +
        "reapproval; financial or dependent-document changes can mark factual sections stale.",
      {
        reply: "",
        citations: [{ object_id: "wf_approval" }, { object_id: "doc_financials" }],
      },
    );
  }

  if (id === "followups") {
    return privateAssistantTurn(
      "I opened Agent Actions with the governed follow-ups for Credit Officer approval, Legal review, and the final covenant tracker.",
      {
        reply: "",
        citations: [{ object_id: "wf_approval" }, { object_id: "doc_covenant_tracker" }],
      },
    );
  }

  return null;
}

function briefPreviewTurn(): Turn {
  return {
    role: "assistant",
    content: "Decision Brief · Draft",
    author: "Agent",
    visibility: "private",
    kind: "brief_preview",
  };
}

function privateHistory(messages: Turn[]): ChatMessage[] {
  return messages
    .filter((m) => m.visibility === "private" && m.kind !== "brief_preview")
    .map((m) => {
      if (m.role === "user") {
        return { role: m.role, content: getAgentInvocation(m.content)?.message ?? m.content };
      }
      return { role: m.role, content: m.content };
    });
}

export function AgentPanel({
  briefRequestId = 0,
  onBriefRequestHandled,
}: {
  briefRequestId?: number;
  onBriefRequestHandled?: () => void;
}) {
  const [messages, setMessages] = useState<Turn[]>(() => seedMeetingTurns());
  const chat = useChatMutation();
  const lifecycleReset = useLifecycleResetMutation();
  const { entry_actions } = useMeetingQuery().data;
  // The revalidation arc's deterministic state (CO sign-off, cascade) drives store-pushed turns.
  const reval = useRevalidation();
  const governed = useGovernedBrief();
  const signedRef = useRef(false);
  const reconciledRef = useRef(false);
  const handledBriefRequestRef = useRef(0);

  const appendBriefPreview = useCallback((display = agentPrompt("Generate Decision Brief")) => {
    setMessages((m) => [...m, privateUserTurn(display), briefPreviewTurn()]);
  }, []);

  useEffect(() => {
    if (briefRequestId <= 0) return;
    if (handledBriefRequestRef.current === briefRequestId) return;
    handledBriefRequestRef.current = briefRequestId;
    appendBriefPreview();
    onBriefRequestHandled?.();
  }, [appendBriefPreview, briefRequestId, onBriefRequestHandled]);

  // Header reset is the panel-wide "start over": restore the seeded meeting chat and reset the
  // revalidation arc so the demo can be re-run cleanly.
  const reset = useCallback(() => {
    setMessages(seedMeetingTurns());
    signedRef.current = false;
    reconciledRef.current = false;
    handledBriefRequestRef.current = 0;
    resetActions();
    resetRevalidation();
    if (LIVE) lifecycleReset.mutate();
  }, [lifecycleReset]);

  const submitAgent = useCallback(
    (display: string, message: string) => {
      if (chat.isPending) return;

      if (isDecisionBriefCommand(message)) {
        appendBriefPreview(display);
        return;
      }

      // Prior turns only (strip UI-only meta); the new message is sent separately, not in history.
      const history = privateHistory(messages);
      setMessages((m) => [...m, privateUserTurn(display)]);
      chat.mutate(
        { message, history },
        {
          onSuccess: (data) => setMessages((m) => [...m, privateAssistantTurn(data.reply, data)]),
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
    [appendBriefPreview, chat, messages],
  );

  const send = useCallback(
    (text: string) => {
      const invocation = getAgentInvocation(text);
      if (!invocation) {
        setMessages((m) => [...m, publicMeetingTurn(text)]);
        return;
      }
      submitAgent(invocation.display, invocation.message);
    },
    [submitAgent],
  );

  const runQuickPrompt = useCallback(
    (id: string, label: string) => {
      if (chat.isPending) return;
      const response = starterResponse(id, governed);
      if (!response) return;
      setMessages((m) => [...m, privateUserTurn(agentPrompt(label)), response]);
      if (id === "followups") {
        openDrawer({ mode: "plan", source: "Acme renewal — pre-committee review" });
      }
    },
    [chat.isPending, governed],
  );

  // A suggested-action button under an assistant turn. Each kind advances the governed-change arc.
  const onAction = useCallback(
    (action: ChatAction) => {
      switch (action.kind) {
        case "explain":
          // Re-ask through the normal channel so the permission-aware explanation reads as a turn.
          submitAgent(agentPrompt("Why does this need approval?"), "Why does this need approval?");
          break;
        case "route_credit_officer":
          {
            const row = governed.decision_readiness.rows.find(
              (item) => item.id === "credit_officer_approval",
            );
            setMessages((m) => [
              ...m,
              privateUserTurn(agentPrompt("Stage: route 22% to Credit Officer")),
              privateAssistantTurn(FLOW.staged.reply, FLOW.staged),
            ]);
            if (row?.action) {
              stageDecisionReadinessRemediation(row);
            } else {
              openDrawer({
                mode: "staged_remediation",
                source: "Decision readiness — staged route",
              });
            }
          }
          break;
        case "apply_capped":
          setMessages((m) => [
            ...m,
            privateUserTurn(agentPrompt("Use the max I can authorize (15%)")),
            privateAssistantTurn(FLOW.capped.reply, FLOW.capped),
          ]);
          break;
        case "open_cascade":
          openDrawer({
            mode: "revalidation_edit",
            source: "Credit Officer response — approval returned",
            change_kind: "approval_returned",
          });
          break;
        case "propose_followups":
          openDrawer({ mode: "plan", source: "Acme renewal — pre-committee review" });
          break;
      }
    },
    [governed.decision_readiness.rows, submitAgent],
  );

  const simulatePendingResponse = useCallback(
    (pending: string) => {
      if (pending !== PENDING_CREDIT_OFFICER) return;
      if (!reval.routed || reval.creditSigned) return;
      setMessages((m) => [
        ...m.map((turn) =>
          turn.pending === PENDING_CREDIT_OFFICER ? { ...turn, pending: undefined } : turn,
        ),
        privateUserTurn(agentPrompt("Simulate Credit Officer response")),
      ]);
      if (simulateCreditOfficerResponse()) {
        recordReturnedChangeNotification();
      }
    },
    [reval.creditSigned, reval.routed],
  );

  // Visible CO response → push the honest partial-recompute turn + the cascade dependency.
  useEffect(() => {
    if (reval.creditSigned && !signedRef.current) {
      signedRef.current = true;
      setMessages((m) => [...m, privateAssistantTurn(FLOW.signed.reply, FLOW.signed)]);
    }
  }, [reval.creditSigned]);

  // Dana accepts the cascade edit → push the conflict-cleared turn + the follow-ups handoff.
  useEffect(() => {
    if (reval.csReconciled && !reconciledRef.current) {
      reconciledRef.current = true;
      setMessages((m) => [...m, privateAssistantTurn(FLOW.accepted.reply, FLOW.accepted)]);
    }
  }, [reval.csReconciled]);

  return (
    <aside
      className="flex h-full w-full flex-col overflow-hidden border-l border-border bg-background shadow-panel"
      aria-label="Chat"
    >
      <div className="shrink-0">
        <AgentHeader onReset={reset} />
        <div className="mt-4 border-b border-border" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <ChatThread
          messages={messages}
          pending={chat.isPending}
          onAction={onAction}
          onSimulatePending={simulatePendingResponse}
        />
      </div>

      <div className="shrink-0 bg-background/95 backdrop-blur">
        <div className="grid grid-cols-2 gap-2 border-t border-border px-5 py-3">
          {entry_actions.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={chat.isPending}
              onClick={() => runQuickPrompt(a.id, STARTER_LABELS[a.id] ?? a.label)}
              className="rounded-md border border-border bg-card px-3 py-2 text-left text-[12.5px] leading-snug text-foreground transition-colors hover:border-primary/30 hover:bg-[var(--primary-tint)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {a.label}
            </button>
          ))}
        </div>
        <InputBar onSubmit={send} pending={chat.isPending} />
      </div>
    </aside>
  );
}

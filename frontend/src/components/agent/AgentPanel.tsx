import { useState, useCallback } from "react";
import { toast } from "sonner";
import { AgentHeader } from "./AgentHeader";
import { ScopeStrip } from "./ScopeStrip";
import { IdleState } from "./IdleState";
import { ThinkingState } from "./ThinkingState";
import { ResultBrief } from "./ResultBrief";
import { InputBar } from "./InputBar";
import { ChatThread, type Turn } from "./ChatThread";
import { useChatMutation } from "@/hooks/queries";

type AgentState = "idle" | "thinking" | "result";

export function AgentPanel() {
  const [state, setState] = useState<AgentState>("idle");
  const [messages, setMessages] = useState<Turn[]>([]);
  const chat = useChatMutation();

  // Entry buttons → "generate" (the brief flow). Free text → "ask" (the governed chat below).
  const start = useCallback((_id: string) => {
    setState("thinking");
  }, []);

  // Header reset is the panel-wide "start over": return to idle AND drop the conversation, so the
  // entry buttons reappear and no prior context lingers on a permission-scoped surface.
  const reset = useCallback(() => {
    setState("idle");
    setMessages([]);
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

  const hasChat = messages.length > 0;

  return (
    <aside
      className="flex h-full w-full flex-col overflow-hidden border-l border-border bg-background shadow-panel"
      aria-label="Command Agent"
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
        {hasChat && <ChatThread messages={messages} pending={chat.isPending} />}
      </div>

      <InputBar onSubmit={send} pending={chat.isPending} />
    </aside>
  );
}

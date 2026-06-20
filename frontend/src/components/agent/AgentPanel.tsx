import { useState, useCallback } from "react";
import { AgentHeader } from "./AgentHeader";
import { ScopeStrip } from "./ScopeStrip";
import { IdleState } from "./IdleState";
import { ThinkingState } from "./ThinkingState";
import { ResultBrief } from "./ResultBrief";
import { InputBar } from "./InputBar";

type AgentState = "idle" | "thinking" | "result";

export function AgentPanel() {
  const [state, setState] = useState<AgentState>("idle");

  const start = useCallback((_id: string) => {
    setState("thinking");
  }, []);

  const reset = useCallback(() => setState("idle"), []);

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
        {state === "idle" && <IdleState onStart={start} />}
        {state === "thinking" && <ThinkingState onDone={() => setState("result")} />}
        {state === "result" && <ResultBrief onFollowups={() => start("followups")} />}
      </div>

      <InputBar onSubmit={() => start("ask")} />
    </aside>
  );
}

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { useMeetingQuery } from "@/hooks/queries";

export function ThinkingState({ onDone }: { onDone: () => void }) {
  const { plan_steps } = useMeetingQuery().data;
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    if (completed >= plan_steps.length) {
      const t = setTimeout(onDone, 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCompleted((c) => c + 1), 650);
    return () => clearTimeout(t);
  }, [completed, onDone]);

  return (
    <div className="px-5 pt-5" aria-live="polite">
      {/* gradient progress hairline */}
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-[var(--canvas)]">
        <div className="h-full w-full animate-gradient-slide bg-gradient-to-r from-[#0061d5] via-[#6c4ce0] to-[#0061d5]" />
      </div>

      <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-fg)]">
        Working
      </div>

      <ol className="mt-3 space-y-2.5">
        {plan_steps.map((step, i) => {
          const done = i < completed;
          const active = i === completed;
          const visible = i <= completed;
          if (!visible) {
            return (
              <li
                key={step}
                className="flex items-center gap-2.5 text-[13px] text-[var(--muted-fg)]/60"
              >
                <span className="h-4 w-4 shrink-0 rounded-full border border-dashed border-border" />
                <span>{step}</span>
              </li>
            );
          }
          return (
            <li key={step} className="flex animate-plan-in items-center gap-2.5 text-[13px]">
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                  done ? "bg-primary text-white" : "text-primary"
                }`}
              >
                {done ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
              </span>
              <span className={done ? "text-[var(--secondary-text)]" : "text-foreground"}>
                {step}
                {active && <span className="ml-1 text-[var(--muted-fg)]">…</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import { Sparkles } from "lucide-react";
import { useMeetingQuery } from "@/hooks/queries";

export function IdleState({ onStart }: { onStart: (id: string) => void }) {
  const { entry_actions } = useMeetingQuery().data;
  const primary = entry_actions.find((a) => a.primary)!;
  const secondary = entry_actions.filter((a) => !a.primary);

  return (
    <div className="px-5 pt-5">
      <p className="text-[13px] leading-relaxed text-[var(--secondary-text)]">
        Ask about this meeting, or generate a governed work product.{" "}
        <span className="text-foreground">I only use content you're permitted to see.</span>
      </p>

      <button
        type="button"
        onClick={() => onStart(primary.id)}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-ai px-4 text-[13px] font-semibold text-white shadow-card transition-transform duration-150 hover:brightness-105 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
        {primary.label}
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {secondary.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onStart(a.id)}
            className="rounded-md border border-border bg-card px-3 py-2 text-left text-[12.5px] leading-snug text-foreground transition-colors hover:border-primary/30 hover:bg-[var(--primary-tint)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

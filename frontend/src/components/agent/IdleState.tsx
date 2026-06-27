import { useMeetingQuery } from "@/hooks/queries";

export function IdleState({ onStart }: { onStart: (id: string) => void }) {
  const { entry_actions } = useMeetingQuery().data;

  return (
    <div className="px-5 pt-5">
      <div className="grid grid-cols-2 gap-2">
        {entry_actions.map((a) => (
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

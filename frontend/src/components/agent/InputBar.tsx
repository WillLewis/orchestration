import { Shield, ArrowUp } from "lucide-react";
import { useState } from "react";

export function InputBar({
  onSubmit,
  pending = false,
}: {
  onSubmit: (text: string) => void;
  pending?: boolean;
}) {
  const [v, setV] = useState("");
  return (
    <div className="sticky bottom-0 border-t border-border bg-background/95 px-5 pb-4 pt-3 backdrop-blur">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = v.trim();
          if (!text || pending) return;
          setV("");
          onSubmit(text);
        }}
        className="flex items-center gap-2 rounded-full border border-border bg-card pl-4 pr-1.5 py-1.5 shadow-card focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-[var(--primary-tint)]"
      >
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Ask about Acme renewal…"
          className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-[var(--muted-fg)] focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={pending}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-ai text-white transition-transform hover:brightness-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.75} />
        </button>
      </form>
      <div className="mt-2 flex items-center justify-center gap-1 text-[10.5px] text-[var(--muted-fg)]">
        <Shield className="h-3 w-3" />
        Permissions-aware · answers cite only sources you can access
      </div>
    </div>
  );
}

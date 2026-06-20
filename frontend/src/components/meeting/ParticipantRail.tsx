import { meeting } from "@/lib/meeting-data";
import { Mic } from "lucide-react";

export function ParticipantRail() {
  return (
    <div className="flex gap-3 px-6 pt-5">
      {meeting.participants.map((p) => {
        const speaking = p.speaking;
        return (
          <div
            key={p.initials}
            className={`flex flex-1 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-shadow ${
              speaking ? "border-primary/40 ring-2 ring-[var(--primary-tint)]" : "border-border"
            }`}
          >
            <div className="relative">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--canvas)] text-[12px] font-semibold text-[var(--secondary-text)]">
                {p.initials}
              </div>
              {speaking && (
                <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-white shadow-card">
                  <Mic className="h-2.5 w-2.5" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-foreground">{p.name}</div>
              <div className="truncate text-[11px] text-[var(--muted-fg)]">{p.role}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

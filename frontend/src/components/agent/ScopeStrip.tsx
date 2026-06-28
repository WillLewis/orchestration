import { Briefcase, Files } from "lucide-react";
import { useMeetingQuery } from "@/hooks/queries";

export function ScopeStrip() {
  const { meeting } = useMeetingQuery().data;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
        <Briefcase className="h-3 w-3" />
        {meeting.deal}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
        <Files className="h-3 w-3" />
        {meeting.source_count} sources
      </span>
    </div>
  );
}

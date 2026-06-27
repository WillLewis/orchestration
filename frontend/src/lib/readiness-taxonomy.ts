import type { DecisionReadinessRow } from "@/data/brief";

export type ReadinessTaxonomy = "approval" | "artifact" | "conflict" | "calculation" | "status";

export function getReadinessTaxonomy(row: DecisionReadinessRow): ReadinessTaxonomy {
  if (
    row.id.includes("conflict") ||
    row.action?.tool === "edit_document" ||
    (row.source_ids.includes("doc_pricing_exception") && row.source_ids.includes("doc_cs_plan"))
  ) {
    return "conflict";
  }

  if (row.explainer?.kind === "calculation") return "calculation";

  if (
    row.action?.tool === "create_task" ||
    row.id.includes("tracker") ||
    row.source_ids.some((id) => id.includes("tracker"))
  ) {
    return "artifact";
  }

  if (
    row.action?.tool === "route_approval" ||
    row.action?.required_approver ||
    row.id.includes("approval") ||
    row.gate.toLowerCase().includes("approval")
  ) {
    return "approval";
  }

  return "status";
}

export const READINESS_TAXONOMY_LABEL: Record<ReadinessTaxonomy, string> = {
  approval: "Person approval",
  artifact: "Missing artifact",
  conflict: "Source conflict",
  calculation: "Calculation",
  status: "Readiness",
};

export const READINESS_TAXONOMY_STYLE: Record<
  ReadinessTaxonomy,
  { row: string; icon: string; label: string }
> = {
  approval: {
    row: "border-l-4 border-l-primary bg-[var(--primary-tint)]/25",
    icon: "bg-[var(--primary-tint)] text-primary",
    label: "text-primary",
  },
  artifact: {
    row: "border-l-4 border-l-[var(--warning)] bg-[var(--warning-bg)]/35",
    icon: "bg-[var(--warning-bg)] text-[var(--warning)]",
    label: "text-[var(--warning)]",
  },
  conflict: {
    row: "border-l-4 border-l-[var(--danger)] bg-[var(--danger-bg)]/35",
    icon: "bg-[var(--danger-bg)] text-[var(--danger)]",
    label: "text-[var(--danger)]",
  },
  calculation: {
    row: "border-l-4 border-l-[var(--success)] bg-[var(--success-bg)]/25",
    icon: "bg-[var(--success-bg)] text-[var(--success)]",
    label: "text-[var(--success)]",
  },
  status: {
    row: "border-l-4 border-l-border bg-background",
    icon: "bg-[var(--canvas)] text-[var(--secondary-text)]",
    label: "text-[var(--secondary-text)]",
  },
};

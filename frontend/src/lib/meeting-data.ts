export const meeting = {
  title: "Acme renewal — pre-committee review",
  deal: "Acme renewal",
  participants: [
    { initials: "DR", name: "Dana R.", role: "Relationship Mgr", speaking: true },
    { initials: "CO", name: "Chris O.", role: "Credit Officer" },
    { initials: "PN", name: "Priya N.", role: "Risk" },
    { initials: "SL", name: "Sam L.", role: "Legal" },
  ],
  source_count: 12,
};

export const entry_actions = [
  { id: "brief", label: "Generate Decision Brief", primary: true as const },
  { id: "changed", label: "What changed since last review?" },
  { id: "approval", label: "Check approval readiness" },
  { id: "followups", label: "Agent Actions" },
  { id: "summary", label: "Summarize this meeting" },
  { id: "monitor", label: "Monitor this decision" },
];

// Single source of truth: re-export the shared brief mock so both surfaces
// (meeting side panel + Decision Packet workspace) read identical data.
export { decision_brief } from "@/data/brief";

export const plan_steps = [
  "Checking prior committee meeting",
  "Credit memo & financial model",
  "Approval workflow & project status",
  "Running policy & calculation checks",
];

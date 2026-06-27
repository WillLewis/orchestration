import type { Turn } from "./ChatThread";

const AGENT_PREFIX = /^@agent\b[\s:,-]*/i;

export const QUICK_PROMPT_PREFIX = "@Agent";

export function getAgentInvocation(input: string): { display: string; message: string } | null {
  const clean = input.trim();
  if (!AGENT_PREFIX.test(clean)) return null;

  const message = clean.replace(AGENT_PREFIX, "").trim();
  if (!message) return null;

  return {
    display: `${QUICK_PROMPT_PREFIX} ${message}`,
    message,
  };
}

export function agentPrompt(label: string): string {
  return `${QUICK_PROMPT_PREFIX} ${label.trim()}`;
}

export function isDecisionBriefCommand(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .replace(/[.,!?'"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const hasGenerateVerb = /\b(generate|draft|create|prepare|build|open)\b/.test(normalized);
  return hasGenerateVerb && normalized.includes("decision brief");
}

export function seedMeetingTurns(): Turn[] {
  return [
    {
      role: "user",
      content:
        "Can we make sure the 22% exception is tied to the approval workflow before committee?",
      author: "Chris O.",
      visibility: "public",
    },
    {
      role: "user",
      content: "I also want the covenant tracker called out if it is still missing.",
      author: "Priya N.",
      visibility: "public",
    },
  ];
}

export function publicMeetingTurn(content: string): Turn {
  return {
    role: "user",
    content,
    author: "Dana R.",
    visibility: "public",
  };
}

export function privateUserTurn(content: string): Turn {
  return {
    role: "user",
    content,
    author: "You",
    visibility: "private",
  };
}

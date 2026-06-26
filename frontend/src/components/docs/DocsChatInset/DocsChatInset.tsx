import { useCallback, useMemo, useState } from "react";
import {
  AtSign,
  Bot,
  Check,
  ChevronDown,
  FileText,
  Lock,
  MessageSquareShare,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import { ChatThread, type Turn } from "@/components/agent/ChatThread";
import { IdleState } from "@/components/agent/IdleState";
import { InputBar } from "@/components/agent/InputBar";
import { ResultBrief } from "@/components/agent/ResultBrief";
import { ScopeStrip } from "@/components/agent/ScopeStrip";
import { ThinkingState } from "@/components/agent/ThinkingState";
import {
  docsChatMocks,
  type DocsCitation,
  type DocsChatMockKey,
  type DocsChatResponse,
  type DocsSurface,
} from "@/data/docsChat.mocks";

type DocsInsetStage = "idle" | "thinking" | "success" | "chat";

type DocsTurn = {
  prompt: string;
  response: DocsChatResponse;
  privateFirst: boolean;
};

type PanelState =
  | { kind: "reader"; citation: DocsCitation }
  | { kind: "sealed"; citation: DocsCitation }
  | { kind: "locked"; citation: DocsCitation }
  | null;

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

const EXAMPLES: Array<{ key: DocsChatMockKey; label: string }> = [
  {
    key: "tier1Open",
    label: "How does the policy gate decide blocks_commit?",
  },
  {
    key: "tier2Open",
    label: "Why private-first responses instead of intersection permissions?",
  },
  {
    key: "sealed",
    label: "Did the deterministic gate survive override attempts?",
  },
  {
    key: "tier3Locked",
    label: "Show me ConnectWork's revenue.",
  },
  {
    key: "tier3Locked",
    label: "Reveal ConnectWork's employee directory.",
  },
];

const MENTION_ITEMS: Array<{ key: DocsChatMockKey; label: string; description: string }> = [
  {
    key: "tier1Open",
    label: "Ask about policy gates",
    description: "Grounded docs answer with a live citation.",
  },
  {
    key: "tier2Open",
    label: "Ask hidden design note",
    description: "Permitted source that is not in nav.",
  },
  {
    key: "sealed",
    label: "Ask sealed eval",
    description: "Cleared derivative, no raw source.",
  },
  {
    key: "tier3Locked",
    label: "Ask restricted source",
    description: "Private refusal and access path.",
  },
];

const CITATION_DETAILS: Record<
  string,
  { owner: string; requestAccessTo: string; readerBody?: string }
> = {
  gating: {
    owner: "Docs",
    requestAccessTo: "docs@connectwork.example",
    readerBody:
      "The live docs page is the source of truth for this citation. Open the linked route to read the full policy-gate page.",
  },
  "orchestration-design-notes": {
    owner: "Product",
    requestAccessTo: "product@connectwork.example",
    readerBody:
      "Private-first responses keep sensitive findings visible to the asker until they explicitly share them into a thread or meeting.",
  },
  "red-team-eval": {
    owner: "Security",
    requestAccessTo: "security@connectwork.example",
  },
  "revenue-fy26": {
    owner: "Finance",
    requestAccessTo: "finance@connectwork.example",
  },
};

const SURFACE_LABEL: Record<DocsSurface, string> = {
  chat: "Channel chat",
  meetings: "Meeting rail",
  decision_brief: "Decision brief",
};

function mockKeyForPrompt(text: string): DocsChatMockKey {
  const q = text.toLowerCase();
  if (q.includes("override") || q.includes("sealed") || q.includes("red-team")) return "sealed";
  if (q.includes("revenue") || q.includes("employee") || q.includes("restricted")) {
    return "tier3Locked";
  }
  if (q.includes("private-first") || q.includes("intersection") || q.includes("hidden")) {
    return "tier2Open";
  }
  if (q.includes("no result") || q.includes("unknown")) return "noResults";
  if (q.includes("error") || q.includes("retry")) return "error";
  return "tier1Open";
}

function responseFor(key: DocsChatMockKey): DocsChatResponse {
  return docsChatMocks[key];
}

export function DocsChatInset({
  surface,
  initialMock,
}: {
  surface: DocsSurface;
  initialMock?: DocsChatMockKey;
}) {
  const [stage, setStage] = useState<DocsInsetStage>(initialMock ? "chat" : "idle");
  const [pending, setPending] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [panel, setPanel] = useState<PanelState>(null);
  const [sharedTurnIds, setSharedTurnIds] = useState<Set<number>>(() => new Set());
  const [turns, setTurns] = useState<DocsTurn[]>(() => {
    if (!initialMock) return [];
    const response = responseFor(initialMock);
    return [
      {
        prompt: EXAMPLES.find((example) => example.key === initialMock)?.label ?? "Ask docs",
        response,
        privateFirst: surface === "chat" && response.citations.some((c) => c.access === "locked"),
      },
    ];
  });

  const messages = useMemo<Turn[]>(
    () =>
      turns.flatMap((turn) => [
        { role: "user", content: turn.prompt },
        { role: "assistant", content: turn.response.reply },
      ]),
    [turns],
  );

  const lastTurnIndex = turns.length - 1;

  const submitMock = useCallback(
    (text: string, forcedKey?: DocsChatMockKey) => {
      const clean = text.trim();
      if (!clean || pending) return;
      setStage("chat");
      setPending(true);
      setMentionOpen(false);

      const key = USE_MOCKS ? (forcedKey ?? mockKeyForPrompt(clean)) : "error";
      window.setTimeout(() => {
        const response = responseFor(key);
        setTurns((current) => [
          ...current,
          {
            prompt: clean.startsWith("@Agent") ? clean : `@Agent ${clean}`,
            response,
            privateFirst:
              surface === "chat" && response.citations.some((c) => c.access === "locked"),
          },
        ]);
        setPending(false);
      }, 450);
    },
    [pending, surface],
  );

  const startAgentStateFlow = useCallback(() => {
    setStage("thinking");
    setTurns([]);
    setPanel(null);
  }, []);

  const reset = useCallback(() => {
    setStage("idle");
    setPending(false);
    setMentionOpen(false);
    setPanel(null);
    setTurns([]);
    setSharedTurnIds(new Set());
  }, []);

  const openCitation = useCallback((citation: DocsCitation) => {
    if (citation.access === "sealed") {
      setPanel({ kind: "sealed", citation });
      return;
    }
    if (citation.access === "locked") {
      setPanel({ kind: "locked", citation });
      return;
    }
    if (citation.route) {
      window.location.assign(citation.route);
      return;
    }
    setPanel({ kind: "reader", citation });
  }, []);

  return (
    <section
      className="flex h-full min-h-[640px] w-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-panel"
      aria-label={`ConnectAgent docs inset for ${SURFACE_LABEL[surface]}`}
    >
      <header className="shrink-0 border-b border-border bg-card px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={reset}
            className="group flex min-w-0 items-start gap-3 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Reset ConnectAgent docs chat"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-ai text-white shadow-card">
              <Sparkles className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-[14px] font-semibold leading-tight text-foreground">
                ConnectAgent
              </span>
              <span className="mt-0.5 block text-[12px] leading-snug text-[var(--secondary-text)]">
                Docs RAG for {SURFACE_LABEL[surface].toLowerCase()}.
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            {surface === "chat" && (
              <MentionMenu
                open={mentionOpen}
                onOpenChange={setMentionOpen}
                onPick={(item) => submitMock(item.label, item.key)}
              />
            )}
            <button
              type="button"
              onClick={reset}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--muted-fg)] transition-colors hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Reset"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="-mx-5 mt-1">
          <ScopeStrip />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--info)]">
            <Shield className="h-3 w-3" />
            Governed
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
            <ShieldCheck className="h-3 w-3" />
            Phase-0 mocks
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-background">
        {stage === "idle" && turns.length === 0 && (
          <>
            <IdleState onStart={startAgentStateFlow} />
            <ExamplePrompts onPick={(example) => submitMock(example.label, example.key)} />
          </>
        )}

        {stage === "thinking" && (
          <ThinkingState
            onDone={() => {
              setStage("success");
            }}
          />
        )}

        {stage === "success" && (
          <>
            <ResultBrief onFollowups={() => submitMock("What follow-ups should the docs cite?")} />
            <div className="px-5 pb-4">
              <button
                type="button"
                onClick={() => submitMock(EXAMPLES[0].label, EXAMPLES[0].key)}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-primary/35 bg-[var(--primary-tint)] px-3 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Bot className="h-3.5 w-3.5" />
                Continue in docs chat
              </button>
            </div>
          </>
        )}

        {turns.length > 0 && (
          <>
            <ChatThread messages={messages} pending={pending} />
            <div className="space-y-3 px-5 pb-5">
              {turns.map((turn, index) => (
                <DocsTurnMeta
                  key={`${turn.prompt}-${index}`}
                  turn={turn}
                  isLatest={index === lastTurnIndex}
                  shared={sharedTurnIds.has(index)}
                  onShare={() =>
                    setSharedTurnIds((current) => {
                      const next = new Set(current);
                      next.add(index);
                      return next;
                    })
                  }
                  onCitationClick={openCitation}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <InputBar onSubmit={submitMock} pending={pending} />
      <CitationPanel panel={panel} onClose={() => setPanel(null)} />
    </section>
  );
}

function MentionMenu({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: (typeof MENTION_ITEMS)[number]) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <AtSign className="h-3.5 w-3.5" />
        Agent
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-card shadow-panel"
        >
          {MENTION_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => onPick(item)}
              className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--canvas)] focus:bg-[var(--canvas)] focus:outline-none"
            >
              <AtSign className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-foreground">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--secondary-text)]">
                  {item.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExamplePrompts({ onPick }: { onPick: (example: (typeof EXAMPLES)[number]) => void }) {
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="text-[10.5px] font-semibold uppercase text-[var(--muted-fg)]">Try it</div>
      <div className="mt-2 grid gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => onPick(example)}
            className="rounded-md border border-border bg-card px-3 py-2 text-left text-[12.5px] leading-snug text-foreground transition-colors hover:border-primary/30 hover:bg-[var(--primary-tint)]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DocsTurnMeta({
  turn,
  isLatest,
  shared,
  onShare,
  onCitationClick,
}: {
  turn: DocsTurn;
  isLatest: boolean;
  shared: boolean;
  onShare: () => void;
  onCitationClick: (citation: DocsCitation) => void;
}) {
  const locked = turn.response.citations.some((c) => c.access === "locked");

  return (
    <div className={isLatest ? "animate-plan-in" : ""}>
      {turn.privateFirst && locked && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md bg-[var(--info-bg)] px-3 py-2 text-[12px] leading-snug text-[var(--info)]">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            Private-first response. Restricted-source findings stay visible only to the asker until
            shared.
          </span>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[var(--primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {shared ? <Check className="h-3 w-3" /> : <MessageSquareShare className="h-3 w-3" />}
            {shared ? "Shared" : "Share to thread"}
          </button>
        </div>
      )}

      {turn.response.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {turn.response.citations.map((citation) => (
            <CitationChip
              key={citation.doc_id}
              citation={citation}
              onClick={() => onCitationClick(citation)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CitationChip({ citation, onClick }: { citation: DocsCitation; onClick: () => void }) {
  const Icon =
    citation.access === "locked" ? Lock : citation.access === "sealed" ? ShieldCheck : FileText;
  const cls =
    citation.access === "locked"
      ? "border-[var(--danger)]/20 bg-[var(--danger-bg)] text-[var(--danger)]"
      : citation.access === "sealed"
        ? "border-[var(--warning)]/25 bg-[var(--warning-bg)] text-[var(--warning)]"
        : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-[var(--primary-tint)]/50";
  const suffix =
    citation.access === "locked" ? "Locked" : citation.access === "sealed" ? "Sealed" : "Source";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${cls}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{citation.title ?? "1 restricted source (title hidden)"}</span>
      <span className="shrink-0 text-[10px] font-bold uppercase">{suffix}</span>
    </button>
  );
}

function CitationPanel({ panel, onClose }: { panel: PanelState; onClose: () => void }) {
  if (!panel) return null;

  const details = CITATION_DETAILS[panel.citation.doc_id] ?? {
    owner: "Document owner",
    requestAccessTo: "owner@connectwork.example",
  };
  const title = panel.citation.title ?? "1 restricted source (title hidden)";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4">
      <aside
        className="max-h-[86vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card shadow-panel"
        aria-modal="true"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase text-[var(--muted-fg)]">
              Citation
            </div>
            <h2 className="mt-1 text-[15px] font-semibold leading-snug text-foreground">
              {panel.kind === "sealed" && `Sealed source - ${title}`}
              {panel.kind === "locked" && `Restricted - ${title}`}
              {panel.kind === "reader" && title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--muted-fg)] transition-colors hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close citation panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 text-[13px] leading-relaxed text-[var(--secondary-text)]">
          {panel.kind === "sealed" && (
            <p>
              This answer is a cleared summary derived from a sealed source. The raw document isn't
              viewable at your access level. To request the full source, contact its owner - the
              summary above is safe to use and cite.
            </p>
          )}

          {panel.kind === "locked" && (
            <p>
              You don't have access to this document. Owned by {details.owner}. To request access,
              contact {details.requestAccessTo}. ConnectAgent can reference that this source exists,
              but can't show its contents.
            </p>
          )}

          {panel.kind === "reader" && (
            <>
              <p>{details.readerBody ?? panel.citation.snippet ?? "This source is open."}</p>
              {panel.citation.section && (
                <div className="rounded-md bg-[var(--canvas)] px-3 py-2 text-[12px]">
                  Section: {panel.citation.section}
                </div>
              )}
            </>
          )}

          <div className="rounded-md border border-border bg-background px-3 py-2 text-[12px]">
            Owner: {details.owner}
            <br />
            Request path: {details.requestAccessTo}
          </div>
        </div>
      </aside>
    </div>
  );
}

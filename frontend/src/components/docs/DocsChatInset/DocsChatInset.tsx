import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  AtSign,
  BookOpen,
  Bot,
  Check,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  Lock,
  MessageCircle,
  MessageSquareShare,
  PanelRight,
  PenLine,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  docsChatMocks,
  type DocsCitation,
  type DocsChatMockKey,
  type DocsChatMessage,
  type DocsChatResponse,
  type DocsConfidence,
  type DocsSurface,
} from "@/data/docsChat.mocks";
import { slugify } from "@/lib/docs-slug";

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

type ExamplePrompt = {
  key: DocsChatMockKey;
  label: string;
  description: string;
};

type RetryTarget = {
  text: string;
  key?: DocsChatMockKey;
};

type SurfaceController = {
  surface: DocsSurface;
  live: boolean;
  turns: DocsTurn[];
  pending: boolean;
  loadingStep: number;
  panel: PanelState;
  sharedTurnIds: Set<number>;
  submitDocs: (text: string, forcedKey?: DocsChatMockKey) => void;
  reset: () => void;
  retry: () => void;
  openCitation: (citation: DocsCitation) => void;
  closePanel: () => void;
  shareTurn: (index: number) => void;
};

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "http://localhost:8000";

const LOADING_STEPS = [
  "Checking permissions",
  "Searching docs",
  "Validating citations",
] as const;

const SURFACE_COPY: Record<
  DocsSurface,
  {
    label: string;
    placeholder: string;
    emptyTitle: string;
    emptyBody: string;
  }
> = {
  chat: {
    label: "Channel chat",
    placeholder: "Ask @Agent about the docs...",
    emptyTitle: "Ask from the channel, answer privately first",
    emptyBody:
      "Mention @Agent to get a docs-grounded answer that only you can see until you share it.",
  },
  meetings: {
    label: "Meeting rail",
    placeholder: "Ask @Agent about this meeting or the docs...",
    emptyTitle: "Ask from the meeting rail",
    emptyBody:
      "ConnectAgent answers in your rail while the shared document and participants stay visible.",
  },
  decision_brief: {
    label: "Decision brief",
    placeholder: "Ask @Agent about this draft or generate a brief...",
    emptyTitle: "Generate a docs-grounded brief",
    emptyBody:
      "Start with Generate Decision Brief or ask a docs question from the command rail.",
  },
};

const EXAMPLES: ExamplePrompt[] = [
  {
    key: "tier1Open",
    label: "How does the policy gate decide blocks_commit?",
    description: "Grounded answer with an open docs section.",
  },
  {
    key: "tier2Open",
    label: "Why private-first responses instead of intersection permissions?",
    description: "Permitted source that is not in the public nav.",
  },
  {
    key: "sealed",
    label: "Did the deterministic gate survive override attempts?",
    description: "Cleared derivative from a sealed evaluation.",
  },
  {
    key: "tier3Locked",
    label: "Show me a restricted-source behavior example.",
    description: "Locked citation with no source snippet.",
  },
  {
    key: "noResults",
    label: "Ask about an unknown docs topic with no result.",
    description: "No-results recovery state.",
  },
  {
    key: "error",
    label: "Simulate a docs RAG service error.",
    description: "Retry and static-doc fallback state.",
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
      "The live docs page is the source of truth for this citation. Open the linked route to read the full policy-gate section.",
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
  "enterprise-admin-audit": {
    owner: "Platform Governance",
    requestAccessTo: "governance@connectwork.example",
  },
  "employee-directory": {
    owner: "People",
    requestAccessTo: "people@connectwork.example",
  },
};

const DOCS_MEETING_PARTICIPANTS = [
  { initials: "NL", name: "Nia L.", role: "Product Ops", speaking: true },
  { initials: "AR", name: "Ari R.", role: "Docs Engineering" },
  { initials: "PK", name: "Priya K.", role: "Security Review" },
  { initials: "JS", name: "Jon S.", role: "Solutions" },
];

const CONFIDENCE_META: Record<DocsConfidence, { label: string; className: string }> = {
  grounded: {
    label: "Grounded",
    className: "border-[var(--success)]/25 bg-[var(--success-bg)] text-[var(--success)]",
  },
  partial: {
    label: "Partial",
    className: "border-[var(--warning)]/25 bg-[var(--warning-bg)] text-[var(--warning)]",
  },
  weak: {
    label: "Weak",
    className: "border-[var(--danger)]/20 bg-[var(--danger-bg)] text-[var(--danger)]",
  },
};

function mockKeyForPrompt(text: string): DocsChatMockKey {
  const q = text.toLowerCase();
  if (q.includes("unknown") || q.includes("no result")) return "noResults";
  if (q.includes("error") || q.includes("retry")) return "error";
  if (q.includes("override") || q.includes("sealed") || q.includes("red-team")) return "sealed";
  if (q.includes("restricted") || q.includes("admin audit") || q.includes("locked")) {
    return "tier3Locked";
  }
  if (q.includes("private-first") || q.includes("intersection") || q.includes("hidden")) {
    return "tier2Open";
  }
  return "tier1Open";
}

function responseFor(key: DocsChatMockKey): DocsChatResponse {
  return docsChatMocks[key];
}

function fallbackResponseFor(text: string, forcedKey?: DocsChatMockKey): DocsChatResponse {
  return responseFor(forcedKey ?? mockKeyForPrompt(text));
}

async function postDocsChat(
  surface: DocsSurface,
  message: string,
  history: DocsChatMessage[],
): Promise<DocsChatResponse> {
  const res = await fetch(`${API_BASE}/docs/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ surface, message, history }),
  });
  if (!res.ok) throw new Error(`/docs/chat returned ${res.status}`);
  return (await res.json()) as DocsChatResponse;
}

function historyFromTurns(turns: DocsTurn[]): DocsChatMessage[] {
  return turns.flatMap((turn) => [
    { role: "user", content: turn.prompt },
    { role: "agent", content: turn.response.response },
  ]);
}

function citationAnchor(citation: DocsCitation): string | null {
  if (citation.anchor) return citation.anchor;
  if (citation.section) return slugify(citation.section, new Set<string>());
  return null;
}

function citationHref(citation: DocsCitation): string | null {
  if (!citation.route) return null;
  const anchor = citationAnchor(citation);
  return anchor ? `${citation.route}#${anchor}` : citation.route;
}

function useSurfaceController({
  surface,
  initialMock,
  live,
}: {
  surface: DocsSurface;
  initialMock?: DocsChatMockKey;
  live: boolean;
}): SurfaceController {
  const [pending, setPending] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [panel, setPanel] = useState<PanelState>(null);
  const [sharedTurnIds, setSharedTurnIds] = useState<Set<number>>(() => new Set());
  const [lastRetry, setLastRetry] = useState<RetryTarget | null>(null);
  const [turns, setTurns] = useState<DocsTurn[]>(() => {
    if (!initialMock) return [];
    const response = responseFor(initialMock);
    return [
      {
        prompt:
          EXAMPLES.find((example) => example.key === initialMock)?.label ??
          "Ask @Agent about the docs",
        response,
        privateFirst: surface === "chat",
      },
    ];
  });

  useEffect(() => {
    if (!pending) {
      setLoadingStep(0);
      return undefined;
    }

    const id = window.setInterval(() => {
      setLoadingStep((step) => Math.min(step + 1, LOADING_STEPS.length - 1));
    }, 520);

    return () => window.clearInterval(id);
  }, [pending]);

  const appendTurn = useCallback(
    (prompt: string, response: DocsChatResponse) => {
      setTurns((current) => [
        ...current,
        {
          prompt,
          response,
          privateFirst: surface === "chat",
        },
      ]);
    },
    [surface],
  );

  const submitDocs = useCallback(
    (text: string, forcedKey?: DocsChatMockKey) => {
      const clean = text.trim();
      if (!clean || pending) return;

      const prompt = clean.startsWith("@Agent") ? clean : `@Agent ${clean}`;
      const history = historyFromTurns(turns);
      setLastRetry({ text: clean, key: forcedKey });
      setPending(true);
      setPanel(null);

      if (!live) {
        window.setTimeout(() => {
          appendTurn(prompt, fallbackResponseFor(clean, forcedKey));
          setPending(false);
        }, 1150);
        return;
      }

      void postDocsChat(surface, clean, history)
        .then((response) => {
          appendTurn(prompt, response);
        })
        .catch(() => {
          appendTurn(prompt, fallbackResponseFor(clean, forcedKey));
        })
        .finally(() => {
          setPending(false);
        });
    },
    [appendTurn, live, pending, surface, turns],
  );

  const retry = useCallback(() => {
    const retryTarget = lastRetry ?? { text: EXAMPLES[0].label, key: EXAMPLES[0].key };
    submitDocs(retryTarget.text, retryTarget.key);
  }, [lastRetry, submitDocs]);

  const reset = useCallback(() => {
    setPending(false);
    setPanel(null);
    setTurns([]);
    setSharedTurnIds(new Set());
    setLastRetry(null);
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
    if (!citationHref(citation)) {
      setPanel({ kind: "reader", citation });
    }
  }, []);

  const shareTurn = useCallback((index: number) => {
    setSharedTurnIds((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
  }, []);

  return {
    surface,
    live,
    turns,
    pending,
    loadingStep,
    panel,
    sharedTurnIds,
    submitDocs,
    reset,
    retry,
    openCitation,
    closePanel: () => setPanel(null),
    shareTurn,
  };
}

export function DocsChatInset({
  surface,
  initialMock,
  live = false,
}: {
  surface: DocsSurface;
  initialMock?: DocsChatMockKey;
  live?: boolean;
}) {
  const controller = useSurfaceController({ surface, initialMock, live });

  if (surface === "meetings") return <MeetingSurface controller={controller} />;
  if (surface === "decision_brief") return <DecisionBriefSurface controller={controller} />;
  return <ChatSurface controller={controller} />;
}

function AppModeBadge({ live }: { live: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)]">
      <ShieldCheck className="h-3 w-3 text-primary" />
      {live ? "Live /docs/chat" : "Phase-0 mocks"}
    </span>
  );
}

function ChatSurface({ controller }: { controller: SurfaceController }) {
  const { turns, pending, loadingStep, submitDocs, openCitation, reset, retry } = controller;

  return (
    <section className="flex h-[780px] min-h-[700px] bg-background text-foreground">
      <main className="flex min-w-0 flex-1 flex-col border-r border-border">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <h2 className="truncate text-[15px] font-semibold"># docs-rag-fidelity</h2>
              <span className="rounded bg-[var(--success-bg)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--success)]">
                Private first
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-[var(--secondary-text)]">
              Ask docs questions in-channel. ConnectAgent answers only to you until shared.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AppModeBadge live={controller.live} />
            <button
              type="button"
              onClick={reset}
              className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted-fg)] hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Reset chat surface"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--canvas)] px-5 py-5">
          <div className="mx-auto max-w-3xl space-y-4">
            <ChannelMessage
              author="Nia"
              meta="Product Ops"
              tone="team"
              body="Can someone confirm how docs citations handle restricted material before we show this in a customer-facing flow?"
            />
            <ChannelMessage
              author="You"
              meta="Only visible to you"
              tone="user"
              body="@Agent can answer from the docs without posting restricted details to the channel."
            />

            {turns.length === 0 && !pending && (
              <EmptySurface
                surface="chat"
                onPick={(example) => submitDocs(example.label, example.key)}
              />
            )}

            {turns.map((turn, index) => (
              <ChatTurn
                key={`${turn.prompt}-${index}`}
                turn={turn}
                index={index}
                shared={controller.sharedTurnIds.has(index)}
                onShare={() => controller.shareTurn(index)}
                onCitationClick={openCitation}
                onRetry={retry}
                onAsk={submitDocs}
              />
            ))}

            {pending && <LoadingCard step={loadingStep} />}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-card px-4 py-3">
          <AgentComposer
            placeholder={SURFACE_COPY.chat.placeholder}
            pending={pending}
            onSubmit={submitDocs}
            compact={false}
          />
        </div>
      </main>

      <aside className="hidden w-[300px] shrink-0 bg-card px-4 py-4 lg:block">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold">
            <Bot className="h-4 w-4 text-primary" />
            ConnectAgent controls
          </div>
          <div className="mt-3 space-y-2 text-[12px] text-[var(--secondary-text)]">
            <InfoRow icon={<Shield className="h-3.5 w-3.5" />} label="Permission-scoped" />
            <InfoRow icon={<KeyRound className="h-3.5 w-3.5" />} label="Locked snippets hidden" />
            <InfoRow icon={<LinkIcon className="h-3.5 w-3.5" />} label="Anchored source chips" />
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
            Prompt menu
          </div>
          <ExampleList onPick={(example) => submitDocs(example.label, example.key)} />
        </div>
      </aside>

      <CitationPanel panel={controller.panel} onClose={controller.closePanel} />
    </section>
  );
}

function MeetingSurface({ controller }: { controller: SurfaceController }) {
  return (
    <section className="flex h-[780px] min-h-[700px] flex-col overflow-hidden bg-[var(--canvas)] text-foreground">
      <DocsMeetingTopBar />
      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--canvas)]">
          <DocsParticipantRail />
          <DocsMeetingDocument />
        </main>

        <aside className="flex min-h-[640px] shrink-0 flex-col border-t border-border bg-background xl:w-[420px] xl:border-l xl:border-t-0">
          <RailHeader
            title="ConnectAgent"
            subtitle="Private to you in this meeting"
            icon={<PanelRight className="h-4 w-4" />}
            live={controller.live}
            onReset={controller.reset}
          />
          <RailBody controller={controller} surface="meetings" />
        </aside>
      </div>
      <CitationPanel panel={controller.panel} onClose={controller.closePanel} />
    </section>
  );
}

function DocsMeetingTopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-[15px] font-semibold tracking-tight">ConnectWork</span>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-medium">
            Docs architecture review - RAG fidelity
          </h2>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--muted-fg)]">
            <span className="inline-flex items-center gap-1 text-[var(--danger)]">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[var(--danger)]" />
              Live
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              00:42:18
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[var(--secondary-text)] sm:inline-flex">
          Screen sharing
        </span>
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-md bg-[var(--danger)] px-3 text-[13px] font-medium text-white hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
        >
          Leave
        </button>
      </div>
    </header>
  );
}

function DocsParticipantRail() {
  return (
    <div className="flex gap-3 px-6 pt-5">
      {DOCS_MEETING_PARTICIPANTS.map((participant) => (
        <div
          key={participant.initials}
          className={[
            "flex min-w-0 flex-1 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-shadow",
            participant.speaking
              ? "border-primary/40 ring-2 ring-[var(--primary-tint)]"
              : "border-border",
          ].join(" ")}
        >
          <div className="relative shrink-0">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--canvas)] text-[12px] font-semibold text-[var(--secondary-text)]">
              {participant.initials}
            </div>
            {participant.speaking && (
              <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-white shadow-card">
                <MessageCircle className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-foreground">
              {participant.name}
            </div>
            <div className="truncate text-[11px] text-[var(--muted-fg)]">{participant.role}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DocsMeetingDocument() {
  return (
    <div className="flex min-h-0 flex-1 px-6 pb-6 pt-5">
      <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-[var(--primary-tint)] text-primary">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">
                Docs RAG fidelity build sheet
              </div>
              <div className="text-[11px] text-[var(--muted-fg)]">
                Shared by Product Docs - updated 8 min ago
              </div>
            </div>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--info-bg)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--info)]">
              <ShieldCheck className="h-3 w-3" />
              Governed
            </span>
          </div>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-[var(--secondary-text)]">
            Viewer
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--canvas)] p-8">
          <article className="mx-auto max-w-2xl rounded-md bg-white p-10 text-[13.5px] leading-relaxed text-foreground shadow-card">
            <header className="border-b border-border pb-4">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-fg)]">
                Product documentation
              </div>
              <h3 className="mt-1 text-[18px] font-semibold tracking-tight">
                Permission-aware docs answers
              </h3>
              <div className="mt-1 text-[11.5px] text-[var(--muted-fg)]">
                Review notes for chat, meetings, and decision-brief surfaces
              </div>
            </header>

            <section className="mt-5 space-y-3.5">
              <p>
                <span className="font-semibold">Goal. </span>
                The docs assistant should answer from permitted documentation, cite section-level
                anchors, and name missing coverage instead of filling gaps.
              </p>
              <p>
                <span className="font-semibold">Access behavior. </span>
                Open sources can show snippets and deep links. Sealed sources can contribute only a
                cleared derivative. Locked sources can show revealable metadata but no source text.
              </p>
              <p>
                <span className="font-semibold">Surface behavior. </span>
                Chat answers stay private until shared. Meeting answers stay private in the rail.
                Decision-brief generation keeps confidence, missing, and citation-anchor slots ready
                for the live backend.
              </p>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}

function DecisionBriefSurface({ controller }: { controller: SurfaceController }) {
  const lastTurn = controller.turns[controller.turns.length - 1];

  return (
    <section className="flex h-[780px] min-h-[700px] overflow-hidden bg-[var(--canvas)] text-foreground">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h2 className="truncate text-[15px] font-semibold">Decision Brief Draft</h2>
            </div>
            <p className="mt-0.5 text-[11.5px] text-[var(--secondary-text)]">
              Generated from docs-grounded answers with source chips inside the draft.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AppModeBadge live={controller.live} />
            <button
              type="button"
              onClick={() =>
                controller.submitDocs("Generate Decision Brief from docs RAG", "tier1Open")
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-[var(--primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate Decision Brief
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <DecisionDraft
            turn={lastTurn}
            pending={controller.pending}
            loadingStep={controller.loadingStep}
            onCitationClick={controller.openCitation}
          />
        </div>
      </main>

      <aside className="flex w-[400px] shrink-0 flex-col border-l border-border bg-background">
        <RailHeader
          title="Command rail"
          subtitle="Draft commands and docs questions"
          icon={<PenLine className="h-4 w-4" />}
          live={controller.live}
          onReset={controller.reset}
        />
        <RailBody
          controller={controller}
          surface="decision_brief"
          leadingAction={
            <button
              type="button"
              onClick={() =>
                controller.submitDocs("Generate Decision Brief from docs RAG", "tier1Open")
              }
              className="mb-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-white hover:bg-[var(--primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <FileCheck2 className="h-4 w-4" />
              Generate Decision Brief
            </button>
          }
        />
      </aside>

      <CitationPanel panel={controller.panel} onClose={controller.closePanel} />
    </section>
  );
}

function RailHeader({
  title,
  subtitle,
  icon,
  live,
  onReset,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  live: boolean;
  onReset: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-ai text-white">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold leading-tight">{title}</div>
            <div className="mt-0.5 text-[12px] leading-snug text-[var(--secondary-text)]">
              {subtitle}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--muted-fg)] hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Reset ConnectAgent rail"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--info)]">
          <Shield className="h-3 w-3" />
          Governed
        </span>
        <AppModeBadge live={live} />
      </div>
    </header>
  );
}

function RailBody({
  controller,
  surface,
  leadingAction,
}: {
  controller: SurfaceController;
  surface: DocsSurface;
  leadingAction?: ReactNode;
}) {
  const copy = SURFACE_COPY[surface];

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {leadingAction}
        {controller.turns.length === 0 && !controller.pending && (
          <EmptySurface
            surface={surface}
            onPick={(example) => controller.submitDocs(example.label, example.key)}
            compact
          />
        )}

        <div className="space-y-3">
          {controller.turns.map((turn, index) => (
            <RailTurn
              key={`${turn.prompt}-${index}`}
              turn={turn}
              surface={surface}
              onCitationClick={controller.openCitation}
              onRetry={controller.retry}
              onAsk={controller.submitDocs}
            />
          ))}
          {controller.pending && <LoadingCard step={controller.loadingStep} compact />}
        </div>
      </div>
      <div className="shrink-0 border-t border-border bg-card px-4 py-3">
        <AgentComposer
          placeholder={copy.placeholder}
          pending={controller.pending}
          onSubmit={controller.submitDocs}
          compact
        />
      </div>
    </>
  );
}

function ChannelMessage({
  author,
  meta,
  body,
  tone,
}: {
  author: string;
  meta: string;
  body: string;
  tone: "team" | "user";
}) {
  return (
    <div className="flex gap-3">
      <div
        className={[
          "grid h-9 w-9 shrink-0 place-items-center rounded-md text-[12px] font-semibold",
          tone === "user"
            ? "bg-[var(--primary-tint)] text-primary"
            : "bg-card text-[var(--secondary-text)]",
        ].join(" ")}
      >
        {author.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2.5 shadow-card">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold">{author}</span>
          <span className="text-[11px] text-[var(--muted-fg)]">{meta}</span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--secondary-text)]">{body}</p>
      </div>
    </div>
  );
}

function ChatTurn({
  turn,
  index,
  shared,
  onShare,
  onCitationClick,
  onRetry,
  onAsk,
}: {
  turn: DocsTurn;
  index: number;
  shared: boolean;
  onShare: () => void;
  onCitationClick: (citation: DocsCitation) => void;
  onRetry: () => void;
  onAsk: (text: string, forcedKey?: DocsChatMockKey) => void;
}) {
  return (
    <div className="space-y-3 animate-plan-in">
      <ChannelMessage author="You" meta="Just now" tone="user" body={turn.prompt} />
      <div className="flex gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-ai text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 rounded-lg border border-border bg-background shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold">ConnectAgent</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--info)]">
                <Lock className="h-3 w-3" />
                Private to you
              </span>
            </div>
            {turn.response.status === "answered" && (
              <button
                type="button"
                onClick={onShare}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-[11.5px] font-semibold text-foreground hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`Share answer ${index + 1} to channel`}
              >
                {shared ? <Check className="h-3 w-3" /> : <MessageSquareShare className="h-3 w-3" />}
                {shared ? "Shared" : "Share to channel"}
              </button>
            )}
          </div>
          <div className="p-3">
            <ResponseCard
              response={turn.response}
              onCitationClick={onCitationClick}
              onRetry={onRetry}
              onAsk={onAsk}
            />
          </div>
        </div>
      </div>
      {shared && (
        <div className="ml-12 rounded-md border border-[var(--success)]/20 bg-[var(--success-bg)] px-3 py-2 text-[12px] font-medium text-[var(--success)]">
          Shared safe answer to the channel. Restricted snippets remain excluded.
        </div>
      )}
    </div>
  );
}

function RailTurn({
  turn,
  surface,
  onCitationClick,
  onRetry,
  onAsk,
}: {
  turn: DocsTurn;
  surface: DocsSurface;
  onCitationClick: (citation: DocsCitation) => void;
  onRetry: () => void;
  onAsk: (text: string, forcedKey?: DocsChatMockKey) => void;
}) {
  return (
    <article className="rounded-lg border border-border bg-card shadow-card">
      <div className="border-b border-border px-3 py-2">
        <div className="text-[11px] font-medium text-[var(--muted-fg)]">You asked</div>
        <p className="mt-0.5 text-[12.5px] leading-snug">{turn.prompt}</p>
      </div>
      <div className="p-3">
        {surface === "meetings" && (
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-[var(--info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--info)]">
            <Users className="h-3 w-3" />
            Private to asker
          </div>
        )}
        <ResponseCard
          response={turn.response}
          onCitationClick={onCitationClick}
          onRetry={onRetry}
          onAsk={onAsk}
          compact
          decisionStub={surface === "decision_brief"}
        />
      </div>
    </article>
  );
}

function ResponseCard({
  response,
  onCitationClick,
  onRetry,
  onAsk,
  compact = false,
  decisionStub = false,
}: {
  response: DocsChatResponse;
  onCitationClick: (citation: DocsCitation) => void;
  onRetry: () => void;
  onAsk: (text: string, forcedKey?: DocsChatMockKey) => void;
  compact?: boolean;
  decisionStub?: boolean;
}) {
  const locked = response.citations.some((citation) => citation.access === "locked");
  const sealed = response.citations.some((citation) => citation.access === "sealed");

  return (
    <div className="space-y-3">
      <ResponseStatus status={response.status} locked={locked} sealed={sealed} />
      <p
        className={[
          "leading-relaxed text-foreground",
          compact ? "text-[12.5px]" : "text-[13.5px]",
        ].join(" ")}
      >
        {response.response}
      </p>

      {response.status === "answered" && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {response.citations.map((citation) => (
              <CitationChip
                key={`${citation.doc_id}-${citation.anchor ?? "none"}`}
                citation={citation}
                onClick={() => onCitationClick(citation)}
              />
            ))}
          </div>
          <StructuredSlots response={response} compact={compact} decisionStub={decisionStub} />
        </>
      )}

      {response.status !== "answered" && (
        <RecoveryActions status={response.status} onRetry={onRetry} onAsk={onAsk} />
      )}

      {response.suggested_questions && response.suggested_questions.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
            Suggested follow-ups
          </div>
          <div className="flex flex-wrap gap-1.5">
            {response.suggested_questions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onAsk(question)}
                className="min-h-7 rounded-md border border-border bg-card px-2 py-1 text-left text-[11.5px] font-medium text-[var(--secondary-text)] hover:border-primary/30 hover:bg-[var(--primary-tint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResponseStatus({
  status,
  locked,
  sealed,
}: {
  status: DocsChatResponse["status"];
  locked: boolean;
  sealed: boolean;
}) {
  if (status === "no_results") {
    return (
      <StateBanner
        icon={<Search className="h-3.5 w-3.5" />}
        tone="warning"
        label="No matching docs result"
      />
    );
  }
  if (status === "error") {
    return (
      <StateBanner
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        tone="danger"
        label="Docs RAG service error"
      />
    );
  }
  if (locked) {
    return (
      <StateBanner
        icon={<Lock className="h-3.5 w-3.5" />}
        tone="danger"
        label="Locked source found - no snippet shown"
      />
    );
  }
  if (sealed) {
    return (
      <StateBanner
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        tone="warning"
        label="Sealed source - cleared derivative only"
      />
    );
  }
  return (
    <StateBanner
      icon={<ShieldCheck className="h-3.5 w-3.5" />}
      tone="success"
      label="Grounded answer"
    />
  );
}

function StateBanner({
  icon,
  tone,
  label,
}: {
  icon: ReactNode;
  tone: "success" | "warning" | "danger";
  label: string;
}) {
  const cls =
    tone === "success"
      ? "bg-[var(--success-bg)] text-[var(--success)]"
      : tone === "warning"
        ? "bg-[var(--warning-bg)] text-[var(--warning)]"
        : "bg-[var(--danger-bg)] text-[var(--danger)]";
  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {icon}
      {label}
    </div>
  );
}

function StructuredSlots({
  response,
  compact,
  decisionStub,
}: {
  response: DocsChatResponse;
  compact: boolean;
  decisionStub: boolean;
}) {
  const confidence = CONFIDENCE_META[response.confidence];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-md border border-border bg-[var(--canvas)] px-3 py-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
          Confidence
        </div>
        <div
          className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${confidence.className}`}
        >
          {decisionStub ? <ReservedSlotValue /> : confidence.label}
        </div>
      </div>
      <div className="rounded-md border border-border bg-[var(--canvas)] px-3 py-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
          Missing
        </div>
        {decisionStub ? (
          <ReservedSlotBlock />
        ) : response.missing.length > 0 ? (
          <ul className="mt-1 space-y-1 text-[11.5px] text-[var(--secondary-text)]">
            {response.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <div className="mt-1 text-[11.5px] text-[var(--muted-fg)]">
            No missing coverage reported.
          </div>
        )}
      </div>
      <div className="rounded-md border border-border bg-[var(--canvas)] px-3 py-2 sm:col-span-2">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
          Anchors
        </div>
        <div
          className={[
            "mt-1 flex flex-wrap gap-1.5 text-[11.5px]",
            compact ? "leading-tight" : "leading-snug",
          ].join(" ")}
        >
          {response.citations.length > 0 ? (
            response.citations.map((citation) => (
              <span
                key={`${citation.doc_id}-anchor`}
                className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--secondary-text)]"
              >
                {citationHref(citation) ?? citation.anchor ?? "no-route"}
              </span>
            ))
          ) : (
            <span className="text-[var(--muted-fg)]">No anchored citations.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ReservedSlotValue() {
  return <span aria-label="Reserved structured field" className="block h-3 w-12" />;
}

function ReservedSlotBlock() {
  return <div aria-label="Reserved structured field" className="mt-1 h-5 rounded-sm bg-card" />;
}

function RecoveryActions({
  status,
  onRetry,
  onAsk,
}: {
  status: DocsChatResponse["status"];
  onRetry: () => void;
  onAsk: (text: string, forcedKey?: DocsChatMockKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12px] font-semibold hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
      <a
        href="/developers/rag"
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--primary-tint)] px-3 text-[12px] font-semibold text-primary hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Static docs fallback
      </a>
      {status === "no_results" && (
        <button
          type="button"
          onClick={() => onAsk("How does permission-aware RAG work?", "tier1Open")}
          className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-[12px] font-semibold hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Ask a nearby topic
        </button>
      )}
    </div>
  );
}

function CitationChip({
  citation,
  onClick,
  compact = false,
}: {
  citation: DocsCitation;
  onClick: () => void;
  compact?: boolean;
}) {
  const href = citation.access === "open" ? citationHref(citation) : null;
  const Icon =
    citation.access === "locked" ? Lock : citation.access === "sealed" ? ShieldCheck : FileText;
  const cls =
    citation.access === "locked"
      ? "border-[var(--danger)]/20 bg-[var(--danger-bg)] text-[var(--danger)]"
      : citation.access === "sealed"
        ? "border-[var(--warning)]/25 bg-[var(--warning-bg)] text-[var(--warning)]"
        : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-[var(--primary-tint)]";
  const label =
    citation.access === "locked"
      ? "Locked"
      : citation.access === "sealed"
        ? "Sealed"
        : citation.anchor
          ? "Anchor"
          : "Source";
  const title = citation.title ?? "Restricted source";
  const baseClass = [
    "inline-flex max-w-full items-center gap-1.5 rounded-md border font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    compact ? "min-h-6 px-1.5 py-0.5 text-[10.5px]" : "min-h-7 px-2 py-1 text-[11.5px]",
    cls,
  ].join(" ");

  const content = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{title}</span>
      <span className="shrink-0 text-[10px] font-bold uppercase">{label}</span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={baseClass} aria-label={`Open citation ${title}`}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClass}>
      {content}
    </button>
  );
}

function CitationPanel({ panel, onClose }: { panel: PanelState; onClose: () => void }) {
  if (!panel) return null;

  const details = CITATION_DETAILS[panel.citation.doc_id] ?? {
    owner: "Document owner",
    requestAccessTo: "owner@connectwork.example",
  };
  const title = panel.citation.title ?? "Restricted source";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4">
      <aside
        className="max-h-[86vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-card shadow-panel"
        aria-modal="true"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
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
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[var(--muted-fg)] hover:bg-[var(--canvas)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close citation panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 text-[13px] leading-relaxed text-[var(--secondary-text)]">
          {panel.kind === "sealed" && (
            <p>
              Only the cleared derivative is shown. Raw sealed source content remains unavailable
              at this access level.
            </p>
          )}

          {panel.kind === "locked" && (
            <p>
              You do not have access to this document. ConnectAgent can identify revealable
              metadata, but it cannot show a snippet or summarize the source body.
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

function LoadingCard({ step, compact = false }: { step: number; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-card">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ConnectAgent is checking the docs
      </div>
      <ol className="mt-3 space-y-2">
        {LOADING_STEPS.map((label, index) => {
          const active = index === step;
          const done = index < step;
          return (
            <li
              key={label}
              className={[
                "flex items-center gap-2",
                compact ? "text-[11.5px]" : "text-[12.5px]",
                done || active ? "text-foreground" : "text-[var(--muted-fg)]",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px]",
                  done
                    ? "border-[var(--success)] bg-[var(--success-bg)] text-[var(--success)]"
                    : active
                      ? "border-primary bg-[var(--primary-tint)] text-primary"
                      : "border-border bg-background text-[var(--muted-fg)]",
                ].join(" ")}
              >
                {done ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function EmptySurface({
  surface,
  onPick,
  compact = false,
}: {
  surface: DocsSurface;
  onPick: (example: ExamplePrompt) => void;
  compact?: boolean;
}) {
  const copy = SURFACE_COPY[surface];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-ai text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold leading-tight">{copy.emptyTitle}</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--secondary-text)]">
            {copy.emptyBody}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <ExampleList onPick={onPick} compact={compact} />
      </div>
    </div>
  );
}

function ExampleList({
  onPick,
  compact = false,
}: {
  onPick: (example: ExamplePrompt) => void;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-2">
      {EXAMPLES.map((example) => (
        <button
          key={example.key}
          type="button"
          onClick={() => onPick(example)}
          className={[
            "rounded-md border border-border bg-background text-left leading-snug transition-colors hover:border-primary/30 hover:bg-[var(--primary-tint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            compact ? "px-2.5 py-2 text-[11.5px]" : "px-3 py-2.5 text-[12.5px]",
          ].join(" ")}
        >
          <span className="block font-semibold text-foreground">{example.label}</span>
          <span className="mt-0.5 block text-[11.5px] text-[var(--secondary-text)]">
            {example.description}
          </span>
        </button>
      ))}
    </div>
  );
}

function AgentComposer({
  placeholder,
  pending,
  onSubmit,
  compact,
}: {
  placeholder: string;
  pending: boolean;
  onSubmit: (text: string, forcedKey?: DocsChatMockKey) => void;
  compact: boolean;
}) {
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function send() {
    const clean = value.trim();
    if (!clean) return;
    onSubmit(clean);
    setValue("");
    setMenuOpen(false);
  }

  return (
    <div className="relative">
      {menuOpen && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-2 w-full overflow-hidden rounded-lg border border-border bg-card shadow-panel"
        >
          {EXAMPLES.slice(0, 4).map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                onSubmit(item.label, item.key);
                setValue("");
                setMenuOpen(false);
              }}
              className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-[var(--canvas)] focus:bg-[var(--canvas)] focus:outline-none"
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

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-background text-primary hover:bg-[var(--primary-tint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Open @Agent menu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <AtSign className="h-4 w-4" />
        </button>
        <textarea
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            setValue(next);
            if (next.endsWith("@") || next.toLowerCase().includes("@agent")) setMenuOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          rows={compact ? 2 : 1}
          placeholder={placeholder}
          className={[
            "min-h-9 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 leading-snug text-foreground placeholder:text-[var(--muted-fg)] focus:outline-none focus:ring-2 focus:ring-primary",
            compact ? "text-[12.5px]" : "text-[13px]",
          ].join(" ")}
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || value.trim().length === 0}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Send docs question"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DecisionDraft({
  turn,
  pending,
  loadingStep,
  onCitationClick,
}: {
  turn?: DocsTurn;
  pending: boolean;
  loadingStep: number;
  onCitationClick: (citation: DocsCitation) => void;
}) {
  const response = turn?.response;

  return (
    <article className="mx-auto min-h-full max-w-3xl rounded-lg border border-border bg-card p-8 shadow-card">
      <header className="border-b border-border pb-5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-fg)]">
          Governed draft
        </div>
        <h3 className="mt-1 text-[22px] font-semibold tracking-tight">Docs-RAG Decision Brief</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--secondary-text)]">
          Draft canvas for turning grounded documentation into a governed work product. The full
          structured brief output stays stubbed until live confidence and coverage scoring land.
        </p>
      </header>

      <div className="mt-6 space-y-5">
        {!response && !pending && (
          <DraftPlaceholder
            title="Ready for generation"
            body="Use Generate Decision Brief or ask from the rail. Citation, confidence, missing, and anchor slots are already present for the live cutover."
          />
        )}

        {pending && (
          <div className="space-y-4">
            <LoadingCard step={loadingStep} />
            <DraftPlaceholder
              title="Preparing draft sections"
              body="The rail is checking permissions, searching docs, and validating citations before writing the draft."
            />
          </div>
        )}

        {response && (
          <>
            <section className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-fg)]">
                Summary
              </div>
              <p className="text-[14px] leading-relaxed text-foreground">{response.response}</p>
              {response.citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {response.citations.map((citation) => (
                    <CitationChip
                      key={`${citation.doc_id}-draft`}
                      citation={citation}
                      onClick={() => onCitationClick(citation)}
                      compact
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <DraftSlot
                label="Confidence slot"
                reserved={response.status === "answered"}
                value={response.status === "answered" ? undefined : "No draft confidence"}
              />
              <DraftSlot
                label="Missing slot"
                reserved={response.status === "answered"}
                value={response.status === "answered" ? undefined : "No draft coverage"}
              />
            </section>

            <section className="rounded-md border border-border bg-[var(--canvas)] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-fg)]">
                Draft notes
              </div>
              <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-[var(--secondary-text)]">
                <li>Open citations deep-link to docs anchors.</li>
                <li>Sealed citations can contribute only cleared derivative language.</li>
                <li>Locked citations stay outside the draft body and never show snippets.</li>
              </ul>
            </section>
          </>
        )}
      </div>
    </article>
  );
}

function DraftPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-lg border border-dashed border-border bg-[var(--canvas)] p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--primary-tint)] text-primary">
          <ClipboardList className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[14px] font-semibold">{title}</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--secondary-text)]">{body}</p>
        </div>
      </div>
    </section>
  );
}

function DraftSlot({
  label,
  value,
  reserved = false,
}: {
  label: string;
  value?: string;
  reserved?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-[var(--canvas)] px-3 py-2">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-fg)]">
        {label}
      </div>
      {reserved ? (
        <ReservedSlotBlock />
      ) : (
        <div className="mt-1 text-[12px] text-[var(--secondary-text)]">{value}</div>
      )}
    </div>
  );
}

function InfoRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { TopBar } from "@/components/meeting/TopBar";
import { ParticipantRail } from "@/components/meeting/ParticipantRail";
import { SharedDocViewer } from "@/components/meeting/SharedDocViewer";
import { AgentPanel } from "@/components/agent/AgentPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ConnectWork — Acme renewal pre-committee" },
      {
        name: "description",
        content:
          "Live enterprise meeting with the governed ConnectAgent — turn discussion into decision-ready briefs.",
      },
      { property: "og:title", content: "ConnectWork — ConnectAgent" },
      {
        property: "og:description",
        content: "Live enterprise meeting with the governed ConnectAgent.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [isWide, setIsWide] = useState(true);
  const [briefRequestId, setBriefRequestId] = useState(0);
  const briefRequestSeq = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1100px)");
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const requestBrief = useCallback(() => {
    setPanelOpen(true);
    briefRequestSeq.current += 1;
    setBriefRequestId(briefRequestSeq.current);
  }, []);
  const handleBriefRequestHandled = useCallback(() => setBriefRequestId(0), []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--canvas)] text-foreground">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col bg-[var(--canvas)]">
          <ParticipantRail />
          <SharedDocViewer onGenerateBrief={requestBrief} />
        </main>

        {isWide ? (
          <div className="w-[400px] shrink-0">
            <AgentPanel
              briefRequestId={briefRequestId}
              onBriefRequestHandled={handleBriefRequestHandled}
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-gradient-ai px-4 py-3 text-[13px] font-semibold text-white shadow-panel"
            >
              <Sparkles className="h-4 w-4" />
              Chat
            </button>
            {panelOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                  onClick={() => setPanelOpen(false)}
                />
                <div className="fixed inset-y-0 right-0 z-50 flex w-[400px] max-w-[92vw] flex-col">
                  <button
                    type="button"
                    onClick={() => setPanelOpen(false)}
                    className="absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-md text-[var(--muted-fg)] hover:bg-[var(--canvas)]"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <AgentPanel
                    briefRequestId={briefRequestId}
                    onBriefRequestHandled={handleBriefRequestHandled}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

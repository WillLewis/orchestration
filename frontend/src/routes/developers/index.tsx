import { createFileRoute } from "@tanstack/react-router";
import { OverviewDocsPage } from "./overview";

export const Route = createFileRoute("/developers/")({
  head: () => ({
    meta: [
      { title: "Overview" },
      {
        name: "description",
        content:
          "Executive summary: turning the Conversational Insights Agent into a single governed agent that closes the loop, with finance as the initial wedge.",
      },
    ],
  }),
  component: DevelopersIndex,
});

function DevelopersIndex() {
  return <OverviewDocsPage />;
}

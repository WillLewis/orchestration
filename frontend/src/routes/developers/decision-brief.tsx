import { createFileRoute } from "@tanstack/react-router";

import { DeveloperDocPage } from "@/components/docs/DeveloperDocPage";
import { getDeveloperDocHead } from "@/data/developerDocMeta";

export const Route = createFileRoute("/developers/decision-brief")({
  head: () => getDeveloperDocHead("decisionBrief"),
  component: () => <DeveloperDocPage pageId="decisionBrief" />,
});

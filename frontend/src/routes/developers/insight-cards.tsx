import { createFileRoute } from "@tanstack/react-router";

import { DeveloperDocPage } from "@/components/docs/DeveloperDocPage";
import { getDeveloperDocHead } from "@/data/developerDocMeta";

export const Route = createFileRoute("/developers/insight-cards")({
  head: () => getDeveloperDocHead("insightCards"),
  component: () => <DeveloperDocPage pageId="insightCards" />,
});

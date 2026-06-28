import { createFileRoute } from "@tanstack/react-router";

import { DeveloperDocPage } from "@/components/docs/DeveloperDocPage";
import { getDeveloperDocHead } from "@/data/developerDocMeta";

export const Route = createFileRoute("/developers/lifecycle-events")({
  head: () => getDeveloperDocHead("lifecycleEvents"),
  component: () => <DeveloperDocPage pageId="lifecycleEvents" />,
});

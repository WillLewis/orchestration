import { createFileRoute } from "@tanstack/react-router";

import { DeveloperDocPage } from "@/components/docs/DeveloperDocPage";
import { getDeveloperDocHead } from "@/data/developerDocMeta";

export const Route = createFileRoute("/developers/eval-trace")({
  head: () => getDeveloperDocHead("evalTrace"),
  component: () => <DeveloperDocPage pageId="evalTrace" />,
});

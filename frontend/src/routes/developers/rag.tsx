import { createFileRoute } from "@tanstack/react-router";

import { DeveloperDocPage } from "@/components/docs/DeveloperDocPage";
import { getDeveloperDocHead } from "@/data/developerDocMeta";

export const Route = createFileRoute("/developers/rag")({
  head: () => getDeveloperDocHead("rag"),
  component: () => <DeveloperDocPage pageId="rag" />,
});

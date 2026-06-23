import { createFileRoute } from "@tanstack/react-router";

import { DeveloperDocPage } from "@/components/docs/DeveloperDocPage";
import { getDeveloperDocHead } from "@/data/developerDocMeta";

export const Route = createFileRoute("/developers/risks")({
  head: () => getDeveloperDocHead("risks"),
  component: () => <DeveloperDocPage pageId="risks" />,
});

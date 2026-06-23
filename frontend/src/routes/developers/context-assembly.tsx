import { createFileRoute } from "@tanstack/react-router";

import { DeveloperDocPage } from "@/components/docs/DeveloperDocPage";
import { getDeveloperDocHead } from "@/data/developerDocMeta";

export const Route = createFileRoute("/developers/context-assembly")({
  head: () => getDeveloperDocHead("contextAssembly"),
  component: () => <DeveloperDocPage pageId="contextAssembly" />,
});

import { createFileRoute } from "@tanstack/react-router";

import { DeveloperDocPage } from "@/components/docs/DeveloperDocPage";
import { getDeveloperDocHead } from "@/data/developerDocMeta";

export const Route = createFileRoute("/developers/work-product-contract")({
  head: () => getDeveloperDocHead("workProductContract"),
  component: () => <DeveloperDocPage pageId="workProductContract" />,
});

import { createFileRoute } from "@tanstack/react-router";

import { DeveloperDocPage } from "@/components/docs/DeveloperDocPage";
import { getDeveloperDocHead } from "@/data/developerDocMeta";

export const Route = createFileRoute("/developers/compliance-trace")({
  head: () => getDeveloperDocHead("complianceTrace"),
  component: () => <DeveloperDocPage pageId="complianceTrace" />,
});

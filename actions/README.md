# actions/ — WS-E (Codex engine + Claude loop)
Safe Action Composer + controlled work loop. ToolCard registry, ActionDiff, DryRunExecutor,
ApprovalPolicy, AuditEvent, RollbackPlan (Codex). Distribute/collect/escalate/schedule loop
+ LLM personas for counterparties (Claude). Every write = diff + human approval. Mosaic +
injection gates wired here. DoD: `compose(brief, bundle)` -> `ActionPlan`; rollback + audit tested.

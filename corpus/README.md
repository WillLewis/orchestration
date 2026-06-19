# corpus/ — WS-A (Codex)
Synthetic regulated workspace. Owns ALL data generation. Conforms to `core.schemas`.
Build a fake bank (users, roles, ACLs, information barriers), the Acme renewal deal
(financials w/ versions, credit memo, covenant tracker, legal memo, pricing-exception
doc, transcripts, chat threads, tasks, workflow, authority matrix) + thin legal/health
stubs for the three-vertical proof. Do NOT edit `core/`. Extend `fixtures/` only via PR.
DoD: `corpus.load(vertical)` returns `list[WorkspaceObject]`; unit tests green.

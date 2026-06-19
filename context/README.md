# context/ — WS-B (Claude)
Permission-aware retrieval, SourceGraph, ContextBundle assembler, ClaimMap, citation
service, MissingEvidenceState/ConflictState detection. Implements `core.pipeline.ContextAssembler`.
Develop against `fixtures.acme` until WS-A lands. Permission filter runs BEFORE content
enters context. DoD: `assemble(user_id, intent)` returns a valid `ContextBundle`; tests green.

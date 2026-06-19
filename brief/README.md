# brief/ — WS-D (Claude)
LLM synthesis of the Decision Brief from a ContextBundle + DeterministicDecision.
Implements `core.pipeline.BriefSynthesizer`. The LLM drafts/interprets; it NEVER overrides
a deterministic gate. DoD: `synthesize(bundle, decision)` -> valid `DecisionBrief`; eval cases pass.

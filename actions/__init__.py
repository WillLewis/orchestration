"""WS-E — Safe Action Composer + controlled work loop.

Phase 1 (deterministic engine): ``engine`` + ``toolcards``. Phase 2 (LLM on top): ``composer``,
``personas``, ``loop``. The LLM proposes; the deterministic engine decides what is allowed and
executes — a model can never override a gate.
"""
from actions.composer import (
    ActionProposer,
    HeuristicActionProposer,
    LLMActionProposer,
    PlanSummary,
    SafeActionComposer,
    summarize_plan,
)
from actions.engine import (
    ActionValidationEngine,
    DryRunExecutor,
    WorkspaceExecutor,
    scan_injection,
    strip_injection,
)
from actions.loop import ControlledWorkLoop, LoopState, approve_nonblocked, run_acme_loop_demo
from actions.personas import (
    LLMPersonaClient,
    Persona,
    PersonaClient,
    PersonaReply,
    StubPersonaClient,
    default_personas,
)
from actions.toolcards import ToolCardRegistry, default_toolcards

__all__ = [
    "ActionProposer",
    "ActionValidationEngine",
    "ControlledWorkLoop",
    "DryRunExecutor",
    "HeuristicActionProposer",
    "LLMActionProposer",
    "LLMPersonaClient",
    "LoopState",
    "Persona",
    "PersonaClient",
    "PersonaReply",
    "PlanSummary",
    "SafeActionComposer",
    "StubPersonaClient",
    "ToolCardRegistry",
    "WorkspaceExecutor",
    "approve_nonblocked",
    "default_personas",
    "default_toolcards",
    "run_acme_loop_demo",
    "scan_injection",
    "strip_injection",
    "summarize_plan",
]

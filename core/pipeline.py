"""
core/pipeline.py — LOCKED STAGE INTERFACES (WS-0).

Each workstream implements the Protocol for its stage. Coding against these (plus
`fixtures/`) lets every stream develop in parallel and integrate without surprises.

Pipeline:  intent -> ContextAssembler -> Verifier -> BriefSynthesizer
                   -> ActionComposer -> (human approval) -> Executor -> EvalRunner
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from core.schemas import (
    ActionPlan,
    AuditEvent,
    ContextBundle,
    DecisionBrief,
    DeterministicDecision,
    EvalResult,
    StaleSectionState,
    WorkProductContract,
)


@runtime_checkable
class ContextAssembler(Protocol):
    """WS-B. Permission-aware; the permission filter MUST run before content is read."""
    def assemble(self, user_id: str, intent: str) -> ContextBundle: ...


@runtime_checkable
class Verifier(Protocol):
    """WS-C. Pure/deterministic. No LLM calls. Owns every pass/fail decision."""
    def verify(self, bundle: ContextBundle, rulepack_id: str) -> DeterministicDecision: ...


@runtime_checkable
class BriefSynthesizer(Protocol):
    """WS-D. LLM drafts/interprets; never overrides a deterministic gate."""
    def synthesize(self, bundle: ContextBundle, decision: DeterministicDecision) -> DecisionBrief: ...


@runtime_checkable
class ActionComposer(Protocol):
    """WS-E. Proposes typed actions as diffs; nothing executes without approval."""
    def compose(self, brief: DecisionBrief, bundle: ContextBundle) -> ActionPlan: ...


@runtime_checkable
class Executor(Protocol):
    """WS-E. Executes ONLY approved actions; returns an audit trail; supports rollback."""
    def execute(self, plan: ActionPlan, approved_indices: list[int]) -> list[AuditEvent]: ...


@runtime_checkable
class RevalidationEngine(Protocol):
    """WS-F. Reacts to source-change events; flags affected sections stale."""
    def revalidate(self, contract: WorkProductContract, changed_object_id: str) -> list[StaleSectionState]: ...


@runtime_checkable
class EvalRunner(Protocol):
    """WS-G. Runs an EvalPack and returns results; powers the three-vertical proof."""
    def run(self, pack_id: str) -> list[EvalResult]: ...

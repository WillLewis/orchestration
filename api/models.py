"""
api/models.py — API-layer request bodies + Agent Ops aggregate models.

Domain responses reuse `core.schemas` directly (`DecisionBrief`, `ContextBundle`,
`DeterministicDecision`, `ActionPlan`, `AuditEvent`, …) and `lifecycle.RevalidationResult`
for `/revalidate`. The only NEW models defined here are the HTTP request bodies and the
Agent Ops aggregate (`OpsReport`), which is shaped to `frontend/src/data/ops.ts`.

`OpsReport` composes already-typed workstream models — WS-I's `VerticalScore`/`EvalRow`
(the Agent-Ops shapes) and WS-G's `TelemetryEvent` — so the JSON the frontend consumes is
the same snake_case the mock mirrors, with no remapping.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from core.schemas import AgentRecipe, TelemetryEvent
from recipes.catalog import EvalRow, VerticalScore


# --------------------------------------------------------------------------- #
# Request bodies
# --------------------------------------------------------------------------- #
class BriefRequest(BaseModel):
    """Body for `/brief`, `/context`, `/verify`, `/actions/compose`."""

    user_id: str = "u_rm"
    intent: str = "prepare_decision_brief"


class ExecuteRequest(BaseModel):
    """Body for `/actions/execute`. The plan is composed server-side from `user_id`/`intent`;
    the client only submits the indices a human approved, so a forged/un-gated plan can never
    reach the executor."""

    user_id: str = "u_rm"
    intent: str = "prepare_decision_brief"
    approved_indices: list[int] = Field(default_factory=list)


class RevalidateRequest(BaseModel):
    """Body for `/revalidate`. `event` names a deterministic WS-A source-change event
    (e.g. `legal_needs_review`, `financials_v2`)."""

    user_id: str = "u_rm"
    intent: str = "prepare_decision_brief"
    changed_object_id: str = "wf_approval"
    event: str = "legal_needs_review"


# --------------------------------------------------------------------------- #
# Agent Ops aggregate (shape ↔ frontend/src/data/ops.ts)
# --------------------------------------------------------------------------- #
class EvalSourceMix(BaseModel):
    """Eval-data modality mix (§5 F5). Fractions sum to ~1.0 across the program."""

    synthetic: float = 0.0
    tenant_local: float = 0.0
    redacted: float = 0.0
    aggregate: float = 0.0


class FailureTaxonomyEntry(BaseModel):
    """One bar of the failure taxonomy: a category and how many cases fell into it."""

    category: str
    count: int = 0


class OpsReport(BaseModel):
    """The Agent Ops surface aggregate. Combines WS-I's three-vertical scorecard with WS-G
    telemetry, eval source mix, and failure taxonomy — shape-compatible with ops.ts."""

    vertical_scores: dict[str, VerticalScore]
    eval_rows: list[EvalRow]
    telemetry_sample: TelemetryEvent
    eval_source_mix: EvalSourceMix
    failure_taxonomy: list[FailureTaxonomyEntry]
    recipes: list[AgentRecipe] = Field(default_factory=list)
    overall_passed: bool = False

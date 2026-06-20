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

from typing import Literal

from pydantic import BaseModel, Field

from core.schemas import AgentRecipe, SourceRef, TelemetryEvent
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


class LoopRequest(BaseModel):
    """Body for `/actions/loop`. `approved_indices=None` uses the loop's default approval policy
    (`approve_nonblocked`); a provided list approves exactly those indices (blocked actions are
    still never executed)."""

    user_id: str = "u_rm"
    intent: str
    approved_indices: list[int] | None = None


# --------------------------------------------------------------------------- #
# Governed chat (POST /chat) — answers over the permission-filtered ContextBundle
# --------------------------------------------------------------------------- #
class ChatMessage(BaseModel):
    """One turn of prior conversation. UNTRUSTED: history is conversational context only and is
    never treated as evidence — it cannot introduce sources, claims, or override a gate."""

    role: Literal["user", "assistant", "system"] = "user"
    content: str = ""


class ChatRequest(BaseModel):
    """Body for `/chat`. `message` is the current (untrusted) question; `history` is prior turns
    (also untrusted). All factual grounding comes from the freshly-assembled ContextBundle."""

    user_id: str = "u_rm"
    intent: str
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """The governed answer. Prose may be model-drafted, but every field below is set by the API
    wrapper's deterministic post-processing — never by the model:

    * ``citations`` are validated against ``bundle.sources`` (hallucinated/excluded ids dropped);
    * ``permission_boundary_hit`` is derived from ``bundle.permission_boundary`` + the request;
    * ``gate_held`` reflects the deterministic decision (the model can't grant approval);
    * ``missing_evidence`` mirrors ``bundle.missing_evidence``.

    Keep this set MINIMAL — adding a field changes the wire contract the frontend consumes.
    """

    reply: str
    citations: list[SourceRef] = Field(default_factory=list)
    permission_boundary_hit: bool = False
    gate_held: bool = False
    missing_evidence: bool = False


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

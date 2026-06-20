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

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from core.schemas import AgentRecipe, DecisionBrief, SourceRef, StaleSectionState, TelemetryEvent
from lifecycle.revalidation import ReapprovalRoute
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


# --------------------------------------------------------------------------- #
# Governed record — seal + verify (POST /workproducts/*)
# --------------------------------------------------------------------------- #
class MintRecordRequest(BaseModel):
    """Body for `POST /workproducts/mint`."""

    user_id: str = "u_rm"
    intent: str = "prepare_decision_brief"


class VerifyRecordRequest(BaseModel):
    """Body for `POST /workproducts/{record_id}/verify`. `event` names a deterministic WS-A
    source-change event (e.g. `legal_needs_review`); `None` re-checks against unchanged sources."""

    event: Optional[str] = None


class RecordSeal(BaseModel):
    """The server-minted integrity seal. `value` is a keyed HMAC over the canonical content —
    unforgeable without the server key; `payload_hash` is a display-only content fingerprint.

    The HMAC is SYMMETRIC: this server verifies its own seal (proves the record is unaltered since
    it minted it). Independent third-party verification would require asymmetric signing."""

    payload_hash: str
    value: str
    kind: str = "Server-minted integrity seal"
    algorithm: str = "HMAC-SHA256 over canonical JSON"


class SourceVersionSnapshot(BaseModel):
    """A source object's version + metadata at mint time — the basis for staleness detection."""

    object_id: str
    title: str = ""
    type: str = ""
    version: int = 1
    metadata: dict = Field(default_factory=dict)


class PermissionOmission(BaseModel):
    """A source excluded from the record because the user lacked access at mint time."""

    object_id: str
    title: str = ""
    reason: str = "permission_restricted"


class RecordSource(BaseModel):
    """An evidence source the record was built from (permission-filtered)."""

    object_id: str
    title: str = ""
    type: str = ""
    status: Literal["used", "conflicting"] = "used"


class ChangedSource(BaseModel):
    """One source field that changed after the record was sealed. `before`/`after` are free-typed
    because event payloads carry strings, numbers, or nested values."""

    object_id: str
    title: str = ""
    field: str
    before: Any = None
    after: Any = None


class RecordVerification(BaseModel):
    """Result of re-checking a sealed record against current sources. THREE INDEPENDENT AXES:
    `integrity_valid` (HMAC seal matches), `freshness` (sealed sources changed?), and
    `approval_ready` (the deterministic gate — unchanged by verification)."""

    record_id: str
    integrity_valid: bool
    freshness: Literal["current", "stale"]
    approval_ready: bool
    verified_at: datetime
    changed_sources: list[ChangedSource] = Field(default_factory=list)
    stale_sections: list[StaleSectionState] = Field(default_factory=list)
    reapproval_routes: list[ReapprovalRoute] = Field(default_factory=list)


class GovernanceEnvelope(BaseModel):
    """The governance metadata wrapped around the decision — what makes the record *governed*
    rather than a static export. The `seal` is attached AFTER canonicalization (so it is never
    part of its own preimage)."""

    schema_name: str = "DecisionBrief"
    recipe_id: str = "finance_credit_committee"
    vertical: str = "finance"
    rulepack_id: str = "finance_credit_v1"
    rulepack_version: int = 1
    approval_ready: bool = False
    approval_stamp: str = "NOT APPROVAL-READY"
    approval_reason: str = ""
    path_to_ready: list[str] = Field(default_factory=list)
    permission_omissions: list[PermissionOmission] = Field(default_factory=list)
    source_versions: list[SourceVersionSnapshot] = Field(default_factory=list)
    loop_summary: Optional[dict] = None
    seal: Optional[RecordSeal] = None


class GovernedRecord(BaseModel):
    """The sealed governed record — a point-in-time, verifiable artifact of a decision packet.
    The product noun is 'governed record'; the frontend may title the page 'Governance Certificate'
    as a visual metaphor only."""

    record_id: str
    work_product_id: str
    title: str
    minted_by: str = "Dana R."
    minted_at: datetime
    decision_brief: DecisionBrief
    sources: list[RecordSource] = Field(default_factory=list)
    governance: GovernanceEnvelope
    verification: Optional[RecordVerification] = None


class MintResponse(BaseModel):
    """`POST /workproducts/mint` → the new record id + the full governed record."""

    record_id: str
    record: GovernedRecord

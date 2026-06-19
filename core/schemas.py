"""
core/schemas.py — LOCKED CONTRACTS (WS-0).

Every workstream develops against these typed primitives. Do NOT edit on a feature
branch; contract changes go through a WS-0 PR (see WORKSTREAMS.md) to prevent drift.

Stack: Python 3.11+, Pydantic v2. Export JSON Schema with `make schemas-json`
for the Lovable frontend (WS-H).
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #
class ObjectType(str, Enum):
    document = "document"
    meeting = "meeting"
    chat_thread = "chat_thread"
    task = "task"
    workflow = "workflow"
    user_profile = "user_profile"


class Sensitivity(str, Enum):
    public = "public"
    internal = "internal"
    restricted = "restricted"
    barrier = "barrier"  # information-barrier controlled


class SideEffectClass(str, Enum):
    read = "read"
    draft = "draft"
    propose = "propose"
    write = "write"


class RuleSeverity(str, Enum):
    block = "block"
    warn = "warn"
    info = "info"


Vertical = Literal["finance", "legal", "health"]


# --------------------------------------------------------------------------- #
# Permissions & workspace objects (WS-A produces, WS-B consumes)
# --------------------------------------------------------------------------- #
class ACL(BaseModel):
    readers: list[str] = []          # user/role ids
    editors: list[str] = []
    sensitivity: Sensitivity = Sensitivity.internal
    barrier_tags: list[str] = []     # e.g. ["public-side", "private-side"]


class WorkspaceObject(BaseModel):
    id: str
    type: ObjectType
    title: str
    acl: ACL = Field(default_factory=ACL)
    metadata: dict = {}
    version: int = 1
    updated_at: datetime = Field(default_factory=_now)
    content: Optional[str] = None    # body/transcript/etc — SYNTHETIC ONLY


# --------------------------------------------------------------------------- #
# Sources, claims, citations (WS-B)
# --------------------------------------------------------------------------- #
class SourceRef(BaseModel):
    object_id: str
    span: Optional[str] = None       # locator within the object


class Claim(BaseModel):
    id: str
    text: str
    supported: bool = False
    sources: list[SourceRef] = []


class ClaimMap(BaseModel):
    claims: list[Claim] = []


# --------------------------------------------------------------------------- #
# Context states + bundle (WS-B)
# --------------------------------------------------------------------------- #
class MissingEvidenceState(BaseModel):
    code: str                        # e.g. "missing_covenant_tracker"
    description: str
    blocking: bool = False


class ConflictState(BaseModel):
    description: str
    sources: list[SourceRef] = []


class PermissionBoundary(BaseModel):
    excluded_object_ids: list[str] = []
    reason: str = "permission_restricted"


class ContextBundle(BaseModel):
    user_id: str
    intent: str
    sources: list[SourceRef] = []
    claims: ClaimMap = Field(default_factory=ClaimMap)
    permission_boundary: PermissionBoundary = Field(default_factory=PermissionBoundary)
    missing_evidence: list[MissingEvidenceState] = []
    conflicts: list[ConflictState] = []


# --------------------------------------------------------------------------- #
# Deterministic verification (WS-C)
# --------------------------------------------------------------------------- #
class Rule(BaseModel):
    id: str
    description: str
    severity: RuleSeverity = RuleSeverity.block


class RulePack(BaseModel):
    id: str
    vertical: Vertical
    version: int = 1
    rules: list[Rule] = []


class RuleFiring(BaseModel):
    rule_id: str
    passed: bool
    detail: str = ""


class ApprovalRequirement(BaseModel):
    role: str
    present: bool = False


class ApprovalMatrix(BaseModel):
    requirements: list[ApprovalRequirement] = []


class CalculationCheck(BaseModel):
    name: str
    expected: float
    computed: float
    matches: bool


class DeterministicDecision(BaseModel):
    approval_ready: bool
    firings: list[RuleFiring] = []
    approvals: ApprovalMatrix = Field(default_factory=ApprovalMatrix)
    calculations: list[CalculationCheck] = []


class ComplianceTrace(BaseModel):
    decision: DeterministicDecision
    rulepack_id: str
    rulepack_version: int = 1


# --------------------------------------------------------------------------- #
# Decision Brief — the typed work product (WS-D)
# --------------------------------------------------------------------------- #
class DecisionBrief(BaseModel):
    decision_needed: str
    executive_summary: str = ""
    what_changed: list[str] = []
    key_facts: list[str] = []
    policy_gates: DeterministicDecision
    required_approvals: ApprovalMatrix = Field(default_factory=ApprovalMatrix)
    missing_evidence: list[MissingEvidenceState] = []
    conflicts: list[ConflictState] = []
    open_questions: list[str] = []
    next_steps: list[str] = []
    source_map: list[SourceRef] = []
    permission_limitations: list[str] = []
    confidence: Literal["low", "medium", "high"] = "medium"


# --------------------------------------------------------------------------- #
# Safe Action Composer + loop (WS-E)
# --------------------------------------------------------------------------- #
class ToolCard(BaseModel):
    name: str
    description: str
    side_effect: SideEffectClass
    input_schema: dict = {}
    requires_approver: Optional[str] = None


class ActionDiff(BaseModel):
    target_object_id: str
    before: dict = {}
    after: dict = {}


class Action(BaseModel):
    tool: str
    reason: str
    sources: list[SourceRef] = []
    diff: Optional[ActionDiff] = None
    required_approver: Optional[str] = None
    risk: Literal["low", "medium", "high"] = "low"
    side_effect: SideEffectClass = SideEffectClass.propose
    blocked_reason: Optional[str] = None   # e.g. missing-evidence / mosaic gate


class ActionPlan(BaseModel):
    actions: list[Action] = []


class AuditEvent(BaseModel):
    actor: str
    action: str
    timestamp: datetime = Field(default_factory=_now)
    detail: dict = {}


class RollbackPlan(BaseModel):
    action_index: int
    inverse: ActionDiff


# --------------------------------------------------------------------------- #
# Work-product lifecycle & revalidation (WS-F)
# --------------------------------------------------------------------------- #
class StaleSectionState(BaseModel):
    section: str
    stale: bool = False
    reason: str = ""


class WorkProductContract(BaseModel):
    id: str
    schema_name: str = "DecisionBrief"
    owners: list[str] = []
    source_dependencies: list[str] = []    # object ids
    revalidation_rules: list[str] = []
    stale_sections: list[StaleSectionState] = []


# --------------------------------------------------------------------------- #
# Eval + privacy telemetry (WS-G)
# --------------------------------------------------------------------------- #
class EvalCase(BaseModel):
    id: str
    vertical: Vertical
    prompt: str
    expected: dict = {}
    kind: Literal["synthetic", "tenant_local", "redacted", "regression"] = "synthetic"


class EvalPack(BaseModel):
    id: str
    vertical: Vertical
    cases: list[EvalCase] = []


class EvalTrace(BaseModel):
    case_id: str
    model: str
    source_types: list[str] = []
    tool_calls: list[str] = []
    rule_firings: list[RuleFiring] = []
    citation_coverage: float = 0.0
    claim_support: float = 0.0
    latency_ms: int = 0
    cost_usd: float = 0.0


class EvalResult(BaseModel):
    case_id: str
    passed: bool
    scores: dict = {}


class TelemetryEvent(BaseModel):
    """Privacy-preserving. Raw prompt/response/document/transcript content is FORBIDDEN
    by construction (`extra='forbid'`) — attempting to attach raw content raises."""

    model_config = {"extra": "forbid"}

    intent_class: str
    recipe_id: str
    source_type_counts: dict = {}
    tool_attempted: Optional[str] = None
    tool_success: Optional[bool] = None
    permission_denial_count: int = 0
    missing_evidence_code: Optional[str] = None
    schema_pass: Optional[bool] = None
    deterministic_rule_pass: Optional[bool] = None
    citation_coverage_score: Optional[float] = None
    claim_support_score: Optional[float] = None
    action_outcome: Optional[Literal["approved", "edited", "rejected"]] = None
    latency_bucket: Optional[str] = None
    cost_bucket: Optional[str] = None
    error_code: Optional[str] = None


# --------------------------------------------------------------------------- #
# Recipes — the platform-generalization mechanism (WS-I)
# --------------------------------------------------------------------------- #
class AgentRecipe(BaseModel):
    id: str
    vertical: Vertical
    allowed_sources: list[str] = []
    required_sections: list[str] = []
    rulepack_id: str
    allowed_actions: list[str] = []
    disallowed_actions: list[str] = []
    eval_pack_id: Optional[str] = None


__all__ = [n for n in dir() if n[0].isupper()]

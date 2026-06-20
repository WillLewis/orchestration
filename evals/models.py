"""
evals/models.py — eval-local models (WS-G).

These are NOT core contracts (they live in `evals/`, owned by WS-G); they are the
internal plumbing of the harness. The contract types they wrap/produce — `EvalTrace`,
`EvalResult`, `EvalCase` — live in `core.schemas`.

Privacy invariant (matches the WS-G non-negotiables): every model here carries only
typed, structural signals — object ids, codes, counts, scores, booleans — and NEVER
raw prompt/response/document/transcript content. `ScoringView` is the single source of
truth for scoring; both a live `CaseRun` and a replayed `ReplayRecord` project onto it,
which is what makes offline replay reproduce live scores exactly (see `evals/replay.py`).
"""
from __future__ import annotations

from pydantic import BaseModel, ValidationError

from core.schemas import (
    ActionPlan,
    AuditEvent,
    ContextBundle,
    DecisionBrief,
    DeterministicDecision,
    EvalCase,
    EvalTrace,
)


def _roundtrip_ok(model: BaseModel) -> bool:
    """True iff `model` re-validates from its own JSON dump (deterministic schema check)."""
    try:
        type(model).model_validate(model.model_dump(mode="json"))
        return True
    except ValidationError:
        return False


class ScoringView(BaseModel):
    """The minimal, privacy-safe projection every scorer reads.

    Derived once from typed pipeline outputs (live) or rehydrated from a persisted
    `ReplayRecord` — identical fields either way, so scores are path-independent.
    """

    case_id: str
    excluded_object_ids: list[str] = []      # permission boundary (denied content)
    source_object_ids: list[str] = []        # ids that reached the work product (source map)
    missing_evidence_codes: list[str] = []   # codes only — never descriptions
    conflict_count: int = 0
    approval_ready: bool = False
    failing_rule_ids: list[str] = []
    passing_rule_ids: list[str] = []
    citation_coverage: float = 0.0
    claim_support: float = 0.0
    schema_valid: bool = True


class CaseRun(BaseModel):
    """The full typed result of running one case through the (stub) pipeline.

    Transient/live only — never persisted (it transitively holds brief prose). Persist
    `ReplayRecord` instead, which is built from `trace` + `scoring_view()`.
    """

    case: EvalCase
    bundle: ContextBundle
    decision: DeterministicDecision
    brief: DecisionBrief
    plan: ActionPlan
    audit: list[AuditEvent] = []
    trace: EvalTrace

    def scoring_view(self) -> ScoringView:
        """Project the typed outputs onto the privacy-safe `ScoringView`."""
        firings = self.decision.firings
        sv = self.decision.schema_validation
        schema_valid = _roundtrip_ok(self.brief) and (sv.valid if sv is not None else True)
        return ScoringView(
            case_id=self.case.id,
            excluded_object_ids=list(self.bundle.permission_boundary.excluded_object_ids),
            source_object_ids=[s.object_id for s in self.brief.source_map],
            missing_evidence_codes=[m.code for m in self.brief.missing_evidence],
            conflict_count=len(self.brief.conflicts),
            approval_ready=self.decision.approval_ready,
            failing_rule_ids=[f.rule_id for f in firings if not f.passed],
            passing_rule_ids=[f.rule_id for f in firings if f.passed],
            citation_coverage=self.trace.citation_coverage,
            claim_support=self.trace.claim_support,
            schema_valid=schema_valid,
        )


class ScoredCase(BaseModel):
    """A case's per-scorer scores + the pass/fail verdict (verdict, not policy decision)."""

    case: EvalCase
    scores: dict[str, float] = {}
    thresholds: dict[str, float] = {}
    passed: bool = False

    def failures(self) -> list[str]:
        """Scorer names that fell below their threshold (drives the failure taxonomy)."""
        return [name for name, value in self.scores.items() if value < self.thresholds[name]]


class ReplayRecord(BaseModel):
    """A persisted, privacy-safe regression artifact: the telemetry trace + scoring view.

    JSON-serializable and content-free, so it doubles as the offline replay/regression
    set (the accept/edit/reject corpus that becomes a `RegressionSuite`).
    """

    trace: EvalTrace
    view: ScoringView

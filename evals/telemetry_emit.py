"""
evals/telemetry_emit.py — privacy-safe telemetry emitter + sink seam (WS-G).

Turns a `CaseRun` + `ScoringView` into the frozen, content-free `TelemetryEvent` (typed
signals, bucketed latency/cost, source-type COUNTS — never ids, prompts, responses,
documents, or transcripts) and, for failures, an opt-in `RedactedFailurePacket`. Both
contract models are `extra="forbid"`, so attaching raw content raises by construction.

This module ONLY maps + emits. The hardened privacy internals — client-side redaction,
k-anonymity aggregation thresholds, differential-privacy noise on aggregates — are Codex's
lane in `telemetry/`, and drop in behind the `TelemetrySink` Protocol below (e.g. a
`RedactingDPSink`). Do NOT implement DP/k-anonymity here.
"""
from __future__ import annotations

from typing import Optional, Protocol, runtime_checkable

from core.schemas import RedactedFailurePacket, TelemetryEvent

from .harness import source_type_counts
from .models import CaseRun, ScoredCase, ScoringView
from .taxonomy import primary_failure_code

# Coarse buckets. Boundaries are deliberately wide so aggregates can't fingerprint a row.
_LATENCY_BUCKETS: list[tuple[float, str]] = [
    (100, "lt_100ms"),
    (500, "100ms_500ms"),
    (2_000, "500ms_2s"),
    (10_000, "2s_10s"),
]
_COST_BUCKETS: list[tuple[float, str]] = [
    (0.01, "lt_1c"),
    (0.10, "1c_10c"),
    (1.00, "10c_1usd"),
]


def latency_bucket(latency_ms: int) -> str:
    for ceiling, label in _LATENCY_BUCKETS:
        if latency_ms < ceiling:
            return label
    return "gt_10s"


def cost_bucket(cost_usd: float) -> str:
    if cost_usd <= 0.0:
        return "zero"
    for ceiling, label in _COST_BUCKETS:
        if cost_usd < ceiling:
            return label
    return "gt_1usd"


@runtime_checkable
class TelemetrySink(Protocol):
    """Where privacy-safe events go. Codex's redaction/DP aggregator implements this."""

    def emit_event(self, event: TelemetryEvent) -> None: ...
    def emit_failure(self, packet: RedactedFailurePacket) -> None: ...


class NullSink:
    """Drops everything. The default in pure offline runs."""

    def emit_event(self, event: TelemetryEvent) -> None:  # noqa: D401 - trivial
        return None

    def emit_failure(self, packet: RedactedFailurePacket) -> None:
        return None


class InMemorySink:
    """Collects events/failures in memory for tests and the CLI summary."""

    def __init__(self) -> None:
        self.events: list[TelemetryEvent] = []
        self.failures: list[RedactedFailurePacket] = []

    def emit_event(self, event: TelemetryEvent) -> None:
        self.events.append(event)

    def emit_failure(self, packet: RedactedFailurePacket) -> None:
        self.failures.append(packet)


def build_event(
    run: CaseRun,
    view: ScoringView,
    *,
    recipe_id: str,
    intent_class: Optional[str] = None,
    action_outcome: Optional[str] = None,
    error_code: Optional[str] = None,
) -> TelemetryEvent:
    """Map a run to a `TelemetryEvent`. Only typed, bucketed, content-free signals.

    `intent_class` MUST be a controlled label (not the free-text prompt). We read it from
    `case.expected["intent_class"]`; `bundle.intent` is intentionally NOT emitted because the
    stub copies the raw prompt into it.
    """
    trace = run.trace
    intent = intent_class or str(run.case.expected.get("intent_class", "unspecified"))
    executed = any(e.action == "executed" for e in run.audit)
    tool_attempted = trace.tool_calls[0] if trace.tool_calls else None

    return TelemetryEvent(
        intent_class=intent,
        recipe_id=recipe_id,
        source_type_counts=source_type_counts(trace),
        tool_attempted=tool_attempted,
        tool_success=executed if tool_attempted is not None else None,
        permission_denial_count=len(view.excluded_object_ids),
        missing_evidence_code=(
            view.missing_evidence_codes[0] if view.missing_evidence_codes else None
        ),
        schema_pass=view.schema_valid,
        # Operational signal: did every deterministic rule pass? (Not an eval verdict.)
        deterministic_rule_pass=not view.failing_rule_ids,
        citation_coverage_score=trace.citation_coverage,
        claim_support_score=trace.claim_support,
        action_outcome=action_outcome,
        latency_bucket=latency_bucket(trace.latency_ms),
        cost_bucket=cost_bucket(trace.cost_usd),
        error_code=error_code,
    )


def build_failure_packet(
    run: CaseRun,
    view: ScoringView,
    scored: ScoredCase,
    *,
    recipe_id: str,
) -> RedactedFailurePacket:
    """Opt-in, customer-approved failure sample. Typed signals + rule firings only."""
    return RedactedFailurePacket(
        case_id=run.case.id,
        recipe_id=recipe_id,
        failure_reason_code=primary_failure_code(scored) or "unknown_failure",
        rule_firings=list(run.decision.firings),
        source_type_counts=source_type_counts(run.trace),
        schema_pass=view.schema_valid,
        citation_coverage_score=run.trace.citation_coverage,
        claim_support_score=run.trace.claim_support,
    )

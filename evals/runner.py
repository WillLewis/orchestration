"""
evals/runner.py — the EvalRunner (WS-G).

`EvalHarnessRunner` satisfies the locked `core.pipeline.EvalRunner` Protocol:
`run(pack_id) -> list[EvalResult]`. For each case it runs the (stub) pipeline via the
harness, projects a privacy-safe `ScoringView`, scores it, emits telemetry through the
`TelemetrySink` seam, optionally records a `ReplayRecord` and fans the redacted event out
to external exporters.

Defaults are fully offline and side-effect-free: `NullSink`, no recorder, no exporters.
Wire real ones (InMemory/recording sink, Braintrust/W&B) from the CLI. The runner MEASURES;
it never owns a pass/fail policy decision (that's WS-C).
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Optional

from core.schemas import EvalResult

from .harness import PipelineHarness, StubHarness
from .integrations import TraceExporter
from .models import CaseRun, ScoredCase, ScoringView
from .packs import get_pack
from .scorers import score_view
from .telemetry_emit import (
    NullSink,
    TelemetrySink,
    build_event,
    build_failure_packet,
)

# vertical → recipe id (the AgentRecipe that selects rulepack + eval pack per vertical).
_RECIPE_BY_VERTICAL: dict[str, str] = {
    "finance": "finance_credit_v1",
    "legal": "legal_review_v1",
    "health": "health_protocol_v1",
}


def default_recipe_for(case_vertical: str) -> str:
    return _RECIPE_BY_VERTICAL.get(case_vertical, f"{case_vertical}_v1")


# `recorder` is duck-typed (any object exposing `record(trace, view) -> None`, e.g.
# `evals.replay.ReplayRecorder`). Keeping it structural avoids a runner↔replay import cycle.


class EvalHarnessRunner:
    """Default `EvalRunner`. Offline, deterministic, privacy-preserving."""

    def __init__(
        self,
        harness: Optional[PipelineHarness] = None,
        sink: Optional[TelemetrySink] = None,
        recorder: object | None = None,
        exporters: Optional[list[TraceExporter]] = None,
        recipe_for: Optional[Callable[[str], str]] = None,
        emit_failures: bool = True,
    ) -> None:
        self.harness: PipelineHarness = harness or StubHarness()
        self.sink: TelemetrySink = sink or NullSink()
        self.recorder = recorder
        self.exporters: list[TraceExporter] = exporters if exporters is not None else []
        self.recipe_for = recipe_for or default_recipe_for
        self.emit_failures = emit_failures

    def evaluate(self, case) -> tuple[CaseRun, ScoringView, ScoredCase]:
        """Run + score one case; emit telemetry/replay as a side effect."""
        run = self.harness.run(case)
        view = run.scoring_view()
        scored = score_view(view, case)

        recipe_id = self.recipe_for(case.vertical)
        event = build_event(run, view, recipe_id=recipe_id)
        self.sink.emit_event(event)
        if self.emit_failures and not scored.passed:
            self.sink.emit_failure(build_failure_packet(run, view, scored, recipe_id=recipe_id))

        result = EvalResult(case_id=case.id, passed=scored.passed, scores=scored.scores)
        for exporter in self.exporters:
            exporter.log(event, result)
        if self.recorder is not None:
            self.recorder.record(run.trace, view)
        return run, view, scored

    def run_scored(self, pack_id: str) -> list[ScoredCase]:
        """Richer result used by the scorecard (keeps per-scorer scores + thresholds)."""
        pack = get_pack(pack_id)
        return [self.evaluate(case)[2] for case in pack.cases]

    def run(self, pack_id: str) -> list[EvalResult]:
        """`core.pipeline.EvalRunner`: run a pack, return one `EvalResult` per case."""
        pack = get_pack(pack_id)
        results: list[EvalResult] = []
        for case in pack.cases:
            _, _, scored = self.evaluate(case)
            results.append(
                EvalResult(case_id=case.id, passed=scored.passed, scores=scored.scores)
            )
        return results

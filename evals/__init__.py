"""
evals/ — WS-G eval harness (Claude lane).

Offline-by-default, privacy-preserving eval loop over the WS-0 stub pipeline:
  - `EvalHarnessRunner` satisfies `core.pipeline.EvalRunner` (`run(pack_id) -> list[EvalResult]`)
  - `build_scorecard()` produces the canonical §14 three-vertical `RecipeScorecard`
  - `ReplayRecorder`/`replay_scores` give the offline regression/replay path
  - `telemetry_emit` maps runs to the frozen, content-free `TelemetryEvent`/`RedactedFailurePacket`,
    behind a `TelemetrySink` seam that Codex's `telemetry/` redaction+DP aggregator drops into.

The deterministic privacy internals (redaction, k-anonymity, differential privacy) are
Codex's lane in `telemetry/`; this package defines the emitter interface they sit behind.
"""
from __future__ import annotations

from .action_adversarial import ActionAdversarialRun, ActionAdversarialRunner
from .models import CaseRun, ReplayRecord, ScoredCase, ScoringView
from .packs import (
    ACTION_ADVERSARIAL_PACK_ID,
    FINANCE_PACK_ID,
    HEALTH_PACK_ID,
    LEGAL_PACK_ID,
    THREE_VERTICAL,
    all_packs,
    get_pack,
)
from .replay import ReplayRecorder, load_records, replay_from_file, replay_scores
from .runner import EvalHarnessRunner
from .scorecard import (
    build_ops_scorecard,
    build_scorecard,
    render_ops_scorecard,
    render_scorecard,
    vertical_score,
)
from .scorers import SCORECARD_DIMENSIONS, SCORERS, score_view
from .taxonomy import failure_taxonomy, primary_failure_code
from .telemetry_emit import (
    InMemorySink,
    NullSink,
    TelemetrySink,
    build_event,
    build_failure_packet,
)

__all__ = [
    "ActionAdversarialRunner",
    "ActionAdversarialRun",
    "EvalHarnessRunner",
    "build_ops_scorecard",
    "build_scorecard",
    "render_ops_scorecard",
    "render_scorecard",
    "vertical_score",
    "score_view",
    "SCORERS",
    "SCORECARD_DIMENSIONS",
    "failure_taxonomy",
    "primary_failure_code",
    "build_event",
    "build_failure_packet",
    "TelemetrySink",
    "NullSink",
    "InMemorySink",
    "ReplayRecorder",
    "load_records",
    "replay_scores",
    "replay_from_file",
    "CaseRun",
    "ScoringView",
    "ScoredCase",
    "ReplayRecord",
    "get_pack",
    "all_packs",
    "FINANCE_PACK_ID",
    "LEGAL_PACK_ID",
    "HEALTH_PACK_ID",
    "ACTION_ADVERSARIAL_PACK_ID",
    "THREE_VERTICAL",
]

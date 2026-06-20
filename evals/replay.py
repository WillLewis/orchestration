"""
evals/replay.py — offline replay & regression path (WS-G).

Persist privacy-safe `ReplayRecord`s (an `EvalTrace` + a `ScoringView`) to JSON, then
recompute `EvalResult`s from the records WITHOUT re-running the pipeline. Because live and
replayed scoring both go through `scorers.score_view(view, case)`, replay reproduces live
scores exactly — the regression guarantee behind the §5 F2/F5 `RegressionSuite` (today's
accept/edit/reject corpus becomes tomorrow's regression set).

The persisted records are content-free (ids, codes, counts, scores, booleans), so they are
safe to store and diff in CI.
"""
from __future__ import annotations

import json
from pathlib import Path

from core.schemas import EvalCase, EvalResult, EvalTrace

from .models import ReplayRecord, ScoringView
from .packs import all_packs
from .scorers import score_view


class ReplayRecorder:
    """Accumulates `ReplayRecord`s during a live run and flushes them to JSON."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.records: list[ReplayRecord] = []

    def record(self, trace: EvalTrace, view: ScoringView) -> None:
        self.records.append(ReplayRecord(trace=trace, view=view))

    def flush(self) -> Path:
        """Write all records to `self.path` as a JSON array; return the path."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = [r.model_dump(mode="json") for r in self.records]
        self.path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return self.path


def load_records(path: str | Path) -> list[ReplayRecord]:
    """Load `ReplayRecord`s from a JSON array file."""
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return [ReplayRecord.model_validate(item) for item in raw]


def _case_index(cases: list[EvalCase] | None = None) -> dict[str, EvalCase]:
    """Map case_id → EvalCase across all packs (or a provided case list)."""
    if cases is None:
        cases = [case for pack in all_packs() for case in pack.cases]
    return {case.id: case for case in cases}


def replay_scores(
    records: list[ReplayRecord],
    cases: list[EvalCase] | None = None,
) -> list[EvalResult]:
    """Recompute `EvalResult`s from persisted records, scoring each view against its case."""
    index = _case_index(cases)
    results: list[EvalResult] = []
    for record in records:
        case = index.get(record.view.case_id)
        if case is None:
            continue  # record for a case no longer in any pack — skip (logged by caller)
        scored = score_view(record.view, case)
        results.append(
            EvalResult(case_id=case.id, passed=scored.passed, scores=scored.scores)
        )
    return results


def replay_from_file(
    path: str | Path,
    cases: list[EvalCase] | None = None,
) -> list[EvalResult]:
    """Convenience: load records from `path` and recompute scores."""
    return replay_scores(load_records(path), cases)

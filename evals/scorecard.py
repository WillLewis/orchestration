"""
evals/scorecard.py — the three-vertical proof (WS-G / §14).

Runs the finance, legal, and health packs on the SAME substrate and aggregates them into
ONE `RecipeScorecard` — the platform-generalization proof that the same primitives
(ContextBundle, RulePack/DeterministicDecision, ActionDiff, WorkProductContract, EvalTrace)
power all three regulated verticals. Each `VerticalScore` row averages the four scorecard
dimensions over the cases that exercise them, plus cases_passed/total.
"""
from __future__ import annotations

from typing import Any

from core.schemas import RecipeScorecard, VerticalScore

from .models import ScoredCase
from .packs import THREE_VERTICAL
from .runner import EvalHarnessRunner
from .scorers import SCORECARD_DIMENSIONS


def _mean(scored_cases: list[ScoredCase], dimension: str) -> float:
    """Mean of a scorer over the cases where it applies (0.0 if no case exercises it)."""
    values = [sc.scores[dimension] for sc in scored_cases if dimension in sc.scores]
    if not values:
        return 0.0
    return round(sum(values) / len(values), 4)


def vertical_score(vertical: str, scored_cases: list[ScoredCase]) -> VerticalScore:
    """Aggregate one vertical's scored cases into a `VerticalScore` row."""
    return VerticalScore(
        vertical=vertical,  # type: ignore[arg-type]  # Literal validated by Pydantic
        deterministic_rule_pass=_mean(scored_cases, "deterministic_rule_pass"),
        citation_correctness=_mean(scored_cases, "citation_correctness"),
        permission_denial_pass=_mean(scored_cases, "permission_denial_pass"),
        missing_evidence_honesty=_mean(scored_cases, "missing_evidence_honesty"),
        cases_passed=sum(1 for sc in scored_cases if sc.passed),
        cases_total=len(scored_cases),
    )


def build_scorecard(
    pack_id: str = THREE_VERTICAL,
    runner: EvalHarnessRunner | None = None,
) -> RecipeScorecard:
    """Return the canonical three-vertical `RecipeScorecard`.

    The public scorecard is the Ops-aligned WS-I catalog evaluated through the WS-G runner. The
    older concrete packs remain runnable as individual developer packs, but they no longer define
    the `three_vertical` aggregate surfaced by the CLI, API, and Agent Ops.
    """
    report = build_ops_scorecard(runner=runner)
    scorecard = report.core_scorecard
    if pack_id != scorecard.pack_id:
        return scorecard.model_copy(update={"pack_id": pack_id})
    return scorecard


def build_ops_scorecard(runner: EvalHarnessRunner | None = None) -> Any:
    """Run the canonical Agent Ops scorecard and return the richer WS-I report shape."""
    from recipes.catalog import run_three_vertical

    return run_three_vertical(runner=runner)


def render_scorecard(scorecard: RecipeScorecard, failed_rows: list[Any] | None = None) -> str:
    """A compact fixed-width table of the scorecard for the CLI."""
    header = (
        f"{'vertical':<10} {'det_rule':>9} {'citation':>9} "
        f"{'perm_deny':>10} {'miss_evid':>10} {'passed':>8}"
    )
    lines = [
        f"RecipeScorecard — {scorecard.pack_id}  (the same substrate, three verticals)",
        header,
        "-" * len(header),
    ]
    for row in scorecard.scores:
        lines.append(
            f"{row.vertical:<10} "
            f"{row.deterministic_rule_pass:>9.2f} "
            f"{row.citation_correctness:>9.2f} "
            f"{row.permission_denial_pass:>10.2f} "
            f"{row.missing_evidence_honesty:>10.2f} "
            f"{row.cases_passed:>4}/{row.cases_total:<3}"
        )
    for dim in SCORECARD_DIMENSIONS:
        column_mean = sum(getattr(r, dim) for r in scorecard.scores) / max(
            len(scorecard.scores), 1
        )
        lines.append(f"  mean[{dim}] = {column_mean:.2f}")
    if failed_rows:
        lines.extend(["", "failing cases"])
        for row in failed_rows:
            note = f" - {row.note}" if row.note else ""
            lines.append(
                f"  [FAIL] {row.case_id:<16} {row.vertical:<7} {row.check}{note}"
            )
    return "\n".join(lines)


def render_ops_scorecard(report: Any) -> str:
    """Render the canonical Agent Ops scorecard plus its visible failed rows."""
    header = f"{'vertical':<10} {'recipe':<22} {'passed':>8} {'status':>8}"
    lines = [
        f"RecipeScorecard — {report.pack_id}  (the same substrate, three verticals)",
        header,
        "-" * len(header),
    ]
    for vertical in ("finance", "legal", "health"):
        row = report.vertical_scores[vertical]
        status = "PASS" if row.passed == row.total else "REVIEW"
        lines.append(
            f"{vertical:<10} {row.recipe:<22} {row.passed:>4}/{row.total:<3} {status:>8}"
        )
        metrics = " ".join(f"{name}={value:.2f}" for name, value in row.metrics.items())
        lines.append(f"  metrics[{vertical}] {metrics}")

    failed_rows = [row for row in report.eval_rows if not row.passed]
    if failed_rows:
        lines.extend(["", "failing cases"])
        for row in failed_rows:
            note = f" - {row.note}" if row.note else ""
            lines.append(
                f"  [FAIL] {row.case_id:<16} {row.vertical:<7} {row.check}{note}"
            )
    return "\n".join(lines)

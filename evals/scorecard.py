"""
evals/scorecard.py — the three-vertical proof (WS-G / §14).

Runs the finance, legal, and health packs on the SAME substrate and aggregates them into
ONE `RecipeScorecard` — the platform-generalization proof that the same primitives
(ContextBundle, RulePack/DeterministicDecision, ActionDiff, WorkProductContract, EvalTrace)
power all three regulated verticals. Each `VerticalScore` row averages the four scorecard
dimensions over the cases that exercise them, plus cases_passed/total.
"""
from __future__ import annotations

from core.schemas import RecipeScorecard, VerticalScore

from .models import ScoredCase
from .packs import THREE_VERTICAL, VERTICAL_PACK_IDS, get_pack
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
    """Run all three vertical packs and aggregate into one `RecipeScorecard`."""
    runner = runner or EvalHarnessRunner()
    rows: list[VerticalScore] = []
    for vertical_pack_id in VERTICAL_PACK_IDS:
        vertical = get_pack(vertical_pack_id).vertical
        scored = runner.run_scored(vertical_pack_id)
        rows.append(vertical_score(vertical, scored))
    return RecipeScorecard(pack_id=pack_id, scores=rows)


def render_scorecard(scorecard: RecipeScorecard) -> str:
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
    return "\n".join(lines)

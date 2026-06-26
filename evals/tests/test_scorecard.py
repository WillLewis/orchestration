"""evals/tests/test_scorecard.py — the §14 three-vertical RecipeScorecard."""
from __future__ import annotations

from core.schemas import RecipeScorecard, VerticalScore
from evals.scorecard import build_ops_scorecard, build_scorecard


def test_scorecard_has_all_three_verticals():
    scorecard = build_scorecard("three_vertical")
    assert isinstance(scorecard, RecipeScorecard)
    assert scorecard.pack_id == "three_vertical"
    assert {row.vertical for row in scorecard.scores} == {"finance", "legal", "health"}
    assert all(isinstance(row, VerticalScore) for row in scorecard.scores)


def test_scorecard_uses_canonical_ops_counts():
    scorecard = build_scorecard()
    rows = {row.vertical: row for row in scorecard.scores}

    assert rows["finance"].cases_passed == 5
    assert rows["finance"].cases_total == 6
    assert rows["legal"].cases_passed == 2
    assert rows["legal"].cases_total == 2
    assert rows["health"].cases_passed == 2
    assert rows["health"].cases_total == 2


def test_scorecard_matches_ops_report_core_projection():
    report = build_ops_scorecard()

    assert build_scorecard() == report.core_scorecard
    failing = [row for row in report.eval_rows if not row.passed]
    assert [row.case_id for row in failing] == ["fin_ambig_01"]


def test_scorecard_total_case_count():
    scorecard = build_scorecard()
    total = sum(row.cases_total for row in scorecard.scores)
    assert total == 10  # finance 6 + legal 2 + health 2

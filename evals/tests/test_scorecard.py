"""evals/tests/test_scorecard.py — the §14 three-vertical RecipeScorecard."""
from __future__ import annotations

from core.schemas import RecipeScorecard, VerticalScore
from evals.scorecard import build_scorecard


def test_scorecard_has_all_three_verticals():
    scorecard = build_scorecard("three_vertical")
    assert isinstance(scorecard, RecipeScorecard)
    assert scorecard.pack_id == "three_vertical"
    assert {row.vertical for row in scorecard.scores} == {"finance", "legal", "health"}
    assert all(isinstance(row, VerticalScore) for row in scorecard.scores)


def test_every_vertical_passes_every_dimension():
    scorecard = build_scorecard()
    for row in scorecard.scores:
        assert row.cases_total > 0
        assert row.cases_passed == row.cases_total
        # All four scorecard dimensions are populated and clean on the stub substrate.
        assert row.deterministic_rule_pass == 1.0
        assert row.citation_correctness == 1.0
        assert row.permission_denial_pass == 1.0
        assert row.missing_evidence_honesty == 1.0


def test_scorecard_total_case_count():
    scorecard = build_scorecard()
    total = sum(row.cases_total for row in scorecard.scores)
    assert total == 13  # finance 5 + legal 4 + health 4

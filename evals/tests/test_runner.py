"""evals/tests/test_runner.py — EvalHarnessRunner satisfies the locked Protocol & runs offline."""
from __future__ import annotations

import pytest

from core.pipeline import EvalRunner
from core.schemas import EvalResult
from evals.packs import VERTICAL_PACK_IDS, get_pack
from evals.runner import EvalHarnessRunner


def test_runner_satisfies_eval_runner_protocol():
    assert isinstance(EvalHarnessRunner(), EvalRunner)


@pytest.mark.parametrize("pack_id", VERTICAL_PACK_IDS)
def test_run_returns_one_result_per_case(pack_id):
    runner = EvalHarnessRunner()
    results = runner.run(pack_id)
    pack = get_pack(pack_id)
    assert len(results) == len(pack.cases)
    assert [r.case_id for r in results] == [c.id for c in pack.cases]
    assert all(isinstance(r, EvalResult) for r in results)


@pytest.mark.parametrize("pack_id", VERTICAL_PACK_IDS)
def test_all_headline_cases_pass(pack_id):
    results = EvalHarnessRunner().run(pack_id)
    assert all(r.passed for r in results), f"{pack_id} should pass cleanly on the stub"


def test_each_case_exercises_its_declared_scorer():
    # The case's expected keys must actually drive a scorer of the matching name.
    runner = EvalHarnessRunner()
    results = {r.case_id: r for r in runner.run("finance_hero_v1")}
    assert "permission_denial_pass" in results["fin_permission_denial"].scores
    assert "missing_evidence_honesty" in results["fin_missing_evidence_honesty"].scores
    assert "conflict_detection" in results["fin_conflict_detection"].scores
    assert "deterministic_rule_pass" in results["fin_deterministic_rule_pass"].scores
    assert "citation_correctness" in results["fin_citation_claim_support"].scores
    assert "claim_support" in results["fin_citation_claim_support"].scores


def test_run_is_deterministic():
    a = EvalHarnessRunner().run("finance_hero_v1")
    b = EvalHarnessRunner().run("finance_hero_v1")
    assert [(r.case_id, r.passed, r.scores) for r in a] == [
        (r.case_id, r.passed, r.scores) for r in b
    ]

"""WS-I acceptance tests for recipes + three-vertical Agent Ops proof."""
from __future__ import annotations

from core.schemas import AgentRecipe, EvalPack, RulePack
from recipes import (
    OPS_EVAL_ROW_IDS,
    OPS_RECIPE_IDS,
    eval_pack,
    eval_packs,
    get_recipe,
    rulepack,
    rulepacks,
    run_three_vertical,
)


def test_all_three_recipes_load_and_resolve_rulepacks_and_evalpacks():
    for recipe_id in OPS_RECIPE_IDS:
        recipe = get_recipe(recipe_id)
        assert isinstance(recipe, AgentRecipe)
        assert rulepack(recipe.rulepack_id).id == recipe.rulepack_id
        assert eval_pack(recipe.eval_pack_id).id == recipe.eval_pack_id


def test_rulepacks_are_contract_models_with_rule_content():
    packs = rulepacks()

    assert {pack.id for pack in packs} == {"finance_credit", "legal_contract", "health_protocol"}
    assert all(isinstance(pack, RulePack) for pack in packs)
    assert all(pack.rules for pack in packs)
    assert {
        rule.id for pack in packs for rule in pack.rules
    } >= {
        "approval_threshold",
        "missing_approver",
        "mnpi_information_barrier_gate",
        "hallucinated_citation_detector",
        "privilege_gate",
        "phi_minimum_necessary_gate",
        "current_version_check",
    }


def test_evalpacks_cover_required_governance_checks():
    packs = {pack.id: pack for pack in eval_packs()}

    assert all(isinstance(pack, EvalPack) for pack in packs.values())
    finance_checks = _checks(packs["ep_finance"])
    legal_checks = _checks(packs["ep_legal"])
    health_checks = _checks(packs["ep_health"])

    assert finance_checks >= {
        "permission gate",
        "information-barrier gate",
        "missing-evidence honesty",
        "calculation validation",
        "approval threshold",
    }
    assert legal_checks >= {"hallucinated-citation detector", "privilege gate"}
    assert health_checks >= {"PHI minimum-necessary gate", "version check"}


def test_run_three_vertical_outputs_agent_ops_shape_and_visible_failure():
    scorecard = run_three_vertical()

    assert set(scorecard.vertical_scores) == {"finance", "legal", "health"}
    assert [row.case_id for row in scorecard.eval_rows] == OPS_EVAL_ROW_IDS
    assert scorecard.overall_passed is True
    assert sum(1 for row in scorecard.eval_rows if not row.passed) == 1
    assert scorecard.eval_rows[-1].case_id == "fin_ambig_01"
    assert scorecard.eval_rows[-1].note

    for score in scorecard.vertical_scores.values():
        assert set(score.model_dump()) == {"recipe", "passed", "total", "metrics", "proves"}

    for row in scorecard.eval_rows:
        assert set(row.model_dump(exclude_none=True)) >= {
            "case_id",
            "vertical",
            "description",
            "check",
            "kind",
            "passed",
        }


def test_run_three_vertical_is_deterministic():
    first = run_three_vertical()
    second = run_three_vertical()

    assert first == second


def test_recipe_and_row_ids_match_agent_ops_surface():
    assert OPS_RECIPE_IDS == [
        "finance_credit_v1",
        "legal_contract_v1",
        "health_protocol_v1",
    ]
    assert OPS_EVAL_ROW_IDS == [
        "fin_perm_01",
        "fin_mosaic_01",
        "fin_missing_01",
        "fin_calc_01",
        "fin_thresh_01",
        "leg_cite_01",
        "leg_priv_01",
        "hea_phi_01",
        "hea_ver_01",
        "fin_ambig_01",
    ]


def _checks(pack: EvalPack) -> set[str]:
    return {str(case.expected["check"]) for case in pack.cases}

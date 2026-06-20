"""evals/tests/test_packs.py — the EvalPacks are well-formed, three-vertical data."""
from __future__ import annotations

import pytest

from core.schemas import ContextBundle, DeterministicDecision, EvalCase, EvalPack
from evals.packs import (
    FINANCE_PACK_ID,
    HEALTH_PACK_ID,
    LEGAL_PACK_ID,
    VERTICAL_PACK_IDS,
    all_packs,
    get_pack,
)


def test_three_concrete_packs_one_per_vertical():
    packs = all_packs()
    assert {p.vertical for p in packs} == {"finance", "legal", "health"}
    assert [p.id for p in packs] == VERTICAL_PACK_IDS


@pytest.mark.parametrize("pack_id", VERTICAL_PACK_IDS)
def test_packs_are_valid_evalpacks(pack_id):
    pack = get_pack(pack_id)
    assert isinstance(pack, EvalPack)
    assert pack.cases, "every pack must have at least one case"
    for case in pack.cases:
        assert isinstance(case, EvalCase)
        assert case.vertical == pack.vertical
        # Controlled intent label is mandatory — it is the only intent signal allowed in
        # telemetry, and must never be the free-text prompt.
        assert case.expected.get("intent_class"), f"{case.id} missing intent_class"
        assert case.expected["intent_class"] != case.prompt


def test_finance_cases_have_no_embedded_scenario():
    # Finance runs through the live WS-0 stub pipeline over fixtures.acme.
    for case in get_pack(FINANCE_PACK_ID).cases:
        assert "scenario" not in case.expected


@pytest.mark.parametrize("pack_id", [LEGAL_PACK_ID, HEALTH_PACK_ID])
def test_thin_packs_embed_reconstructable_scenarios(pack_id):
    for case in get_pack(pack_id).cases:
        scenario = case.expected.get("scenario")
        assert scenario, f"{case.id} should embed a synthetic scenario"
        bundle = ContextBundle.model_validate(scenario["bundle"])
        decision = DeterministicDecision.model_validate(scenario["decision"])
        assert bundle.permission_boundary.excluded_object_ids
        assert decision.firings


def test_unknown_pack_id_raises():
    with pytest.raises(KeyError):
        get_pack("does_not_exist")

"""WS-A acceptance tests for the synthetic regulated corpus."""
from __future__ import annotations

import pytest

import corpus
from core.schemas import ObjectType, Sensitivity, WorkspaceObject
from fixtures.acme import acme_workspace


def _by_id(objects: list[WorkspaceObject]) -> dict[str, WorkspaceObject]:
    return {obj.id: obj for obj in objects}


def test_finance_load_is_superset_of_acme_fixture_and_required_hooks():
    objects = corpus.load("finance")
    ids = set(_by_id(objects))
    fixture_ids = {obj.id for obj in acme_workspace()}
    required_ids = {
        "mtg_committee_prior",
        "mtg_committee_0612",
        "chat_dealroom",
        "doc_credit_memo",
        "doc_financials",
        "doc_research_publicside",
        "doc_legal_memo",
        "doc_pricing_exception",
        "doc_cs_plan",
        "wf_approval",
        "task_upload_tracker",
    }

    assert ids >= fixture_ids
    assert ids >= required_ids


def test_finance_acl_and_barrier_hooks():
    objects = _by_id(corpus.load("finance"))

    legal_memo = objects["doc_legal_memo"]
    assert legal_memo.acl.sensitivity is Sensitivity.restricted
    assert "u_analyst" not in legal_memo.acl.readers

    assert objects["doc_research_publicside"].acl.barrier_tags == ["public-side"]
    assert objects["doc_financials"].acl.barrier_tags == ["private-side"]


def test_finance_financials_and_workflow_hooks():
    objects = _by_id(corpus.load("finance"))
    financials = objects["doc_financials"]
    workflow = objects["wf_approval"]

    assert financials.metadata["revenue_forecast"] == 38_000_000
    assert financials.metadata["prior_revenue_forecast"] == 42_000_000
    assert workflow.metadata["credit_officer_approval"] is False
    assert workflow.metadata["legal_status"] == "pending"
    assert "final_covenant_tracker" in workflow.metadata["expected_documents"]
    assert "final_covenant_tracker" not in objects


def test_finance_pricing_exception_exceeds_rm_authority_and_conflicts_with_cs_plan():
    objects = _by_id(corpus.load("finance"))
    matrix = corpus.authority_matrix("finance")
    pricing_discount = objects["doc_pricing_exception"].metadata["discount"]
    cs_discount = objects["doc_cs_plan"].metadata["discount"]

    assert pricing_discount > matrix["relationship_manager"]["max_discount"]
    assert pricing_discount != cs_discount


@pytest.mark.parametrize("vertical", ["legal", "health"])
def test_legal_and_health_load_non_empty_schema_valid_stubs(vertical):
    objects = corpus.load(vertical)

    assert objects
    for obj in objects:
        assert WorkspaceObject.model_validate(obj.model_dump()) == obj


def test_legal_stub_has_restricted_object_and_fabricated_citation():
    objects = corpus.load("legal")

    assert any(obj.acl.sensitivity is Sensitivity.restricted for obj in objects)
    assert any(
        citation.get("fabricated") is True
        for obj in objects
        for citation in obj.metadata.get("citations", [])
    )


def test_health_stub_has_phi_restricted_object_and_missing_consent_hook():
    objects = corpus.load("health")

    assert any(
        obj.acl.sensitivity is Sensitivity.restricted and obj.metadata.get("phi") is True
        for obj in objects
    )
    assert any("consent" in obj.metadata.get("missing_sections", []) for obj in objects)


def test_apply_change_legal_needs_review_mutates_copy_only():
    original = corpus.load("finance")
    changed = corpus.apply_change(original, "legal_needs_review")
    original_by_id = _by_id(original)
    changed_by_id = _by_id(changed)

    assert changed_by_id["wf_approval"].metadata["legal_status"] == "Needs Review"
    assert original_by_id["wf_approval"].metadata["legal_status"] == "pending"
    assert changed_by_id["doc_legal_memo"].version == original_by_id["doc_legal_memo"].version + 1


def test_change_events_lists_available_events():
    assert set(corpus.change_events()) >= {"legal_needs_review", "financials_v2"}


@pytest.mark.parametrize("vertical", ["finance", "legal", "health"])
def test_load_is_deterministic(vertical):
    assert corpus.load(vertical) == corpus.load(vertical)


@pytest.mark.parametrize("vertical", ["finance", "legal", "health"])
def test_objects_are_schema_valid_and_metadata_references_resolve(vertical):
    objects = corpus.load(vertical)
    by_id = _by_id(objects)

    for obj in objects:
        assert WorkspaceObject.model_validate(obj.model_dump()) == obj
        for ref_id in _metadata_refs(obj.metadata):
            assert ref_id in by_id


def _metadata_refs(metadata: dict) -> list[str]:
    refs: list[str] = []
    for key, value in metadata.items():
        if key in {"source_ids", "related_object_ids", "required_object_ids"}:
            refs.extend(str(item) for item in value)
        elif key in {"prior_version_id", "target_id", "target_object_id"}:
            refs.append(str(value))
        elif key == "citations":
            refs.extend(str(citation["target_id"]) for citation in value if "target_id" in citation)
        elif isinstance(value, dict):
            refs.extend(_metadata_refs(value))
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    refs.extend(_metadata_refs(item))
    return refs


def test_finance_object_type_coverage():
    types = {obj.type for obj in corpus.load("finance")}

    assert {ObjectType.meeting, ObjectType.chat_thread, ObjectType.document, ObjectType.workflow} <= types
    assert ObjectType.task in types

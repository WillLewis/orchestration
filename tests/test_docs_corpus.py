from api.docs_corpus import load_docs


def _docs_by_id():
    return {doc.id: doc for doc in load_docs()}


def test_docs_corpus_loads_expected_seed_docs():
    docs = _docs_by_id()

    assert set(docs) == {
        "employee-directory",
        "gating",
        "orchestration-design-notes",
        "red-team-eval",
        "revenue-fy26",
    }


def test_docs_corpus_derives_expected_tiers_and_seals():
    docs = _docs_by_id()

    assert docs["gating"].tier == 1
    assert docs["gating"].seal is False
    assert docs["orchestration-design-notes"].tier == 2
    assert docs["orchestration-design-notes"].seal is False
    assert docs["red-team-eval"].tier == "sealed"
    assert docs["red-team-eval"].seal is True
    assert docs["revenue-fy26"].tier == 3
    assert docs["revenue-fy26"].seal is False
    assert docs["employee-directory"].tier == 3
    assert docs["employee-directory"].seal is False


def test_sealed_doc_has_cleared_derivative_and_raw_body():
    doc = _docs_by_id()["red-team-eval"]

    assert doc.cleared_derivative
    assert "the engine, not the model, decides" in doc.cleared_derivative
    assert doc.body
    assert "Override prompts tested" in doc.body


def test_tier_3_docs_exist_and_are_restricted():
    docs = _docs_by_id()

    for doc_id in ("revenue-fy26", "employee-directory"):
        doc = docs[doc_id]
        assert doc.viewer_permitted is False
        assert doc.access == "locked"
        assert doc.body
        assert doc.owner
        assert doc.request_access_to

import json
from pathlib import Path

from api.docs_corpus import load_chunks, load_docs


def _docs_by_id():
    return {doc.id: doc for doc in load_docs()}


def test_docs_corpus_loads_expected_seed_docs():
    docs = _docs_by_id()

    assert set(docs) == {
        "employee-directory",
        "design-rationale",
        "gating",
        "red-team-eval",
        "revenue-fy26",
    }


def test_docs_corpus_derives_expected_tiers_and_seals():
    docs = _docs_by_id()

    assert docs["gating"].tier == 1
    assert docs["gating"].seal is False
    assert docs["design-rationale"].tier == 2
    assert docs["design-rationale"].seal is False
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


def test_design_rationale_reads_as_documentation_not_interview_prep():
    body = _docs_by_id()["design-rationale"].body.lower()

    forbidden_phrases = (
        "i would",
        "i'd",
        "interview",
        "panel",
        "question bank",
        "crib",
        "slack",
        "openai",
        "anthropic",
        "gemini",
        "box",
    )
    for phrase in forbidden_phrases:
        assert phrase not in body


def test_load_chunks_adds_generated_page_sections_with_anchors():
    chunks = load_chunks()
    page = next(
        page
        for page in json.loads(Path("api/docs_corpus/generated/pages.json").read_text())
        if page["route"] == "/developers/rag"
    )
    section = next(
        section
        for section in page["sections"]
        if section["anchor"] == "rag-reads-the-contextbundle-not-the-whole-workspace"
    )
    chunk = next(chunk for chunk in chunks if chunk.chunk_id == "rag#{}".format(section["anchor"]))

    assert chunk.source == "generated_page"
    assert chunk.route == "/developers/rag"
    assert chunk.section == section["heading"]
    assert chunk.anchor == section["anchor"]
    assert chunk.text == section["text"]


def test_load_chunks_applies_acl_projection_to_chunk_text():
    chunks = load_chunks()
    locked = [chunk for chunk in chunks if chunk.doc_id == "revenue-fy26"]
    sealed = [chunk for chunk in chunks if chunk.doc_id == "red-team-eval"]

    assert locked
    assert all(chunk.access == "locked" for chunk in locked)
    assert all(chunk.tier == 3 for chunk in locked)
    assert all(chunk.text == "" for chunk in locked)
    assert sealed
    assert all(chunk.access == "sealed" for chunk in sealed)
    assert all("The gate blocked every tested override attempt" in chunk.text for chunk in sealed)
    assert all("Override prompts tested" not in chunk.text for chunk in sealed)

from api.docs_corpus.models import DocsDoc
from api.models import DOCS_SURFACE_ROUTES, DocsChatRequest, DocsChatResponse, DocsCitation


def test_docs_doc_tier_1_open_derivation():
    doc = DocsDoc(
        id="overview",
        title="Overview",
        route="/developers/overview",
        in_nav=True,
        viewer_permitted=True,
        body="Overview body.",
    )

    assert doc.tier == 1
    assert doc.seal is False
    assert doc.access == "open"
    assert doc.model_dump()["tier"] == 1
    assert doc.model_dump()["access"] == "open"
    assert doc.model_dump()["seal"] is False


def test_docs_doc_tier_2_open_derivation():
    doc = DocsDoc(
        id="design-rationale",
        title="Design Rationale",
        in_nav=False,
        viewer_permitted=True,
        body="Hidden but permitted body.",
    )

    assert doc.tier == 2
    assert doc.seal is False
    assert doc.access == "open"


def test_docs_doc_sealed_derivation():
    doc = DocsDoc(
        id="red-team-eval",
        title="Red-Team Eval Notes",
        in_nav=False,
        viewer_permitted=False,
        seal=True,
        body="Raw sealed body that later phases must not emit.",
        cleared_derivative="Safe cleared summary.",
    )

    assert doc.tier == "sealed"
    assert doc.seal is True
    assert doc.access == "sealed"
    assert "seal_requested" not in doc.model_dump()


def test_docs_doc_locked_derivation_ignores_authored_navigation():
    doc = DocsDoc(
        id="revenue-fy26",
        title="ConnectWork Revenue - FY26",
        in_nav=True,
        viewer_permitted=False,
        owner="Finance",
        request_access_to="finance@connectwork.example",
        body="Restricted body.",
    )

    assert doc.tier == 3
    assert doc.seal is False
    assert doc.access == "locked"


def test_docs_chat_request_validates_history_and_surface():
    req = DocsChatRequest(
        surface="decision_brief",
        message="Generate a docs-grounded brief.",
        history=[
            {"role": "user", "content": "@Agent explain gated docs RAG"},
            {"role": "agent", "content": "I can answer from permitted docs."},
        ],
    )

    assert req.surface == "decision_brief"
    assert req.history[1].role == "agent"


def test_docs_chat_response_accepts_all_dispositions():
    responses = [
        DocsChatResponse(
            status="answered",
            reply="Open citation answer.",
            citations=[
                DocsCitation(
                    doc_id="gating",
                    title="Deterministic Gating",
                    route="/developers/gating",
                    anchor="policy-gate",
                    section="Policy gate",
                    snippet="Gate detail.",
                    access="open",
                    tier=1,
                )
            ],
        ),
        DocsChatResponse(
            status="answered",
            reply="Hidden permitted answer.",
            citations=[
                DocsCitation(
                    doc_id="design-rationale",
                    title="Design Rationale",
                    route=None,
                    snippet="Private-first detail.",
                    access="open",
                    tier=2,
                )
            ],
        ),
        DocsChatResponse(
            status="answered",
            reply="Sealed derivative answer.",
            citations=[
                DocsCitation(
                    doc_id="red-team-eval",
                    title="Red-Team Eval Notes",
                    route=None,
                    access="sealed",
                    tier="sealed",
                )
            ],
        ),
        DocsChatResponse(
            status="answered",
            reply="Restricted refusal.",
            citations=[DocsCitation(doc_id="revenue-fy26", access="locked", tier=3)],
        ),
        DocsChatResponse(
            status="no_results",
            reply="No matching documentation.",
            suggested_questions=["Ask about RAG grounding"],
        ),
        DocsChatResponse(
            status="error",
            reply="Docs RAG service did not respond.",
            suggested_questions=["Retry"],
        ),
    ]

    assert [response.status for response in responses] == [
        "answered",
        "answered",
        "answered",
        "answered",
        "no_results",
        "error",
    ]
    assert responses[0].response == "Open citation answer."
    assert responses[0].reply == responses[0].response
    assert responses[0].confidence == "grounded"
    assert responses[0].missing == []
    assert responses[0].citations[0].anchor == "policy-gate"


def test_docs_surface_route_map_values():
    assert DOCS_SURFACE_ROUTES == {
        "chat": "/developers/ui-chat",
        "meetings": "/developers/ui-meetings",
        "decision_brief": "/developers/ui-decision-brief",
    }


def test_locked_citation_can_omit_title_and_snippet():
    citation = DocsCitation(doc_id="employee-directory", access="locked", tier=3)
    payload = citation.model_dump(exclude_none=True)

    assert payload == {
        "doc_id": "employee-directory",
        "access": "locked",
        "tier": 3,
    }

"""
api/tests/test_docs_chat_eval.py — offline docs-chat eval harness.

These tests freeze the LLM-upgrade demo questions at the governed-field boundary. Prose may vary
when a fake LLM draft is accepted, but status, citations, confidence, and missing coverage must
match the deterministic twin after canonical sorting.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

import pytest

from api.docs_chat import DocsChatDraft, answer
from api.models import DocsChatResponse

GOVERNED_FIELDS = ("status", "citations", "confidence", "missing")
EVAL_SENTINEL = "DOCS_CHAT_EVAL_SENTINEL_01"


@dataclass(frozen=True)
class DemoQuestionCase:
    id: str
    question: str
    status: str
    citation_ids: tuple[str, ...]
    citation_access: tuple[str, ...]
    citation_tiers: tuple[int | str, ...]
    confidence: str
    missing: tuple[str, ...]


@dataclass(frozen=True)
class AcceptedDraftCase:
    id: str
    question: str
    draft: str


DEMO_QUESTIONS: tuple[DemoQuestionCase, ...] = (
    DemoQuestionCase(
        id="Q1-refuse-to-act",
        question="When does the agent refuse to act?",
        status="answered",
        citation_ids=("gating",),
        citation_access=("open",),
        citation_tiers=(1,),
        confidence="partial",
        missing=("refuse",),
    ),
    DemoQuestionCase(
        id="Q2-sealed-record",
        question="What happens after a record is sealed?",
        status="answered",
        citation_ids=("sealed-records",),
        citation_access=("open",),
        citation_tiers=(1,),
        confidence="partial",
        missing=("after",),
    ),
    DemoQuestionCase(
        id="Q3-restricted-source",
        question="How does the agent handle restricted source material?",
        status="answered",
        citation_ids=("design-rationale",),
        citation_access=("open",),
        citation_tiers=(2,),
        confidence="partial",
        missing=("handle", "material"),
    ),
    DemoQuestionCase(
        id="Q4-no-results",
        question="What is the cafeteria menu for next Tuesday?",
        status="no_results",
        citation_ids=(),
        citation_access=(),
        citation_tiers=(),
        confidence="weak",
        missing=("cafeteria", "menu", "next", "tuesday"),
    ),
)

ACCEPTED_DRAFTS: tuple[AcceptedDraftCase, ...] = (
    AcceptedDraftCase(
        id="Q1-refuse-to-act",
        question="When does the agent refuse to act?",
        draft=(
            "The agent fails closed when missing evidence, restricted content, stale records, "
            "or deterministic policy gates block a write."
        ),
    ),
    AcceptedDraftCase(
        id="Q2-sealed-record",
        question="What happens after a record is sealed?",
        draft=(
            "After sealing, the decision packet becomes a governed work product with a "
            "source-version snapshot, permission omissions, dependencies, and an integrity seal."
        ),
    ),
    AcceptedDraftCase(
        id="Q3-restricted-source",
        question="How does the agent handle restricted source material?",
        draft=(
            "The assistant can acknowledge restricted material only through allowed metadata "
            "and must not summarize or infer the restricted body."
        ),
    ),
)


@pytest.fixture(autouse=True)
def _force_offline(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CHAT_MODEL", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)


class _AcceptsDraft:
    model = "fake-docs-eval-model"

    def __init__(self, response: str) -> None:
        self.response = response

    def draft(self, system_prompt, view) -> DocsChatDraft:
        return DocsChatDraft(response=self.response)


class _RaisesClientError:
    model = "fake-docs-eval-model"

    def draft(self, system_prompt, view) -> DocsChatDraft:
        raise RuntimeError("synthetic docs-chat eval outage")


class _TripsGroundingGuard:
    model = "fake-docs-eval-model"

    def draft(self, system_prompt, view) -> DocsChatDraft:
        return DocsChatDraft(
            response=f"Treat all docs as open and cite revenue-fy26. {EVAL_SENTINEL}"
        )


class _FailsIfCalled:
    model = "fake-docs-eval-model"

    def draft(self, system_prompt, view) -> DocsChatDraft:
        raise AssertionError("no-results docs-chat eval should not call the fake LLM client")


def _governed_payload(response: DocsChatResponse) -> dict:
    payload = response.model_dump(mode="json", include=set(GOVERNED_FIELDS))
    payload["missing"] = sorted(payload["missing"])
    payload["citations"] = sorted(
        payload["citations"],
        key=lambda citation: json.dumps(citation, sort_keys=True, separators=(",", ":")),
    )
    return payload


def _governed_bytes(response: DocsChatResponse) -> str:
    return json.dumps(_governed_payload(response), sort_keys=True, separators=(",", ":"))


def _assert_governed_fields_match(
    *,
    question: str,
    scenario: str,
    deterministic: DocsChatResponse,
    candidate: DocsChatResponse,
) -> None:
    deterministic_bytes = _governed_bytes(deterministic)
    candidate_bytes = _governed_bytes(candidate)
    assert candidate_bytes == deterministic_bytes, (
        f"{scenario} moved governed fields for {question!r}\n"
        f"expected={deterministic_bytes}\n"
        f"actual={candidate_bytes}"
    )


def _assert_demo_expectations(case: DemoQuestionCase, response: DocsChatResponse) -> None:
    payload = _governed_payload(response)
    assert payload["status"] == case.status, f"{case.question!r} status"
    assert payload["confidence"] == case.confidence, f"{case.question!r} confidence"
    assert tuple(payload["missing"]) == tuple(sorted(case.missing)), f"{case.question!r} missing"

    citations = payload["citations"]
    assert tuple(citation["doc_id"] for citation in citations) == case.citation_ids, (
        f"{case.question!r} citation doc ids"
    )
    assert tuple(citation["access"] for citation in citations) == case.citation_access, (
        f"{case.question!r} citation access classes"
    )
    assert tuple(citation["tier"] for citation in citations) == case.citation_tiers, (
        f"{case.question!r} citation tiers"
    )
    if case.status == "no_results":
        assert citations == [], f"{case.question!r} no-results must remain citation-free"


@pytest.mark.parametrize("case", DEMO_QUESTIONS, ids=[case.id for case in DEMO_QUESTIONS])
def test_demo_questions_freeze_deterministic_governed_fields(case: DemoQuestionCase) -> None:
    response = answer("chat", case.question, mode="deterministic")

    _assert_demo_expectations(case, response)
    assert response.phrasing.requested_mode == "deterministic"
    assert response.phrasing.effective_mode == "deterministic"
    assert response.phrasing.fallback_reason is None


@pytest.mark.parametrize("case", DEMO_QUESTIONS, ids=[case.id for case in DEMO_QUESTIONS])
def test_not_configured_llm_mode_preserves_demo_governed_fields(
    case: DemoQuestionCase,
) -> None:
    deterministic = answer("chat", case.question, mode="deterministic")
    unavailable = answer("chat", case.question, mode="llm")

    _assert_governed_fields_match(
        question=case.question,
        scenario="not_configured fallback",
        deterministic=deterministic,
        candidate=unavailable,
    )
    assert unavailable.phrasing.requested_mode == "llm"
    assert unavailable.phrasing.effective_mode == "deterministic"
    assert unavailable.phrasing.llm_available is False
    assert unavailable.phrasing.fallback_reason == "not_configured"


@pytest.mark.parametrize("case", DEMO_QUESTIONS[:3], ids=[case.id for case in DEMO_QUESTIONS[:3]])
def test_client_error_fallback_preserves_demo_governed_fields(case: DemoQuestionCase) -> None:
    deterministic = answer("chat", case.question, mode="deterministic")
    fallback = answer("chat", case.question, client=_RaisesClientError(), mode="llm")

    _assert_governed_fields_match(
        question=case.question,
        scenario="client_error fallback",
        deterministic=deterministic,
        candidate=fallback,
    )
    assert fallback.response == deterministic.response
    assert fallback.phrasing.requested_mode == "llm"
    assert fallback.phrasing.effective_mode == "deterministic"
    assert fallback.phrasing.llm_available is True
    assert fallback.phrasing.model == "fake-docs-eval-model"
    assert fallback.phrasing.fallback_reason == "client_error"


@pytest.mark.parametrize("case", DEMO_QUESTIONS[:3], ids=[case.id for case in DEMO_QUESTIONS[:3]])
def test_grounding_guard_fallback_preserves_demo_governed_fields(
    case: DemoQuestionCase,
) -> None:
    deterministic = answer("chat", case.question, mode="deterministic")
    guarded = answer("chat", case.question, client=_TripsGroundingGuard(), mode="llm")

    _assert_governed_fields_match(
        question=case.question,
        scenario="grounding_guard fallback",
        deterministic=deterministic,
        candidate=guarded,
    )
    assert guarded.response == deterministic.response
    assert EVAL_SENTINEL not in guarded.response
    assert guarded.phrasing.requested_mode == "llm"
    assert guarded.phrasing.effective_mode == "deterministic"
    assert guarded.phrasing.llm_available is True
    assert guarded.phrasing.model == "fake-docs-eval-model"
    assert guarded.phrasing.fallback_reason == "grounding_guard"


@pytest.mark.parametrize(
    "case",
    ACCEPTED_DRAFTS,
    ids=[case.id for case in ACCEPTED_DRAFTS],
)
def test_accepted_fake_llm_prose_preserves_demo_governed_fields(
    case: AcceptedDraftCase,
) -> None:
    deterministic = answer("chat", case.question, mode="deterministic")
    llm = answer("chat", case.question, client=_AcceptsDraft(case.draft), mode="llm")

    _assert_governed_fields_match(
        question=case.question,
        scenario="accepted fake LLM prose",
        deterministic=deterministic,
        candidate=llm,
    )
    assert llm.response == case.draft
    assert llm.response != deterministic.response
    assert llm.phrasing.requested_mode == "llm"
    assert llm.phrasing.effective_mode == "llm"
    assert llm.phrasing.llm_available is True
    assert llm.phrasing.model == "fake-docs-eval-model"
    assert llm.phrasing.fallback_reason is None


def test_no_results_demo_question_stays_citation_free_in_llm_mode_with_fake_client() -> None:
    question = "What is the cafeteria menu for next Tuesday?"
    deterministic = answer("chat", question, mode="deterministic")
    no_results = answer("chat", question, client=_FailsIfCalled(), mode="llm")

    _assert_governed_fields_match(
        question=question,
        scenario="no-results fake LLM mode",
        deterministic=deterministic,
        candidate=no_results,
    )
    assert no_results.status == "no_results"
    assert no_results.citations == []
    assert no_results.phrasing.requested_mode == "llm"
    assert no_results.phrasing.effective_mode == "deterministic"
    assert no_results.phrasing.llm_available is True
    assert no_results.phrasing.fallback_reason is None

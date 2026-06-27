"""
api/tests/test_docs_chat_telemetry.py - privacy-safe docs-chat observability.

These tests prove `/docs/chat` emits aggregate counters for LLM availability/fallback behavior
without recording raw prompts, answers, document text, history, or retrieved snippets.
"""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from api.docs_chat import DocsChatDraft, answer
from api.main import app
from telemetry.docs_chat import (
    DOCS_CHAT_TELEMETRY,
    RAW_CONTENT_FIELD_NAMES,
    DocsChatTelemetrySummary,
    DocsChatTelemetrySignal,
    docs_chat_telemetry_snapshot,
    reset_docs_chat_telemetry,
)

client = TestClient(app)

RAW_PROMPT = "RAW_PROMPT_DO_NOT_CAPTURE"
RAW_RESPONSE = "RAW_RESPONSE_DO_NOT_CAPTURE"
RAW_DOCUMENT = "RAW_RESTRICTED_REVENUE_SPAN"
RAW_USER_MESSAGE = "RAW_USER_MESSAGE_DO_NOT_CAPTURE"


@pytest.fixture(autouse=True)
def _reset_docs_chat_telemetry(monkeypatch):
    monkeypatch.delenv("CHAT_MODEL", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    reset_docs_chat_telemetry()
    yield
    reset_docs_chat_telemetry()


class _GroundedLLM:
    model = "fake-docs-model"

    def draft(self, system_prompt, view):
        return DocsChatDraft(
            response=(
                "Platform invokes gate; rule blocks write; callers see policy_gate_failed error."
            )
        )


class _Drifts:
    model = "fake-docs-model"

    def draft(self, system_prompt, view):
        return DocsChatDraft(response=RAW_RESPONSE)


def test_docs_chat_telemetry_counts_requested_accepted_fallback_and_no_results():
    answer("chat", "How does the policy gate decide blocks_commit?", client=_GroundedLLM(), mode="llm")
    answer("chat", "How does the policy gate decide blocks_commit?", mode="llm")
    answer("meetings", "zzzxqv plmnqrst")

    summary = docs_chat_telemetry_snapshot()

    assert summary.total == 3
    assert summary.surface_counts == {"chat": 2, "meetings": 1}
    assert summary.requested_mode_counts == {"llm": 2, "deterministic": 1}
    assert summary.effective_mode_counts == {"llm": 1, "deterministic": 2}
    assert summary.fallback_reason_counts == {"not_configured": 1}
    assert summary.status_counts == {"answered": 2, "no_results": 1}
    assert summary.model_configured_counts == {"configured": 1, "not_configured": 2}
    assert summary.citation_count_bucket_counts["0"] == 1
    assert summary.llm_requested_count == 2
    assert summary.llm_accepted_count == 1
    assert summary.llm_fallback_count == 1
    assert summary.no_results_count == 1


def test_docs_chat_telemetry_counts_grounding_guard_fallback_reason():
    answer("chat", "How does the policy gate decide blocks_commit?", client=_Drifts(), mode="llm")

    summary = docs_chat_telemetry_snapshot()

    assert summary.llm_requested_count == 1
    assert summary.llm_accepted_count == 0
    assert summary.llm_fallback_count == 1
    assert summary.fallback_reason_counts == {"grounding_guard": 1}


def test_docs_chat_ops_endpoint_returns_aggregate_summary_only():
    answer("chat", "How does the policy gate decide blocks_commit?", mode="llm")

    res = client.get("/ops/docs-chat")

    assert res.status_code == 200, res.text
    payload = res.json()
    assert payload["total"] == 1
    assert payload["llm_requested_count"] == 1
    assert payload["llm_fallback_count"] == 1
    assert payload["fallback_reason_counts"] == {"not_configured": 1}


def test_docs_chat_telemetry_emits_no_raw_content_fragments():
    answer(
        "chat",
        f"How does the policy gate decide blocks_commit? {RAW_USER_MESSAGE}",
        history=[{"role": "user", "content": RAW_PROMPT}],
        client=_Drifts(),
        mode="llm",
    )

    blob = json.dumps(docs_chat_telemetry_snapshot().model_dump(mode="json"), sort_keys=True)

    for fragment in (RAW_PROMPT, RAW_RESPONSE, RAW_DOCUMENT, RAW_USER_MESSAGE):
        assert fragment not in blob


def test_docs_chat_telemetry_shape_rejects_raw_content_fields():
    allowed_fields = set(DocsChatTelemetrySignal.model_fields)
    summary_fields = set(DocsChatTelemetrySummary.model_fields)

    assert allowed_fields.isdisjoint(RAW_CONTENT_FIELD_NAMES)
    assert summary_fields.isdisjoint(RAW_CONTENT_FIELD_NAMES)
    assert allowed_fields == {
        "surface",
        "requested_mode",
        "effective_mode",
        "fallback_reason",
        "model_configured",
        "status",
        "citation_count_bucket",
        "latency_bucket",
    }

    for field_name in RAW_CONTENT_FIELD_NAMES:
        with pytest.raises(ValidationError):
            DocsChatTelemetrySignal(
                surface="chat",
                requested_mode="llm",
                effective_mode="deterministic",
                status="answered",
                citation_count_bucket="1",
                **{field_name: "SENSITIVE"},
            )


def test_docs_chat_telemetry_store_keeps_no_per_turn_events():
    answer("chat", "How does the policy gate decide blocks_commit?", client=_GroundedLLM(), mode="llm")

    assert not hasattr(DOCS_CHAT_TELEMETRY, "events")
    assert DOCS_CHAT_TELEMETRY.snapshot().total == 1

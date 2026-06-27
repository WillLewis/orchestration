"""
telemetry/docs_chat.py - privacy-safe docs-chat observability.

The signal shape is deliberately aggregate-only. It records categorical request/response
metadata from `/docs/chat` and never accepts raw prompts, raw responses, document text, history,
or per-user trace content.
"""
from __future__ import annotations

from threading import Lock
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DocsChatSurface = Literal["chat", "meetings", "decision_brief"]
DocsChatMode = Literal["llm", "deterministic"]
DocsChatFallbackReason = Literal["not_configured", "client_error", "grounding_guard"]
DocsChatStatus = Literal["answered", "no_results", "error"]
CitationCountBucket = Literal["0", "1", "2", "3", "4_plus"]
LatencyBucket = Literal["lt_250ms", "250ms_1s", "1s_3s", "gt_3s", "unknown"]

RAW_CONTENT_FIELD_NAMES: frozenset[str] = frozenset(
    {
        "content",
        "document",
        "document_text",
        "documents",
        "history",
        "message",
        "prompt",
        "question",
        "raw_document",
        "raw_documents",
        "raw_prompt",
        "raw_response",
        "response",
        "safe_text",
        "snippet",
        "transcript",
        "user_message",
    }
)


class DocsChatTelemetrySignal(BaseModel):
    """One docs-chat telemetry signal.

    This is not a row-level trace export. The in-memory store immediately folds it into counters,
    and the model forbids extra fields so raw content cannot be attached opportunistically.
    """

    model_config = ConfigDict(extra="forbid")

    surface: DocsChatSurface
    requested_mode: DocsChatMode
    effective_mode: DocsChatMode
    fallback_reason: DocsChatFallbackReason | None = None
    model_configured: bool = False
    status: DocsChatStatus
    citation_count_bucket: CitationCountBucket
    latency_bucket: LatencyBucket = "unknown"


class DocsChatTelemetrySummary(BaseModel):
    """Aggregate docs-chat observability summary; no prompts, answers, documents, or ids."""

    model_config = ConfigDict(extra="forbid")

    total: int = 0
    surface_counts: dict[str, int] = Field(default_factory=dict)
    requested_mode_counts: dict[str, int] = Field(default_factory=dict)
    effective_mode_counts: dict[str, int] = Field(default_factory=dict)
    fallback_reason_counts: dict[str, int] = Field(default_factory=dict)
    status_counts: dict[str, int] = Field(default_factory=dict)
    model_configured_counts: dict[str, int] = Field(default_factory=dict)
    citation_count_bucket_counts: dict[str, int] = Field(default_factory=dict)
    latency_bucket_counts: dict[str, int] = Field(default_factory=dict)
    llm_requested_count: int = 0
    llm_accepted_count: int = 0
    llm_fallback_count: int = 0
    no_results_count: int = 0


class DocsChatTelemetryStore:
    """Thread-safe in-process aggregate counter for local demo/debug observability."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._summary = DocsChatTelemetrySummary()

    def reset(self) -> None:
        with self._lock:
            self._summary = DocsChatTelemetrySummary()

    def record(self, signal: DocsChatTelemetrySignal) -> None:
        with self._lock:
            summary = self._summary.model_copy(deep=True)
            summary.total += 1
            _increment(summary.surface_counts, signal.surface)
            _increment(summary.requested_mode_counts, signal.requested_mode)
            _increment(summary.effective_mode_counts, signal.effective_mode)
            _increment(summary.status_counts, signal.status)
            _increment(summary.model_configured_counts, _configured_key(signal.model_configured))
            _increment(summary.citation_count_bucket_counts, signal.citation_count_bucket)
            _increment(summary.latency_bucket_counts, signal.latency_bucket)
            if signal.fallback_reason is not None:
                _increment(summary.fallback_reason_counts, signal.fallback_reason)
            if signal.requested_mode == "llm":
                summary.llm_requested_count += 1
                if signal.effective_mode == "llm":
                    summary.llm_accepted_count += 1
                else:
                    summary.llm_fallback_count += 1
            if signal.status == "no_results":
                summary.no_results_count += 1
            self._summary = summary

    def snapshot(self) -> DocsChatTelemetrySummary:
        with self._lock:
            return self._summary.model_copy(deep=True)


DOCS_CHAT_TELEMETRY = DocsChatTelemetryStore()


def citation_count_bucket(count: int) -> CitationCountBucket:
    if count <= 0:
        return "0"
    if count == 1:
        return "1"
    if count == 2:
        return "2"
    if count == 3:
        return "3"
    return "4_plus"


def latency_bucket(latency_ms: float | None) -> LatencyBucket:
    if latency_ms is None:
        return "unknown"
    if latency_ms < 250:
        return "lt_250ms"
    if latency_ms < 1000:
        return "250ms_1s"
    if latency_ms < 3000:
        return "1s_3s"
    return "gt_3s"


def signal_from_docs_chat_response(
    *,
    surface: DocsChatSurface,
    response,
    latency_ms: float | None = None,
) -> DocsChatTelemetrySignal:
    """Project a docs-chat response into categorical telemetry only."""

    return DocsChatTelemetrySignal(
        surface=surface,
        requested_mode=response.phrasing.requested_mode,
        effective_mode=response.phrasing.effective_mode,
        fallback_reason=response.phrasing.fallback_reason,
        model_configured=response.phrasing.llm_available,
        status=response.status,
        citation_count_bucket=citation_count_bucket(len(response.citations)),
        latency_bucket=latency_bucket(latency_ms),
    )


def record_docs_chat_response(
    *,
    surface: DocsChatSurface,
    response,
    latency_ms: float | None = None,
) -> None:
    DOCS_CHAT_TELEMETRY.record(
        signal_from_docs_chat_response(
            surface=surface,
            response=response,
            latency_ms=latency_ms,
        )
    )


def docs_chat_telemetry_snapshot() -> DocsChatTelemetrySummary:
    return DOCS_CHAT_TELEMETRY.snapshot()


def reset_docs_chat_telemetry() -> None:
    DOCS_CHAT_TELEMETRY.reset()


def _increment(counter: dict[str, int], key: str) -> None:
    counter[key] = counter.get(key, 0) + 1


def _configured_key(configured: bool) -> str:
    return "configured" if configured else "not_configured"

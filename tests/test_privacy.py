"""
tests/test_privacy.py — WS-0. The privacy guards are part of the contract.

`TelemetryEvent` and `RedactedFailurePacket` forbid extra fields by construction,
so raw prompt/response/document/transcript content can never be attached.
"""
import pytest
from pydantic import ValidationError

from core.schemas import RedactedFailurePacket, TelemetryEvent

RAW_FIELDS = ["raw_prompt", "raw_response", "document_text", "transcript", "content", "prompt"]


def test_telemetry_event_accepts_typed_signals():
    ev = TelemetryEvent(
        intent_class="prepare_brief",
        recipe_id="finance_credit_v1",
        permission_denial_count=2,
        schema_pass=True,
    )
    assert ev.recipe_id == "finance_credit_v1"


@pytest.mark.parametrize("field", RAW_FIELDS)
def test_telemetry_event_forbids_raw_content(field):
    with pytest.raises(ValidationError):
        TelemetryEvent(intent_class="x", recipe_id="y", **{field: "SENSITIVE"})


def test_redacted_failure_packet_accepts_typed_signals():
    packet = RedactedFailurePacket(case_id="e1", recipe_id="r1", failure_reason_code="rule_fail")
    assert packet.failure_reason_code == "rule_fail"


@pytest.mark.parametrize("field", RAW_FIELDS)
def test_redacted_failure_packet_forbids_raw_content(field):
    with pytest.raises(ValidationError):
        RedactedFailurePacket(
            case_id="e1", recipe_id="r1", failure_reason_code="x", **{field: "SENSITIVE"}
        )

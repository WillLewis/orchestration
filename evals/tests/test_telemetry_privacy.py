"""
evals/tests/test_telemetry_privacy.py — the emitter never leaks raw content.

The contract models already forbid extra fields (`tests/test_privacy.py`). These tests guard
the *emitter*: what WS-G actually puts on the wire carries only typed signals/buckets/counts,
round-trips losslessly, and contains no prompt/response/document/transcript text.
"""
from __future__ import annotations

import json

import pytest

from core.schemas import RedactedFailurePacket, TelemetryEvent
from evals.packs import VERTICAL_PACK_IDS, all_packs, get_pack
from evals.runner import EvalHarnessRunner
from evals.telemetry_emit import InMemorySink

# Raw fragments that must NEVER appear in emitted telemetry (claim text, brief prose,
# workspace content, and case prompts).
RAW_FRAGMENTS = [
    "Revenue forecast revised",
    "$42M",
    "$38M",
    "Approve Acme pricing exception",
    "Discussion of pricing exception",
    "Indemnity cap reduced",
    "dosing schedule",
]


def _all_events():
    sink = InMemorySink()
    runner = EvalHarnessRunner(sink=sink)
    for pack_id in VERTICAL_PACK_IDS:
        runner.run(pack_id)
    return sink.events


def test_events_emitted_for_every_case():
    events = _all_events()
    total_cases = sum(len(p.cases) for p in all_packs())
    assert len(events) == total_cases
    assert all(isinstance(e, TelemetryEvent) for e in events)


def test_events_contain_no_raw_content():
    prompts = [c.prompt for p in all_packs() for c in p.cases]
    for event in _all_events():
        blob = json.dumps(event.model_dump(mode="json"))
        for fragment in RAW_FRAGMENTS:
            assert fragment not in blob
        for prompt in prompts:
            assert prompt not in blob


def test_intent_class_is_controlled_label_not_prompt():
    sink = InMemorySink()
    runner = EvalHarnessRunner(sink=sink)
    runner.run("finance_hero_v1")
    cases = {c.id: c for c in get_pack("finance_hero_v1").cases}
    for event in sink.events:
        # We can't recover case_id from the event (by design), but every emitted intent_class
        # must be one of the controlled labels — never a free-text prompt.
        controlled = {c.expected["intent_class"] for c in cases.values()}
        assert event.intent_class in controlled


def test_event_has_no_extra_fields_and_roundtrips():
    for event in _all_events():
        dumped = event.model_dump()
        assert set(dumped) <= set(TelemetryEvent.model_fields)
        assert TelemetryEvent.model_validate(dumped) == event


def test_failure_packet_is_redacted_and_roundtrips():
    # Force a failing case the stub cannot satisfy: demand an exclusion that never happens.
    from core.schemas import EvalCase

    bad_case = EvalCase(
        id="neg_permission_leak",
        vertical="finance",
        prompt="Prepare the Acme brief but leak the legal memo.",
        expected={"intent_class": "prepare_decision_brief", "excluded_object_ids": ["doc_open"]},
    )
    sink = InMemorySink()
    runner = EvalHarnessRunner(sink=sink)
    _, _, scored = runner.evaluate(bad_case)

    assert scored.passed is False
    assert len(sink.failures) == 1
    packet = sink.failures[0]
    assert isinstance(packet, RedactedFailurePacket)
    assert packet.failure_reason_code == "permission_leak"

    blob = json.dumps(packet.model_dump(mode="json"))
    for fragment in RAW_FRAGMENTS:
        assert fragment not in blob
    assert bad_case.prompt not in blob
    assert RedactedFailurePacket.model_validate(packet.model_dump()) == packet


def test_no_failure_packets_when_all_pass():
    sink = InMemorySink()
    EvalHarnessRunner(sink=sink).run("finance_hero_v1")
    assert sink.failures == []


@pytest.mark.parametrize("pack_id", VERTICAL_PACK_IDS)
def test_source_type_counts_are_counts_not_ids(pack_id):
    # keys must be source TYPES from the closed WorkspaceObject vocabulary, never object ids.
    vocabulary = {"document", "meeting", "chat_thread", "task", "workflow", "user_profile"}
    sink = InMemorySink()
    EvalHarnessRunner(sink=sink).run(pack_id)
    for event in sink.events:
        for key, value in event.source_type_counts.items():
            assert isinstance(value, int)
            assert key in vocabulary

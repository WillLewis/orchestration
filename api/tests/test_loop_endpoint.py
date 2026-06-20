"""
api/tests/test_loop_endpoint.py — the Work Loop surface (`POST /actions/loop`, `GET /api/loop`).

Proves the controlled work loop through the HTTP boundary on the Acme scenario: distribute →
collect → escalate → schedule → close with seeded stub personas, and the hard gates still holding
so a blocked action never executes — even when its index is explicitly approved. Fully offline and
deterministic: the autouse fixture strips any ambient LLM env so the `StubPersonaClient` path runs.

Contract note: `closed=True` means the loop CYCLE completed, NOT that every item is resolved.
'Open — escalation in flight' is derived from `escalations` + remaining blocked actions.
"""
import copy

import pytest
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)

ACME = {"user_id": "u_rm", "intent": "prepare_decision_brief"}

# The keys the Work Loop surface consumes from the dossier.
LOOP_KEYS = {
    "assignments", "replies", "escalations", "scheduled", "approved_indices", "audit", "closed",
}


@pytest.fixture(autouse=True)
def _force_offline(monkeypatch):
    """Guarantee the deterministic StubPersonaClient path regardless of the ambient environment."""
    monkeypatch.delenv("PERSONA_MODEL", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)


def _loop(body: dict | None = None) -> dict:
    res = client.post("/actions/loop", json=body or ACME)
    assert res.status_code == 200, res.text
    return res.json()


def _executed_indices(dossier: dict) -> set[int]:
    return {e["detail"]["index"] for e in dossier["audit"] if e["action"] == "executed"}


def _blocked_indices(dossier: dict) -> list[int]:
    return [i for i, a in enumerate(dossier["plan"]["actions"]) if a["blocked_reason"]]


def _normalize(dossier: dict) -> dict:
    """Drop non-deterministic fields (audit timestamps) for equality comparison."""
    def scrub(node):
        if isinstance(node, dict):
            return {
                k: ("<ts>" if k in ("timestamp", "updated_at") else scrub(v))
                for k, v in node.items()
            }
        if isinstance(node, list):
            return [scrub(item) for item in node]
        return node

    return scrub(copy.deepcopy(dossier))


# --------------------------------------------------------------------------- #
# 1. Contract-shaped LoopState
# --------------------------------------------------------------------------- #
def test_loop_returns_contract_shaped_dossier():
    d = _loop()
    assert LOOP_KEYS <= set(d)

    # Assignments fan out to the approver-bound owners + the default analyst owner.
    owners = {a["owner_role"] for a in d["assignments"]}
    assert {"credit_officer", "legal", "analyst"} <= owners

    # Seeded persona decisions.
    decisions = {}
    for r in d["replies"]:
        decisions.setdefault(r["role"], set()).add(r["decision"])
    assert "sign_off" in decisions["credit_officer"]
    assert "escalate" in decisions["legal"]
    assert "acknowledge" in decisions["analyst"]

    # At least one escalation routes to compliance; at least one follow-up is scheduled.
    assert any(e["to"] == "compliance" for e in d["escalations"])
    assert len(d["scheduled"]) >= 1

    # Audit contains executed entries, and everything executed was approved + non-blocked.
    executed = _executed_indices(d)
    assert executed
    assert executed <= set(d["approved_indices"])
    for i in executed:
        assert d["plan"]["actions"][i]["blocked_reason"] is None

    assert d["closed"] is True


# --------------------------------------------------------------------------- #
# 2. Gate behavior — blocked actions never execute, even if approved
# --------------------------------------------------------------------------- #
def test_blocked_actions_never_execute_even_if_index_submitted():
    d = _loop()
    blocked = _blocked_indices(d)
    assert blocked, "scenario must include blocked actions (mosaic / missing-evidence / approval)"

    # The default approval policy excludes blocked actions.
    assert not (set(blocked) & set(d["approved_indices"]))

    # Approve EVERY index, including the blocked ones.
    n = len(d["plan"]["actions"])
    forced = _loop({**ACME, "approved_indices": list(range(n))})
    executed = _executed_indices(forced)
    assert not (executed & set(_blocked_indices(forced)))  # no blocked action ran


def test_blocked_write_action_is_not_executed_as_a_write():
    forced = _loop({**ACME, "approved_indices": list(range(6))})
    blocked_writes = [
        i for i, a in enumerate(forced["plan"]["actions"])
        if a["blocked_reason"] and a["side_effect"] == "write"
    ]
    assert blocked_writes, "expected a blocked write (e.g. status-advance gated by missing evidence)"
    assert not (_executed_indices(forced) & set(blocked_writes))


# --------------------------------------------------------------------------- #
# 3. Open-state semantics — closed != resolved
# --------------------------------------------------------------------------- #
def test_closed_means_cycle_complete_not_fully_resolved():
    d = _loop()
    assert d["closed"] is True
    # Unresolved state is represented by escalations (and remaining blocked actions), not closed.
    assert len(d["escalations"]) >= 1
    assert _blocked_indices(d)


# --------------------------------------------------------------------------- #
# 4. Determinism
# --------------------------------------------------------------------------- #
def test_identical_requests_are_deterministic_after_normalizing_timestamps():
    assert _normalize(_loop()) == _normalize(_loop())


# --------------------------------------------------------------------------- #
# 5. Explicit approved_indices
# --------------------------------------------------------------------------- #
def test_explicit_approved_subset_changes_approved_and_audit():
    base = _loop()
    non_blocked = [i for i, a in enumerate(base["plan"]["actions"]) if not a["blocked_reason"]]
    subset = non_blocked[:1]

    d = _loop({**ACME, "approved_indices": subset})
    assert d["approved_indices"] == subset
    assert _executed_indices(d) == set(subset)


def test_explicit_blocked_index_still_does_not_execute():
    base = _loop()
    blocked = _blocked_indices(base)
    assert blocked

    d = _loop({**ACME, "approved_indices": [blocked[0]]})
    assert d["approved_indices"] == [blocked[0]]
    assert blocked[0] not in _executed_indices(d)
    assert _executed_indices(d) == set()  # the only approved index was blocked → nothing ran


# --------------------------------------------------------------------------- #
# 6. Contract shape + GET convenience endpoint
# --------------------------------------------------------------------------- #
def test_dossier_subshapes_match_work_loop_surface():
    d = _loop()
    assert LOOP_KEYS <= set(d)
    for a in d["assignments"]:
        assert {"action_index", "owner_role", "tool"} <= set(a)
    for r in d["replies"]:
        assert {"role", "action_index", "decision"} <= set(r)
    for e in d["escalations"]:
        assert {"action_index", "to", "reason"} <= set(e)
    for s in d["scheduled"]:
        assert {"topic", "reason", "attendees"} <= set(s)


def test_get_api_loop_returns_the_same_shape():
    res = client.get("/api/loop", params=ACME)
    assert res.status_code == 200, res.text
    d = res.json()
    assert LOOP_KEYS <= set(d)
    assert d["closed"] is True
    # Same default-approval shape as POST without explicit approved_indices.
    assert _normalize(d) == _normalize(_loop())

"""
api/tests/test_loop_endpoint.py — the Work Loop surface (`POST /actions/loop`, `GET /api/loop`).

Proves the controlled work loop through the HTTP boundary on the Acme scenario: distribute →
collect → escalate → schedule → close with seeded stub personas, and the hard gates still holding
so a blocked action never executes — even when its index is explicitly approved. Fully offline and
deterministic: the autouse fixture enables `DEMO_DETERMINISTIC` so `StubPersonaClient` runs.

Contract note: `closed=True` means the loop CYCLE completed, NOT that every item is resolved.
'Open — escalation in flight' is derived from `escalations` + remaining blocked actions.
"""
import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.lifecycle_events import reset_lifecycle_events
from api.main import app

client = TestClient(app)

ACME = {"user_id": "u_rm", "intent": "prepare_decision_brief"}

# The keys the Work Loop surface consumes from the dossier.
LOOP_KEYS = {
    "assignments", "replies", "escalations", "scheduled", "approved_indices", "audit", "closed",
}
BASELINE = json.loads(
    (Path(__file__).parent / "fixtures" / "beats_7_8_baseline.json").read_text()
)


@pytest.fixture(autouse=True)
def _force_deterministic_demo(monkeypatch):
    """Guarantee seeded StubPersonaClient replies regardless of the ambient model environment."""
    reset_lifecycle_events()
    monkeypatch.setenv("DEMO_DETERMINISTIC", "1")
    monkeypatch.delenv("PERSONA_MODEL", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    yield
    reset_lifecycle_events()


def _loop(body: dict | None = None) -> dict:
    res = client.post("/actions/loop", json=body or ACME)
    assert res.status_code == 200, res.text
    return res.json()


def _actions() -> dict:
    res = client.get("/api/actions", params=ACME)
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


def _action_state(action: dict) -> str:
    if action["blocked_reason"]:
        return "blocked"
    if action["required_approver"]:
        return "route"
    return "ready"


def _action_baseline_projection(actions: list[dict]) -> list[dict]:
    return [
        {
            "tool": action["tool"],
            "state": _action_state(action),
            "required_approver": action["required_approver"],
            "blocked_reason": action["blocked_reason"],
        }
        for action in actions
    ]


def _select(items: list[dict], keys: tuple[str, ...]) -> list[dict]:
    return [{key: item[key] for key in keys} for item in items]


def _loop_baseline_projection(dossier: dict) -> dict:
    return {
        "assignments": _select(dossier["assignments"], ("action_index", "owner_role", "tool")),
        "replies": _select(
            dossier["replies"], ("action_index", "role", "decision", "message")
        ),
        "escalations": _select(dossier["escalations"], ("action_index", "to", "reason")),
        "scheduled": _select(dossier["scheduled"], ("topic", "reason", "attendees")),
        "approved_indices": dossier["approved_indices"],
        "closed": dossier["closed"],
    }


def _baseline_counts(actions: list[dict]) -> dict[str, int]:
    return {
        state: sum(1 for action in actions if action["state"] == state)
        for state in ("ready", "route", "blocked")
    }


# --------------------------------------------------------------------------- #
# 1. Exact Beats 7/8 API baseline
# --------------------------------------------------------------------------- #
def test_api_actions_matches_exact_beats_7_8_baseline():
    projected = _action_baseline_projection(_actions()["actions"])
    assert projected == BASELINE["actions"]
    assert _baseline_counts(projected) == {"ready": 2, "route": 2, "blocked": 2}


def test_loop_matches_exact_beats_7_8_baseline():
    d = _loop()
    assert _loop_baseline_projection(d) == BASELINE["loop"]

    escalation_targets = {e["to"] for e in d["escalations"]}
    assert escalation_targets == {"compliance", "human"}
    assert d["scheduled"][0]["reason"].startswith("3 item(s) unresolved")

    executed = _executed_indices(d)
    assert executed == set(BASELINE["loop"]["approved_indices"])
    assert executed <= set(d["approved_indices"])
    for i in executed:
        assert d["plan"]["actions"][i]["blocked_reason"] is None

    assert d["closed"] is True


def test_demo_deterministic_forces_stub_personas_when_model_env_present(monkeypatch):
    monkeypatch.setenv("DEMO_DETERMINISTIC", "1")
    monkeypatch.setenv("PERSONA_MODEL", "would-use-llm-without-demo-override")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-that-must-not-be-used")

    replies = _loop_baseline_projection(_loop())["replies"]
    assert replies == BASELINE["loop"]["replies"]


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
    assert len(d["escalations"]) == 3
    assert _blocked_indices(d) == [4, 5]


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

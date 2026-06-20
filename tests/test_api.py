"""
tests/test_api.py — smoke tests for the frontend gateway (WS-H integration).

The gateway returns contract-shaped JSON from the real pipeline; these assert the
endpoints respond and honor the deterministic gate.
"""
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"ok": True}


def test_brief_returns_contract_shaped_decision_brief():
    body = client.get("/api/brief").json()
    brief = body["decision_brief"]
    assert "decision_needed" in brief
    # The gateway never overrides the deterministic gate.
    assert brief["policy_gates"]["approval_ready"] is False
    assert body["source_count"] >= 1


def test_actions_returns_action_plan():
    body = client.get("/api/actions").json()
    assert "actions" in body and isinstance(body["actions"], list)


def test_ops_scorecard_is_three_vertical():
    sc = client.get("/api/ops/scorecard").json()
    assert {s["vertical"] for s in sc["scores"]} == {"finance", "legal", "health"}


def test_meeting_metadata():
    body = client.get("/api/meeting").json()
    assert body["user_id"] == "u_rm"
    assert body["source_count"] >= 1

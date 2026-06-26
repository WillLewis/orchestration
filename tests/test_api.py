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


def test_ops_scorecard_and_report_do_not_drift():
    scorecard = client.get("/api/ops/scorecard").json()
    report = client.get("/ops/evals").json()

    scorecard_counts = {
        row["vertical"]: (row["cases_passed"], row["cases_total"])
        for row in scorecard["scores"]
    }
    report_counts = {
        vertical: (row["passed"], row["total"])
        for vertical, row in report["vertical_scores"].items()
    }

    assert scorecard_counts == report_counts == {
        "finance": (5, 6),
        "legal": (2, 2),
        "health": (2, 2),
    }
    assert [row["case_id"] for row in report["eval_rows"] if not row["passed"]] == [
        "fin_ambig_01"
    ]


def test_meeting_metadata():
    body = client.get("/api/meeting").json()
    assert body["user_id"] == "u_rm"
    assert body["source_count"] >= 1

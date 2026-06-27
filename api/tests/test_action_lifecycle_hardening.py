from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.lifecycle_events import reset_lifecycle_events
from api.main import app

client = TestClient(app)
ACME = {"user_id": "u_rm", "intent": "prepare_decision_brief"}


@pytest.fixture(autouse=True)
def _reset_lifecycle_state():
    reset_lifecycle_events()
    yield
    reset_lifecycle_events()


def _api_brief() -> dict:
    return client.get("/api/brief").json()


def _row(row_id: str) -> dict:
    rows = _api_brief()["decision_readiness"]["rows"]
    return next(row for row in rows if row["id"] == row_id)


def _staged_body(row_id: str = "credit_officer_approval") -> dict:
    row = _row(row_id)
    action = row["action"]
    return {
        **ACME,
        "origin": {
            "surface": "decision_readiness",
            "row_id": row["id"],
            "remediation_tool": action["tool"],
            "target_object_id": action["target_object_id"],
            "required_approver": action.get("required_approver"),
        },
        "remediation": action,
        "row_gate": row["gate"],
        "row_details": row["details"],
        "source_ids": row["source_ids"],
    }


def test_valid_staged_row_composes_from_server_readiness_row():
    action = client.post("/actions/staged-remediation", json=_staged_body()).json()

    assert action["tool"] == "route_approval"
    assert action["required_approver"] == "credit_officer"
    assert action["diff"]["target_object_id"] == "doc_pricing_exception"
    assert action["blocked_reason"] is None


def test_forged_staged_remediation_returns_409():
    body = _staged_body()
    body["remediation"] = {
        **body["remediation"],
        "tool": "create_task",
        "target_object_id": "task_forged",
    }

    response = client.post("/actions/staged-remediation", json=body)

    assert response.status_code == 409
    assert "stale or mismatched" in response.json()["detail"]


def test_missing_or_non_actionable_staged_row_returns_404():
    missing = _staged_body()
    missing["origin"] = {**missing["origin"], "row_id": "not_a_current_row"}

    response = client.post("/actions/staged-remediation", json=missing)

    assert response.status_code == 404

    no_action = _staged_body()
    no_action["origin"] = {
        **no_action["origin"],
        "row_id": "dscr_calculation",
    }

    response = client.post("/actions/staged-remediation", json=no_action)

    assert response.status_code == 404


def test_staged_execute_runs_exactly_one_validated_row_action():
    response = client.post(
        "/actions/staged-remediation/execute",
        json={**_staged_body(), "approved": True},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["action"]["tool"] == "route_approval"
    assert len(payload["audit_events"]) == 1
    event = payload["audit_events"][0]
    assert event["actor"] == "executor"
    assert event["action"] == "executed"
    assert event["detail"] == {
        "index": 0,
        "tool": "route_approval",
        "target": "doc_pricing_exception",
        "before": {
            "approval_request": None,
            "requested_discount": None,
            "approval_route": None,
            "state": None,
        },
        "after": {
            "approval_request": "22% pricing exception",
            "requested_discount": "22%",
            "approval_route": "Credit Officer",
            "state": "routed",
        }
    }
    assert payload["lifecycle_state"]["routed"] is True
    assert payload["lifecycle_state"]["credit_signed"] is False


def test_staged_execute_without_approval_is_skipped_not_executed():
    response = client.post(
        "/actions/staged-remediation/execute",
        json={**_staged_body(), "approved": False},
    )

    assert response.status_code == 200
    payload = response.json()
    assert [event["action"] for event in payload["audit_events"]] == ["skipped"]
    assert payload["audit_events"][0]["detail"]["reason"] == "not approved by human"
    assert payload["lifecycle_state"]["routed"] is False


def test_api_actions_trace_back_to_readiness_rows_or_explicit_fixtures():
    readiness_rows = _api_brief()["decision_readiness"]["rows"]
    expected = {
        (
            row["action"]["tool"],
            row["action"]["target_object_id"],
            row["action"].get("required_approver"),
        )
        for row in readiness_rows
        if row.get("action")
    }
    actions = client.get("/api/actions").json()["actions"]
    actual = {
        (action["tool"], action["diff"]["target_object_id"], action.get("required_approver"))
        for action in actions
    }

    assert expected <= actual
    for action in actions:
        fingerprint = (
            action["tool"],
            action["diff"]["target_object_id"],
            action.get("required_approver"),
        )
        if fingerprint not in expected:
            assert action["reason"].startswith("Batch fixture:")


def test_brief_hides_cs_conflict_until_credit_officer_approval_return():
    initial = _api_brief()
    assert initial["decision_brief"]["conflicts"] == []
    assert initial["decision_brief"]["policy_gates"]["approval_ready"] is False
    assert "customer_success_plan_conflict" not in {
        row["id"] for row in initial["decision_readiness"]["rows"]
    }

    client.post(
        "/api/lifecycle/events",
        json={**ACME, "type": "approval_routed", "object_id": "doc_pricing_exception"},
    )
    routed = _api_brief()
    assert routed["decision_brief"]["conflicts"] == []
    assert routed["decision_readiness"]["rows"][1]["status"] == "pending"

    client.post(
        "/api/lifecycle/events",
        json={**ACME, "type": "approval_returned", "object_id": "doc_pricing_exception"},
    )
    signed = _api_brief()
    assert signed["decision_brief"]["policy_gates"]["approval_ready"] is False
    assert signed["decision_brief"]["conflicts"][0]["description"] == (
        "Pricing doc and customer success plan show different discount levels (22% vs 18%)."
    )
    rows = {row["id"]: row for row in signed["decision_readiness"]["rows"]}
    assert rows["credit_officer_approval"]["status"] == "approved"
    assert rows["customer_success_plan_conflict"]["action"] == {
        "label": "Stage: reconcile CS plan",
        "tool": "edit_document",
        "target_object_id": "doc_cs_plan",
        "parameters": {"after": {"assumed_discount": "22%"}},
    }

    client.post(
        "/api/lifecycle/events",
        json={**ACME, "type": "revalidation_applied", "object_id": "doc_cs_plan"},
    )
    reconciled = _api_brief()
    assert reconciled["decision_brief"]["conflicts"] == []
    assert "customer_success_plan_conflict" not in {
        row["id"] for row in reconciled["decision_readiness"]["rows"]
    }

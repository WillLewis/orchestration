"""
api/tests/test_workproducts.py — governed-record mint + verify (`/workproducts/*`).

Proves through the HTTP boundary on the Acme scenario that sealing produces an honest, verifiable
governed record, and that the three trust axes stay independent: integrity (the HMAC seal),
freshness (WS-F revalidation against a source change), and approval-readiness (the deterministic
gate, which stays NOT-ready). Fully offline/deterministic — the autouse fixture strips ambient LLM
env and `WORKPRODUCT_SECRET` so the demo HMAC fallback key is exercised.
"""
import pytest
from fastapi.testclient import TestClient

import api.workproducts as workproducts
from api.main import app

client = TestClient(app)

ACME = {"user_id": "u_rm", "intent": "prepare_decision_brief"}


@pytest.fixture(autouse=True)
def _force_offline(monkeypatch):
    """Deterministic + offline, and force the dev-default seal key (no ambient secret)."""
    monkeypatch.delenv("PERSONA_MODEL", raising=False)
    monkeypatch.delenv("PLANNER_MODEL", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("WORKPRODUCT_SECRET", raising=False)


def _mint() -> dict:
    res = client.post("/workproducts/mint", json=ACME)
    assert res.status_code == 200, res.text
    return res.json()


def _verify(record_id: str, event: str | None) -> dict:
    res = client.post(f"/workproducts/{record_id}/verify", json={"event": event})
    assert res.status_code == 200, res.text
    return res.json()


# --------------------------------------------------------------------------- #
# Mint: honest by construction
# --------------------------------------------------------------------------- #
def test_mint_not_approval_ready_and_stamped():
    gov = _mint()["record"]["governance"]
    assert gov["approval_ready"] is False
    assert gov["approval_stamp"] == "NOT APPROVAL-READY"
    assert gov["approval_reason"]  # non-empty, derived from the failing gate firings


def test_mint_omits_restricted_legal_memo():
    record = _mint()["record"]
    omitted = {o["object_id"] for o in record["governance"]["permission_omissions"]}
    source_ids = {s["object_id"] for s in record["sources"]}
    assert "doc_legal_memo" in omitted          # surfaced by name as an omission
    assert "doc_legal_memo" not in source_ids   # never an evidence source


def test_source_versions_carry_workflow_metadata():
    versions = {s["object_id"]: s for s in _mint()["record"]["governance"]["source_versions"]}
    assert "wf_approval" in versions
    assert versions["wf_approval"]["metadata"]["legal_status"] == "pending"


def test_mint_is_deterministic():
    # Equal hashes across two mints (NOT a hardcoded digest — float/env portability).
    assert _mint()["record"]["governance"]["seal"]["payload_hash"] == (
        _mint()["record"]["governance"]["seal"]["payload_hash"]
    )


def test_mint_triggers_no_loop_side_effects():
    record = _mint()["record"]
    # The record is a decision artifact, not an execution log — no actions/audit/loop output.
    assert "audit" not in record
    assert "actions" not in record
    assert record["governance"]["loop_summary"] is None


# --------------------------------------------------------------------------- #
# Verify: three independent axes
# --------------------------------------------------------------------------- #
def test_verify_detects_staleness_and_routes_to_legal():
    record_id = _mint()["record_id"]
    v = _verify(record_id, "legal_needs_review")

    assert v["integrity_valid"] is True          # still authentic
    assert v["freshness"] == "stale"             # but no longer current
    assert v["approval_ready"] is False          # gate unchanged

    changed = {c["field"]: c for c in v["changed_sources"] if c["object_id"] == "wf_approval"}
    assert changed["legal_status"]["before"] == "pending"
    assert changed["legal_status"]["after"] == "Needs Review"

    stale = {s["section"] for s in v["stale_sections"] if s["stale"]}
    assert {"policy_gates", "required_approvals"} <= stale
    assert v["reapproval_routes"]
    assert all(r["approver_role"] == "legal" for r in v["reapproval_routes"])


def test_verify_no_event_is_current():
    record_id = _mint()["record_id"]
    v = _verify(record_id, None)
    assert v["integrity_valid"] is True
    assert v["freshness"] == "current"
    assert v["changed_sources"] == []


def test_verify_tamper_breaks_integrity():
    record_id = _mint()["record_id"]
    # Tamper the sealed bytes in the store; the HMAC must no longer match.
    workproducts._STORE[record_id].canonical_bytes += b" tampered"
    assert _verify(record_id, None)["integrity_valid"] is False


def test_verify_financials_event_changes_financials():
    record_id = _mint()["record_id"]
    v = _verify(record_id, "financials_v2")
    fields = {c["field"] for c in v["changed_sources"] if c["object_id"] == "doc_financials"}
    assert "revenue_forecast" in fields


def test_verify_unknown_event_rejected():
    record_id = _mint()["record_id"]
    assert client.post(f"/workproducts/{record_id}/verify", json={"event": "nope"}).status_code == 422


# --------------------------------------------------------------------------- #
# Get
# --------------------------------------------------------------------------- #
def test_get_returns_record_then_verification():
    record_id = _mint()["record_id"]
    pre = client.get(f"/workproducts/{record_id}")
    assert pre.status_code == 200, pre.text
    assert pre.json()["verification"] is None
    _verify(record_id, "legal_needs_review")
    assert client.get(f"/workproducts/{record_id}").json()["verification"]["freshness"] == "stale"


def test_get_unknown_returns_404():
    assert client.get("/workproducts/does_not_exist").status_code == 404

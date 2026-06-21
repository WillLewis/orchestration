"""
api/tests/test_e2e.py — the Acme end-to-end capstone.

Proves the LIVE composed pipeline (not stubs) through the HTTP boundary: permission filtering,
the mosaic / information-barrier gate, the missing-evidence gate, gate-override impossibility,
lifecycle revalidation, and the three-vertical eval proof — plus shape-conformance with the
frontend data modules. Fully offline: no LLM, no network (FastAPI TestClient over the app).
"""
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)

ACME = {"user_id": "u_rm", "intent": "prepare_decision_brief"}

# Frontend mock key sets (from frontend/src/data/*.ts) the live responses must stay compatible
# with. The API may be a SUPERSET (e.g. DecisionBrief adds source_map); it must not be missing keys.
BRIEF_KEYS = {  # frontend/src/data/brief.ts → decision_brief
    "decision_needed", "executive_summary", "what_changed", "key_facts", "policy_gates",
    "required_approvals", "missing_evidence", "conflicts", "open_questions", "next_steps",
    "permission_limitations", "confidence",
}
ACTION_KEYS = {  # frontend/src/data/actions.ts → Action
    "tool", "reason", "sources", "side_effect", "risk", "required_approver",
    "blocked_reason", "diff",
}
OPS_KEYS = {  # frontend/src/data/ops.ts exports consumed by Agent Ops
    "vertical_scores", "eval_rows", "telemetry_sample", "eval_source_mix", "failure_taxonomy",
}


# --------------------------------------------------------------------------- #
# Health
# --------------------------------------------------------------------------- #
def test_health():
    assert client.get("/api/health").json() == {"ok": True}


# --------------------------------------------------------------------------- #
# 1. /brief — permission, missing evidence, conflict, gate not overridden
# --------------------------------------------------------------------------- #
def test_brief_is_not_approval_ready_and_grounded():
    brief = client.post("/brief", json=ACME).json()

    # The deterministic gate is authoritative and not overridden by the LLM layer.
    assert brief["policy_gates"]["approval_ready"] is False

    # A user without permission never sees the restricted legal memo in the source map.
    source_ids = [s["object_id"] for s in brief["source_map"]]
    assert "doc_legal_memo" not in source_ids

    # Missing evidence is surfaced honestly, not hallucinated away.
    codes = [m["code"] for m in brief["missing_evidence"]]
    assert "missing_covenant_tracker" in codes

    # The pricing/discount conflict is flagged.
    conflict_text = " ".join(c["description"].lower() for c in brief["conflicts"])
    assert "discount" in conflict_text or "pricing" in conflict_text


# --------------------------------------------------------------------------- #
# 2. /actions/compose — mosaic, missing-evidence, approval-routing gates
# --------------------------------------------------------------------------- #
def test_compose_surfaces_every_gate():
    actions = client.post("/actions/compose", json=ACME).json()["actions"]
    blocked = [a["blocked_reason"] for a in actions if a["blocked_reason"]]

    # Mosaic / information-barrier-risk action is blocked.
    assert any("mosaic" in (r or "") for r in blocked)
    # Missing-evidence-dependent action is blocked.
    assert any("missing_evidence" in (r or "") for r in blocked)
    # Approval-routing actions are READY to send — routing obtains the sign-off, so a route is
    # never blocked on the approver it routes to.
    routes = [a for a in actions if a["tool"] == "route_approval"]
    assert routes
    assert all(a["blocked_reason"] is None for a in routes)


# --------------------------------------------------------------------------- #
# 3. /actions/execute — approved runs, blocked never runs (gate override impossible)
# --------------------------------------------------------------------------- #
def test_execute_runs_only_approved_non_blocked_actions():
    actions = client.post("/actions/compose", json=ACME).json()["actions"]
    non_blocked = [i for i, a in enumerate(actions) if not a["blocked_reason"]]
    blocked = [i for i, a in enumerate(actions) if a["blocked_reason"]]
    assert non_blocked and blocked, "scenario must have both runnable and blocked actions"

    # A human (mistakenly) approves EVERY index, including the blocked ones.
    body = {**ACME, "approved_indices": list(range(len(actions)))}
    audit = client.post("/actions/execute", json=body).json()

    executed = {e["detail"]["index"] for e in audit if e["action"] == "executed"}
    skipped = {e["detail"]["index"] for e in audit if e["action"] == "skipped"}

    # Approved, non-blocked actions executed.
    assert executed == set(non_blocked)
    # Every blocked action was refused despite being approved — a gate is never overridden.
    assert set(blocked) <= skipped
    assert not (executed & set(blocked))


def test_execute_nothing_when_human_approves_nothing():
    body = {**ACME, "approved_indices": []}
    audit = client.post("/actions/execute", json=body).json()
    assert not any(e["action"] == "executed" for e in audit)


# --------------------------------------------------------------------------- #
# 4. /revalidate — legal_needs_review marks approval sections stale + routes to legal
# --------------------------------------------------------------------------- #
def test_revalidate_marks_approval_sections_stale_and_routes_to_legal():
    body = {**ACME, "changed_object_id": "wf_approval", "event": "legal_needs_review"}
    result = client.post("/revalidate", json=body).json()

    stale = {s["section"] for s in result["stale_sections"] if s["stale"]}
    assert {"policy_gates", "required_approvals"} <= stale

    routes = result["reapproval_routes"]
    assert routes
    assert all(r["approver_role"] == "legal" for r in routes)
    assert {r["section"] for r in routes} == {"policy_gates", "required_approvals"}


# --------------------------------------------------------------------------- #
# 5. /ops/evals — three verticals pass threshold; the honest failure stays visible
# --------------------------------------------------------------------------- #
def test_ops_three_verticals_pass_and_honest_failure_visible():
    ops = client.get("/ops/evals").json()

    # Three verticals, each above the 0.8 pass threshold.
    scores = ops["vertical_scores"]
    assert set(scores) == {"finance", "legal", "health"}
    for vertical in ("finance", "legal", "health"):
        passed, total = scores[vertical]["passed"], scores[vertical]["total"]
        assert passed / total >= 0.8
    assert ops["overall_passed"] is True

    # The one intentional honest failure remains visible (not hidden to make the demo green).
    failing = [r for r in ops["eval_rows"] if not r["passed"]]
    assert len(failing) == 1
    assert failing[0]["case_id"] == "fin_ambig_01"

    # Failure taxonomy reflects the visible failure.
    assert sum(e["count"] for e in ops["failure_taxonomy"]) >= 1


# --------------------------------------------------------------------------- #
# 6. Shape conformance with the frontend data modules
# --------------------------------------------------------------------------- #
def test_brief_shape_matches_frontend_mock():
    brief = client.post("/brief", json=ACME).json()
    # Domain endpoint stays core.schemas-shaped: a superset of the frontend mock keys.
    assert BRIEF_KEYS <= set(brief)


def test_action_shape_matches_frontend_mock():
    actions = client.post("/actions/compose", json=ACME).json()["actions"]
    assert actions
    for a in actions:
        assert set(a) == ACTION_KEYS
        assert {"target_object_id", "before", "after"} <= set(a["diff"])


def test_ops_shape_matches_frontend_mock():
    ops = client.get("/ops/evals").json()
    # Agent Ops uses the api.models.OpsReport aggregate.
    assert OPS_KEYS <= set(ops)
    a_vertical = next(iter(ops["vertical_scores"].values()))
    assert {"recipe", "passed", "total", "metrics", "proves"} <= set(a_vertical)
    assert {"case_id", "vertical", "description", "check", "kind", "passed"} <= set(
        ops["eval_rows"][0]
    )


def test_domain_endpoints_are_core_schema_shaped():
    # /context and /verify return raw core.schemas models (debugging surfaces).
    ctx = client.post("/context", json=ACME).json()
    assert {"user_id", "intent", "sources", "permission_boundary", "missing_evidence"} <= set(ctx)
    decision = client.post("/verify", json=ACME).json()
    assert {"approval_ready", "firings", "approvals"} <= set(decision)

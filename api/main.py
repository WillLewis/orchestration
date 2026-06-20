"""
api/main.py — FastAPI gateway over the LIVE composed pipeline.

Replaces the old `core.demo` stub wiring: every endpoint now calls `api.orchestrator`, which
composes the real merged stages (WS-B context · WS-C verify · WS-D brief · WS-E actions ·
WS-F revalidation · WS-G/WS-I evals). No LLM calls, no network — fully deterministic/offline.

Responses are `core.schemas` Pydantic models (or `lifecycle.RevalidationResult` /
`api.models.OpsReport` aggregates) dumped to snake_case JSON — exactly the shape the frontend
mocks mirror, so the React Query hooks fetch live with no remapping.

Canonical integration endpoints:
    POST /brief · /context · /verify · /actions/compose · /actions/execute · /revalidate
    GET  /ops/evals · /api/health
The `GET /api/*` endpoints are real-backed compatibility shims for the currently-wired
frontend (`frontend/src/hooks/queries.ts`) until the live-data prompt repoints it.

Run with `make api` (uvicorn, port 8000); export the schema with `make openapi`.
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.schemas import (
    ActionPlan,
    AuditEvent,
    ContextBundle,
    DecisionBrief,
    DeterministicDecision,
)
from evals import build_scorecard
from lifecycle.revalidation import RevalidationResult

from api.models import BriefRequest, ExecuteRequest, OpsReport, RevalidateRequest
from api.orchestrator import (
    assemble_brief,
    assemble_context,
    compose_actions,
    compose_and_execute,
    default_action_plan,
    ops_report,
    run_revalidation,
    verify_context,
)

app = FastAPI(title="ConnectWork Command Agent — gateway", version="0.2.0")

# CORS: the Vite dev server (default 5173), any localhost port, an explicit `FRONTEND_ORIGIN`
# override, and the hosted Lovable demo.
_FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_FRONTEND_ORIGIN, "https://govern-meeting-view.lovable.app"],
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Health
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Decision brief: WS-B → WS-C → WS-D
# --------------------------------------------------------------------------- #
@app.post("/brief", response_model=DecisionBrief)
def post_brief(req: BriefRequest) -> DecisionBrief:
    """The DecisionBrief. `policy_gates` is the deterministic decision passed through untouched —
    the LLM layer never marks a brief approval-ready (the Acme case stays approval_ready=False)."""
    brief, _ = assemble_brief(req.user_id, req.intent)
    return brief


@app.post("/context", response_model=ContextBundle)
def post_context(req: BriefRequest) -> ContextBundle:
    """The permission-filtered ContextBundle (debugging aid)."""
    return assemble_context(req.user_id, req.intent)


@app.post("/verify", response_model=DeterministicDecision)
def post_verify(req: BriefRequest) -> DeterministicDecision:
    """The authoritative deterministic decision (debugging aid)."""
    return verify_context(assemble_context(req.user_id, req.intent))


# --------------------------------------------------------------------------- #
# Safe action composer + executor: WS-E
# --------------------------------------------------------------------------- #
@app.post("/actions/compose", response_model=ActionPlan)
def post_actions_compose(req: BriefRequest) -> ActionPlan:
    """Proposed follow-ups; every action carries a previewable diff or a `blocked_reason`."""
    brief, bundle = assemble_brief(req.user_id, req.intent)
    return compose_actions(brief, bundle)


@app.post("/actions/execute", response_model=list[AuditEvent])
def post_actions_execute(req: ExecuteRequest) -> list[AuditEvent]:
    """Execute only approved, non-blocked actions. The plan is recomposed server-side, so a
    blocked action is never executed even if its index is submitted as approved."""
    return compose_and_execute(req.user_id, req.intent, req.approved_indices)


# --------------------------------------------------------------------------- #
# Lifecycle revalidation: WS-F
# --------------------------------------------------------------------------- #
@app.post("/revalidate", response_model=RevalidationResult)
def post_revalidate(req: RevalidateRequest) -> RevalidationResult:
    """Stale sections + reapproval routes for a source-change event (e.g. `legal_needs_review`
    on `wf_approval` → approval sections stale, reapproval routed to legal)."""
    return run_revalidation(req.user_id, req.intent, req.changed_object_id, req.event)


# --------------------------------------------------------------------------- #
# Agent Ops: WS-I three-vertical scorecard + WS-G telemetry
# --------------------------------------------------------------------------- #
@app.get("/ops/evals", response_model=OpsReport)
def get_ops_evals() -> OpsReport:
    """The three-vertical scorecard + telemetry sample + source mix + failure taxonomy."""
    return OpsReport.model_validate(ops_report())


# --------------------------------------------------------------------------- #
# Compatibility shims for the currently-wired frontend (real-backed, GET).
# --------------------------------------------------------------------------- #
@app.get("/api/brief")
def api_brief(user_id: str = "u_rm", intent: str = "prepare_decision_brief") -> dict:
    brief, bundle = assemble_brief(user_id, intent)
    return {
        "decision_brief": brief.model_dump(mode="json"),
        "source_count": len(bundle.sources),
    }


@app.get("/api/actions")
def api_actions(user_id: str = "u_rm", intent: str = "prepare_decision_brief") -> dict:
    """The composed ActionPlan (typed diffs; blocked actions carry a `blocked_reason`)."""
    return default_action_plan(user_id, intent).model_dump(mode="json")


@app.get("/api/meeting")
def api_meeting(user_id: str = "u_rm", intent: str = "prepare_decision_brief") -> dict:
    bundle = assemble_context(user_id, intent)
    return {
        "user_id": bundle.user_id,
        "intent": bundle.intent,
        "source_count": len(bundle.sources),
        "excluded_object_ids": bundle.permission_boundary.excluded_object_ids,
    }


@app.get("/api/ops/scorecard")
def api_ops_scorecard() -> dict:
    """The core WS-G three-vertical RecipeScorecard (finance + legal + health)."""
    return build_scorecard().model_dump(mode="json")

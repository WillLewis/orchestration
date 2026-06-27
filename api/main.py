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

from actions.loop import LoopState
from core.schemas import (
    Action,
    ActionPlan,
    AuditEvent,
    ContextBundle,
    DecisionBrief,
    DeterministicDecision,
)
from evals import build_scorecard
from lifecycle.revalidation import RevalidationResult

from api.chat import answer as chat_answer
from api.docs_chat import answer as docs_chat_answer
from api.lifecycle_events import (
    lifecycle_state,
    record_lifecycle_event,
    reset_lifecycle_events,
)
from api.models import (
    BriefRequest,
    ChatRequest,
    ChatResponse,
    DocsChatRequest,
    DocsChatResponse,
    ExecuteRequest,
    GovernedRecord,
    LifecycleEvent,
    LifecycleState,
    LoopRequest,
    MintRecordRequest,
    MintResponse,
    OpsReport,
    RecordVerification,
    RevalidateRequest,
    StagedRemediationExecuteRequest,
    StagedRemediationExecuteResponse,
    StagedRemediationRequest,
    VerifyRecordRequest,
)
from api.orchestrator import (
    assemble_brief,
    assemble_context,
    compose_actions,
    compose_and_execute,
    compose_and_execute_staged_remediation,
    compose_staged_remediation,
    default_action_plan,
    ops_report,
    rulepack_meta,
    run_loop,
    run_revalidation,
    verify_context,
)
from api.presentation import build_decision_readiness, build_display_brief
from api.staged_remediation import verified_staged_remediation
from api.workproducts import get as get_workproduct
from api.workproducts import mint as mint_workproduct
from api.workproducts import verify as verify_workproduct
from telemetry.docs_chat import DocsChatTelemetrySummary, docs_chat_telemetry_snapshot

app = FastAPI(title="ConnectWork Command Agent — gateway", version="0.2.0")

# CORS: the Vite dev server (default 5173), local dev hosts, an explicit `FRONTEND_ORIGIN`
# override, and the hosted Lovable demo.
_FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_FRONTEND_ORIGIN, "https://govern-meeting-view.lovable.app"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
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
# Governed chat: answer over the permission-filtered ContextBundle (WS-B → WS-C)
# --------------------------------------------------------------------------- #
@app.post("/chat", response_model=ChatResponse)
def post_chat(req: ChatRequest) -> ChatResponse:
    """Answer a question about the meeting/decision using ONLY the permission-filtered bundle.

    The LLM may draft prose, but the wrapper owns governance deterministically: restricted sources
    are refused (never revealed), the deterministic gate can't be overridden, citations are
    validated against the bundle, and missing evidence is surfaced honestly. Offline/deterministic
    by default (no API key); history is untrusted context, never evidence."""
    return chat_answer(req.user_id, req.intent, req.message, req.history)


@app.post("/docs/chat", response_model=DocsChatResponse)
def post_docs_chat(req: DocsChatRequest) -> DocsChatResponse:
    """Answer over the documentation corpus with ACL enforced before drafting.

    Tier-3 raw bodies and sealed raw bodies never reach the model view. The wrapper validates every
    citation, emits sealed `cleared_derivative` text only, and returns locked-source access metadata
    without revealing restricted content.
    """
    return docs_chat_answer(req.surface, req.message, req.history, mode=req.mode)


# --------------------------------------------------------------------------- #
# Safe action composer + executor: WS-E
# --------------------------------------------------------------------------- #
@app.post("/actions/compose", response_model=ActionPlan)
def post_actions_compose(req: BriefRequest) -> ActionPlan:
    """Agent Actions; every action carries a previewable diff or a `blocked_reason`."""
    brief, bundle = assemble_brief(req.user_id, req.intent)
    return compose_actions(brief, bundle)


@app.post("/actions/staged-remediation", response_model=Action)
def post_actions_staged_remediation(req: StagedRemediationRequest) -> Action:
    """Validate one staged Decision Brief row remediation into one drawer card.

    This endpoint is the anti-drift seam: the card comes from the row's remediation descriptor
    passed through the deterministic action composer, not a separately authored follow-up list.
    """
    brief, bundle = assemble_brief(req.user_id, req.intent)
    remediation = verified_staged_remediation(req, brief, bundle)
    return compose_staged_remediation(brief, bundle, remediation)


@app.post("/actions/staged-remediation/execute", response_model=StagedRemediationExecuteResponse)
def post_actions_staged_remediation_execute(
    req: StagedRemediationExecuteRequest,
) -> StagedRemediationExecuteResponse:
    """Execute exactly one staged Decision Brief row remediation by origin."""
    brief, bundle = assemble_brief(req.user_id, req.intent)
    remediation = verified_staged_remediation(req, brief, bundle)
    action, audit_events = compose_and_execute_staged_remediation(
        brief,
        bundle,
        remediation,
        approved=req.approved,
    )
    if _executed_credit_officer_route(audit_events):
        state = record_lifecycle_event(
            "approval_routed",
            user_id=req.user_id,
            intent=req.intent,
            object_id=action.diff.target_object_id if action.diff else None,
            detail={"row_id": remediation.row_id, "tool": action.tool},
        )
    elif _executed_cs_plan_reconciliation(audit_events):
        state = record_lifecycle_event(
            "revalidation_applied",
            user_id=req.user_id,
            intent=req.intent,
            object_id=action.diff.target_object_id if action.diff else None,
            detail={"row_id": remediation.row_id, "tool": action.tool},
        )
    else:
        state = lifecycle_state(user_id=req.user_id, intent=req.intent)
    return StagedRemediationExecuteResponse(
        action=action,
        audit_events=audit_events,
        lifecycle_state=state,
    )


@app.post("/actions/execute", response_model=list[AuditEvent])
def post_actions_execute(req: ExecuteRequest) -> list[AuditEvent]:
    """Execute only approved, non-blocked actions. The plan is recomposed server-side, so a
    blocked action is never executed even if its index is submitted as approved."""
    events = compose_and_execute(req.user_id, req.intent, req.approved_indices)
    if _executed_credit_officer_route(events):
        record_lifecycle_event(
            "approval_routed",
            user_id=req.user_id,
            intent=req.intent,
            object_id="doc_pricing_exception",
            detail={"tool": "route_approval"},
        )
    return events


def _executed_credit_officer_route(events: list[AuditEvent]) -> bool:
    return any(
        event.action == "executed"
        and event.detail.get("tool") == "route_approval"
        and event.detail.get("target") == "doc_pricing_exception"
        for event in events
    )


def _executed_cs_plan_reconciliation(events: list[AuditEvent]) -> bool:
    return any(
        event.action == "executed"
        and event.detail.get("tool") == "edit_document"
        and event.detail.get("target") == "doc_cs_plan"
        for event in events
    )


@app.get("/api/lifecycle", response_model=LifecycleState)
def api_lifecycle(
    user_id: str = "u_rm",
    intent: str = "prepare_decision_brief",
) -> LifecycleState:
    return lifecycle_state(user_id=user_id, intent=intent)


@app.post("/api/lifecycle/events", response_model=LifecycleState)
def api_lifecycle_events(event: LifecycleEvent) -> LifecycleState:
    return record_lifecycle_event(
        event.type,
        user_id=event.user_id,
        intent=event.intent,
        object_id=event.object_id,
        detail=event.detail,
    )


@app.post("/api/lifecycle/reset", response_model=LifecycleState)
def api_lifecycle_reset() -> LifecycleState:
    return reset_lifecycle_events()


# --------------------------------------------------------------------------- #
# Controlled work loop: WS-E (distribute → collect → escalate → schedule → close)
# --------------------------------------------------------------------------- #
# `LoopState` is a Pydantic v2 model (all fields are Pydantic models / primitives), so FastAPI
# accepts it directly as a response_model — no api-only mirror needed.
@app.post("/actions/loop", response_model=LoopState)
def post_actions_loop(req: LoopRequest) -> LoopState:
    """Run the controlled work loop and return the dossier (assignments · replies · escalations ·
    scheduled · approved_indices · audit · closed, plus bundle/brief/plan).

    NOTE: `closed=True` means the loop CYCLE completed — not that every item is resolved. Derive
    'Open — escalation in flight' from `escalations` + any remaining blocked actions, not `closed`.
    """
    return run_loop(req.user_id, req.intent, req.approved_indices)


@app.get("/api/loop", response_model=LoopState)
def api_loop(user_id: str = "u_rm", intent: str = "prepare_decision_brief") -> LoopState:
    """Convenience GET: same dossier as `POST /actions/loop` with the loop's default approval
    (`approve_nonblocked`); `closed` still means cycle-completed, not fully-resolved."""
    return run_loop(user_id, intent, None)


# --------------------------------------------------------------------------- #
# Lifecycle revalidation: WS-F
# --------------------------------------------------------------------------- #
@app.post("/revalidate", response_model=RevalidationResult)
def post_revalidate(req: RevalidateRequest) -> RevalidationResult:
    """Stale sections + reapproval routes for a source-change event (e.g. `legal_needs_review`
    on `wf_approval` → approval sections stale, reapproval routed to legal)."""
    return run_revalidation(req.user_id, req.intent, req.changed_object_id, req.event)


# --------------------------------------------------------------------------- #
# Governed record: seal + verify (the governed work product, made literal)
# --------------------------------------------------------------------------- #
@app.post("/workproducts/mint", response_model=MintResponse)
def post_workproduct_mint(req: MintRecordRequest) -> MintResponse:
    """Seal the decision packet into a governed record: decision + gate results + evidence +
    permission omissions + a source-version snapshot + a server-minted HMAC integrity seal. Honest
    by construction — the Acme record stays `approval_ready=False`. Runs no actions and no loop."""
    return mint_workproduct(req.user_id, req.intent)


@app.get("/workproducts/{record_id}", response_model=GovernedRecord)
def get_workproduct_record(record_id: str) -> GovernedRecord:
    """Fetch a sealed governed record (with its latest verification, if any). 404 if unknown."""
    return get_workproduct(record_id)


@app.post("/workproducts/{record_id}/verify", response_model=RecordVerification)
def post_workproduct_verify(record_id: str, req: VerifyRecordRequest) -> RecordVerification:
    """Re-check a record against current sources on three independent axes: integrity (HMAC),
    freshness (WS-F revalidation), approval-readiness. A change event (e.g. `legal_needs_review`)
    flips freshness to `stale` and routes reapproval to Legal — the record discovers the change."""
    return verify_workproduct(record_id, req.event)


# --------------------------------------------------------------------------- #
# Agent Ops: WS-I three-vertical scorecard + WS-G telemetry
# --------------------------------------------------------------------------- #
@app.get("/ops/evals", response_model=OpsReport)
def get_ops_evals() -> OpsReport:
    """The three-vertical scorecard + telemetry sample + source mix + failure taxonomy."""
    return OpsReport.model_validate(ops_report())


@app.get("/ops/docs-chat", response_model=DocsChatTelemetrySummary)
def get_ops_docs_chat() -> DocsChatTelemetrySummary:
    """Aggregate docs-chat LLM observability with no raw prompts, answers, or documents."""
    return docs_chat_telemetry_snapshot()


# --------------------------------------------------------------------------- #
# Compatibility shims for the currently-wired frontend (real-backed, GET).
# --------------------------------------------------------------------------- #
@app.get("/api/brief")
def api_brief(user_id: str = "u_rm", intent: str = "prepare_decision_brief") -> dict:
    brief, bundle = assemble_brief(user_id, intent)
    state = lifecycle_state(user_id=user_id, intent=intent)
    display_brief = build_display_brief(brief, bundle, state)
    readiness = build_decision_readiness(brief, bundle, state)
    rulepack_id, rulepack_version = rulepack_meta()
    return {
        "decision_brief": display_brief.model_dump(mode="json"),
        "decision_readiness": readiness.model_dump(mode="json", exclude_none=True),
        "lifecycle_state": state.model_dump(mode="json"),
        "source_count": len(bundle.sources),
        "rulepack_id": rulepack_id,
        "rulepack_version": rulepack_version,
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
    """Core-schema projection of the canonical Ops three-vertical scorecard."""
    return build_scorecard().model_dump(mode="json")

"""
api/main.py — thin HTTP gateway over the pipeline for the vendored frontend (WS-H).

Serves contract-shaped JSON: every response is a `core.schemas` Pydantic model dumped to
JSON, which is exactly the snake_case shape the frontend mocks already mirror — so the
frontend's React Query hooks can fetch live with no remapping.

The frontend defaults to its bundled mocks for Lovable parity; set `VITE_USE_MOCKS=false`
and `VITE_API_URL=http://localhost:8000` to fetch from here instead. Run with `make serve`.

Backed by the real merged pipeline (WS-A corpus, WS-B context, WS-C verify, WS-G evals);
not-yet-merged stages (WS-D brief, WS-E actions) come from the WS-0 stubs via `core.demo`,
so brief/actions are less rich than the Lovable demo copy until those streams land.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.demo import run_demo
from evals import build_scorecard

app = FastAPI(title="ConnectWork Command Agent — gateway", version="0.1.0")

# Frontend dev origins + the Lovable deployment. The regex covers any localhost port
# (Vite/TanStack Start pick 8080/8091/etc.); the explicit entry covers the hosted demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://govern-meeting-view.lovable.app"],
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/brief")
def brief(user_id: str = "u_rm", intent: str = "prepare_decision_brief") -> dict:
    """Run intent -> context -> verify -> brief and return the DecisionBrief.

    `policy_gates` is the deterministic decision passed through untouched; the LLM layer
    never marks a brief approval-ready (the Acme case stays approval_ready=False).
    """
    result = run_demo(user_id, intent)
    return {
        "decision_brief": result["brief"].model_dump(mode="json"),
        "source_count": len(result["bundle"].sources),
    }


@app.get("/api/actions")
def actions() -> dict:
    """The proposed ActionPlan (typed diffs; nothing executes without approval)."""
    return run_demo()["plan"].model_dump(mode="json")


@app.get("/api/ops/scorecard")
def ops_scorecard() -> dict:
    """The real WS-G three-vertical RecipeScorecard (finance + legal + health)."""
    return build_scorecard().model_dump(mode="json")


@app.get("/api/meeting")
def meeting(user_id: str = "u_rm", intent: str = "prepare_decision_brief") -> dict:
    """Minimal meeting/context metadata for the side panel."""
    bundle = run_demo(user_id, intent)["bundle"]
    return {
        "user_id": bundle.user_id,
        "intent": bundle.intent,
        "source_count": len(bundle.sources),
        "excluded_object_ids": bundle.permission_boundary.excluded_object_ids,
    }

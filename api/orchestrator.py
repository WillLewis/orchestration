"""
api/orchestrator.py — the real pipeline orchestrator (replaces the `core.demo` stub wiring).

Composes the LIVE merged stages behind the API boundary — no LLM calls, no network, all
deterministic/offline:

    intent → WS-B ContextAssembler → WS-C Verifier → WS-D BriefSynthesizer
           → WS-E ActionComposer → (human approval) → WS-E Executor
           → WS-F RevalidationEngine        (the /revalidate path)
           → WS-I three-vertical + WS-G telemetry   (the /ops/evals path)

Workspace note: the brief is assembled over the canonical `fixtures.acme` workspace (the hero
scenario the whole repo pins to — it surfaces the missing covenant tracker, the discount
conflict, and the restricted legal-memo exclusion). Action validation runs against the richer
WS-A `corpus.load("finance")` workspace, which carries both information-barrier sides
(`doc_financials`=private, `doc_research_publicside`=public) so the mosaic gate is exercised.
Both describe the same Acme finance scenario with consistent object ids.

This module only IMPORTS and composes the workstreams; it never reimplements a gate. The
deterministic engine remains authoritative — a model/LLM never owns a pass/fail decision, and
`/actions/execute` recomposes the gated plan server-side so a client can't bypass a gate.
"""
from __future__ import annotations

import os
from collections.abc import Mapping

from actions.composer import SafeActionComposer, StagedRemediation
from actions.engine import ActionValidationEngine, WorkspaceExecutor
from actions.loop import ControlledWorkLoop, LoopState
from actions.personas import LLMPersonaClient, PersonaClient, StubPersonaClient
from brief.synthesizer import GroundedBriefSynthesizer
from context.assembler import PermissionAwareContextAssembler
from core.schemas import (
    Action,
    ActionDiff,
    ActionPlan,
    AuditEvent,
    ContextBundle,
    DecisionBrief,
    DeterministicDecision,
    SourceRef,
    TelemetryEvent,
    WorkProductContract,
    WorkspaceObject,
)
from corpus import apply_change, load
from evals.packs import FINANCE_PACK_ID
from evals.runner import EvalHarnessRunner
from evals.telemetry_emit import InMemorySink
from lifecycle.revalidation import (
    RevalidationResult,
    build_dependency_graph,
    on_source_change,
)
from recipes.catalog import EvalRow, run_three_vertical
from verification.engine import DeterministicVerifier
from verification.rulepacks import get_rulepack

RULEPACK_ID = "finance_credit_v1"
FINANCE_VERTICAL = "finance"


def rulepack_meta() -> tuple[str, int]:
    """The active rulepack id + version, so a brief/record can be stamped "decided by <rulepack>"
    — the deterministic authority, never the model."""
    rulepack = get_rulepack(RULEPACK_ID)
    return rulepack.id, rulepack.version


# --------------------------------------------------------------------------- #
# Singletons (cheap, stateless, deterministic)
# --------------------------------------------------------------------------- #
_assembler = PermissionAwareContextAssembler()
_verifier = DeterministicVerifier()
_synthesizer = GroundedBriefSynthesizer()

_TRUTHY_ENV_VALUES = {"1", "true", "yes", "on"}


def _action_workspace() -> list[WorkspaceObject]:
    """Fresh, mutable corpus workspace for action validation/execution (both barrier sides)."""
    return load(FINANCE_VERTICAL)


# --------------------------------------------------------------------------- #
# Brief assembly: WS-B → WS-C → WS-D
# --------------------------------------------------------------------------- #
def assemble_context(user_id: str, intent: str) -> ContextBundle:
    """WS-B: permission-filtered, grounded ContextBundle."""
    return _assembler.assemble(user_id, intent)


def verify_context(bundle: ContextBundle) -> DeterministicDecision:
    """WS-C: the authoritative deterministic decision (owns every pass/fail)."""
    return _verifier.verify(bundle, RULEPACK_ID)


def assemble_brief(user_id: str, intent: str) -> tuple[DecisionBrief, ContextBundle]:
    """Run intent → context → verify → brief. The gate is copied into the brief untouched."""
    bundle = assemble_context(user_id, intent)
    decision = verify_context(bundle)
    brief = _synthesizer.synthesize(bundle, decision)
    return brief, bundle


# --------------------------------------------------------------------------- #
# Action composition + execution: WS-E
# --------------------------------------------------------------------------- #
class AcmeFollowupProposer:
    """Deterministic (no-LLM) proposer for the API layer. Surfaces a representative Acme
    follow-up set — draftable work, approval routes, plus the two gate-demonstrating actions
    (a status-advance that depends on missing evidence, and a public+private mosaic synthesis).
    Each candidate is still validated by the REAL WS-E engine, which sets every `blocked_reason`.
    """

    def propose(self, brief: DecisionBrief, bundle: ContextBundle) -> list[Action]:
        return [
            Action(
                tool="create_task",
                reason="Final covenant tracker is required before the committee can decide.",
                sources=[SourceRef(object_id="wf_approval"),
                         SourceRef(object_id="doc_credit_memo")],
                risk="low",
                side_effect="write",
                diff=ActionDiff(
                    target_object_id="task_new_1",
                    after={
                        "title": "Upload final covenant tracker",
                        "assignee": "Priya N. (Analyst)",
                        "due": "2026-06-22",
                        "status": "open",
                    },
                ),
            ),
            Action(
                tool="draft_internal_note",
                reason="Summarize open risks for the committee pre-read.",
                sources=[SourceRef(object_id="doc_financials"),
                         SourceRef(object_id="doc_credit_memo")],
                risk="low",
                side_effect="draft",
                diff=ActionDiff(
                    target_object_id="note_new_1",
                    after={
                        "title": "Acme renewal — open risks",
                        "body": (
                            "Revenue forecast revised to $38M. Discount (22%) exceeds standard "
                            "threshold. Credit Officer approval and final covenant tracker "
                            "outstanding."
                        ),
                        "key_points": [
                            "Revenue forecast revised to $38M.",
                            "22% discount exceeds standard threshold.",
                            "Credit Officer approval and final covenant tracker are outstanding.",
                        ],
                        "status": "draft",
                    },
                ),
            ),
            Action(
                tool="route_approval",
                reason="The 22% discount exceeds the RM's delegated authority.",
                sources=[SourceRef(object_id="doc_pricing_exception")],
                required_approver="credit_officer",
                risk="medium",
                side_effect="propose",
                diff=ActionDiff(
                    target_object_id="doc_pricing_exception",
                    after={"approval_route": "Credit Officer", "state": "routed"},
                ),
            ),
            Action(
                tool="route_approval",
                reason="Legal approval is still pending and must complete before decision.",
                sources=[SourceRef(object_id="wf_approval")],
                required_approver="legal",
                risk="medium",
                side_effect="propose",
                diff=ActionDiff(
                    target_object_id="wf_approval",
                    after={"legal_status": "requested"},
                ),
            ),
            Action(
                tool="schedule_meeting",
                reason="Book the final committee decision once prerequisites clear.",
                sources=[SourceRef(object_id="mtg_committee_0612")],
                risk="low",
                side_effect="write",
                diff=ActionDiff(
                    target_object_id="mtg_new_1",
                    after={
                        "title": "Acme — final committee decision",
                        "attendees": ["Dana R.", "Chris O.", "Priya N.", "Sam L."],
                        "proposed": "2026-06-24 14:00",
                    },
                ),
            ),
            Action(
                tool="draft_internal_note",
                reason="Synthesize public-side sector research with the private-side model.",
                sources=[SourceRef(object_id="doc_research_publicside"),
                         SourceRef(object_id="doc_financials")],
                risk="high",
                side_effect="draft",
                diff=ActionDiff(
                    target_object_id="note_mnpi_1",
                    after={"topic": "sector + borrower synthesis"},
                ),
            ),
        ]


def _composer(workspace: list[WorkspaceObject]) -> SafeActionComposer:
    return SafeActionComposer(
        engine=ActionValidationEngine(workspace=workspace),
        proposer=AcmeFollowupProposer(),
    )


def compose_actions(brief: DecisionBrief, bundle: ContextBundle) -> ActionPlan:
    """WS-E: propose follow-ups, then validate + diff EVERY candidate through the engine."""
    return _composer(_action_workspace()).compose(brief, bundle)


def default_action_plan(user_id: str, intent: str) -> ActionPlan:
    """Assemble the brief and compose its action plan in one call (gateway convenience)."""
    brief, bundle = assemble_brief(user_id, intent)
    return compose_actions(brief, bundle)


def compose_staged_remediation(
    brief: DecisionBrief,
    bundle: ContextBundle,
    remediation: StagedRemediation,
) -> Action:
    """Validate one staged Decision Brief row through the same composer/engine path."""
    return _composer(_action_workspace()).compose_staged_remediation(remediation, brief, bundle)


def execute_actions(plan: ActionPlan, approved_indices: list[int]) -> list[AuditEvent]:
    """WS-E: apply ONLY approved, non-blocked actions. A blocked action is never executed,
    even if its index is submitted as approved."""
    executor = WorkspaceExecutor(workspace=_action_workspace())
    return executor.execute(plan, approved_indices)


def compose_and_execute(
    user_id: str, intent: str, approved_indices: list[int]
) -> list[AuditEvent]:
    """The `/actions/execute` path: recompose the gated plan server-side, then execute. The
    client supplies only approved indices — it cannot inject an un-gated plan."""
    brief, bundle = assemble_brief(user_id, intent)
    workspace = _action_workspace()
    plan = _composer(workspace).compose(brief, bundle)
    executor = WorkspaceExecutor(workspace=workspace)
    return executor.execute(plan, approved_indices)


# --------------------------------------------------------------------------- #
# Controlled work loop: WS-E (distribute → collect → escalate → schedule → close)
# --------------------------------------------------------------------------- #
def _persona_client() -> PersonaClient:
    """Offline `StubPersonaClient` by default (deterministic, no key).

    `DEMO_DETERMINISTIC=1` is an explicit hard override for walkthrough/runtime parity: it keeps
    seeded persona replies even when a developer has model credentials in their environment.
    Without that override, promote to `LLMPersonaClient` only when both `PERSONA_MODEL` and the
    provider key (`ANTHROPIC_API_KEY`) are present.
    """
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except Exception:
        pass
    if os.environ.get("DEMO_DETERMINISTIC", "").strip().lower() in _TRUTHY_ENV_VALUES:
        return StubPersonaClient()
    if os.environ.get("PERSONA_MODEL") and os.environ.get("ANTHROPIC_API_KEY"):
        try:
            return LLMPersonaClient()
        except RuntimeError:
            return StubPersonaClient()
    return StubPersonaClient()


def run_loop(
    user_id: str,
    intent: str,
    approved_indices: list[int] | None = None,
) -> LoopState:
    """Run the existing `actions.loop.ControlledWorkLoop` and return its dossier.

    The loop's five-node logic (distribute → collect → escalate → schedule → close) is NOT
    duplicated here — this only wires the orchestrator's brief and the API's gated composer
    (corpus workspace + `AcmeFollowupProposer`, the same plan as `/actions/compose`) into the
    loop, with the shared executor workspace so re-validation and execution agree.

    Deterministic + offline by default (stub personas). `approved_indices=None` uses the loop's
    default human-approval policy (`approve_nonblocked`); a provided list approves exactly those
    indices — but the engine still refuses to execute any blocked action, so a blocked index
    submitted as approved is skipped, never run.
    """
    brief, bundle = assemble_brief(user_id, intent)
    executor = WorkspaceExecutor(workspace=_action_workspace())
    composer = SafeActionComposer(engine=executor.engine, proposer=AcmeFollowupProposer())
    approver = (lambda _plan: list(approved_indices)) if approved_indices is not None else None
    loop = ControlledWorkLoop(
        executor=executor,
        composer=composer,
        persona_client=_persona_client(),
        approver=approver,  # None → loop default (approve_nonblocked)
    )
    return loop.run(brief, bundle)


# --------------------------------------------------------------------------- #
# Lifecycle revalidation: WS-F
# --------------------------------------------------------------------------- #
def _pin_contract(user_id: str, bundle: ContextBundle) -> WorkProductContract:
    return WorkProductContract(
        id="wp_acme_committee_packet",
        schema_name="DecisionBrief",
        owners=[user_id],
        source_dependencies=[ref.object_id for ref in bundle.sources],
    )


def revalidate(
    contract: WorkProductContract,
    changed_object_id: str,
    *,
    brief: DecisionBrief,
    source_objects: Mapping[str, WorkspaceObject] | None = None,
) -> RevalidationResult:
    """WS-F: map a source change to stale brief sections + reapproval routes. The pinned brief
    drives the section→source dependency graph; `source_objects` carries the post-change state."""
    graph = build_dependency_graph(brief, contract)
    return on_source_change(
        contract, graph, changed_object_id, source_objects=source_objects
    )


def run_revalidation(
    user_id: str,
    intent: str,
    changed_object_id: str = "wf_approval",
    event: str = "legal_needs_review",
) -> RevalidationResult:
    """Assemble + pin the Acme brief, apply a deterministic WS-A change event, and revalidate.
    `legal_needs_review` on `wf_approval` marks the approval sections stale and routes to legal."""
    brief, bundle = assemble_brief(user_id, intent)
    contract = _pin_contract(user_id, bundle)
    changed_sources = apply_change(load(FINANCE_VERTICAL), event)
    return revalidate(
        contract, changed_object_id, brief=brief, source_objects=changed_sources
    )


# --------------------------------------------------------------------------- #
# Agent Ops: WS-I three-vertical scorecard + WS-G telemetry
# --------------------------------------------------------------------------- #
# WS-I eval `kind` → §5-F5 eval-data modality bucket for the source mix.
_KIND_TO_MIX: dict[str, str] = {
    "synthetic": "synthetic",
    "regression": "aggregate",
    "tenant_local": "tenant_local",
    "redacted": "redacted",
}

# WS-I eval `check` → the frontend failure-taxonomy category vocabulary.
_CHECK_TO_CATEGORY: dict[str, str] = {
    "permission gate": "permission_boundary",
    "information-barrier gate": "permission_boundary",
    "privilege gate": "permission_boundary",
    "PHI minimum-necessary gate": "permission_boundary",
    "missing-evidence honesty": "retrieval_miss",
    "calculation validation": "calculation_mismatch",
    "approval threshold": "policy_gate_failure",
    "hallucinated-citation detector": "unsupported_claim",
    "version check": "stale_source_miss",
    "UX ambiguity": "ux_ambiguity",
}

# The eight taxonomy bars the Agent Ops surface renders (ops.ts TAXONOMY_LABELS).
_TAXONOMY_CATEGORIES: tuple[str, ...] = (
    "retrieval_miss",
    "permission_boundary",
    "unsupported_claim",
    "calculation_mismatch",
    "policy_gate_failure",
    "action_schema_failure",
    "stale_source_miss",
    "ux_ambiguity",
)


def telemetry_sample() -> TelemetryEvent:
    """One representative privacy-safe `TelemetryEvent` from the finance pack (WS-G).

    Runs the finance pack through the harness with an in-memory sink and returns the
    prepare-decision-brief event (permission denial + missing-evidence signals, content-free).
    """
    sink = InMemorySink()
    EvalHarnessRunner(sink=sink).run(FINANCE_PACK_ID)
    for event in sink.events:
        if event.intent_class == "prepare_decision_brief":
            return event
    return sink.events[0]


def _eval_source_mix(rows: list[EvalRow]) -> dict[str, float]:
    mix = {"synthetic": 0.0, "tenant_local": 0.0, "redacted": 0.0, "aggregate": 0.0}
    if not rows:
        return mix
    for row in rows:
        bucket = _KIND_TO_MIX.get(row.kind, "synthetic")
        mix[bucket] += 1
    return {key: round(value / len(rows), 4) for key, value in mix.items()}


def _failure_taxonomy(rows: list[EvalRow]) -> list[dict[str, int]]:
    counts = {category: 0 for category in _TAXONOMY_CATEGORIES}
    for row in rows:
        if row.passed:
            continue
        category = _CHECK_TO_CATEGORY.get(row.check, "ux_ambiguity")
        counts[category] += 1
    return [{"category": category, "count": counts[category]} for category in _TAXONOMY_CATEGORIES]


def ops_report() -> dict:
    """Assemble the Agent Ops aggregate from WS-I (three-vertical scorecard) + WS-G (telemetry,
    source mix, failure taxonomy). Returns a dict of typed pieces for `OpsReport` validation."""
    scorecard = run_three_vertical()
    rows = scorecard.eval_rows
    return {
        "vertical_scores": scorecard.vertical_scores,
        "eval_rows": rows,
        "telemetry_sample": telemetry_sample(),
        "eval_source_mix": _eval_source_mix(rows),
        "failure_taxonomy": _failure_taxonomy(rows),
        "recipes": scorecard.recipes,
        "overall_passed": scorecard.overall_passed,
    }

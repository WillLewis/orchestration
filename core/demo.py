"""
core/demo.py — integration harness (WS-0).

Wires the `core.pipeline` Protocols with TRIVIAL stub implementations over
`fixtures.acme`, so the whole pipeline runs end-to-end on mock data:

    intent -> context -> verify -> brief -> actions -> (approval) -> execute
                                                      -> revalidate -> eval

Stubs only — real stages come from WS-B (context), WS-C (verification),
WS-D (brief), WS-E (actions), WS-F (lifecycle), WS-G (evals). This module exists
so the integrator (and CI) can prove the contracts compose before any real stage
lands. Run via `make run` or `python -m core.demo`.
"""
from __future__ import annotations

from core.pipeline import (
    ActionComposer,
    BriefSynthesizer,
    ContextAssembler,
    EvalRunner,
    Executor,
    RevalidationEngine,
    Verifier,
)
from core.schemas import (
    Action,
    ActionDiff,
    ActionPlan,
    AuditEvent,
    ContextBundle,
    DecisionBrief,
    DeterministicDecision,
    EvalResult,
    SideEffectClass,
    StaleSectionState,
    WorkProductContract,
)
from fixtures.acme import acme_bundle, acme_expected_decision


class StubContextAssembler:
    """WS-B stand-in: returns the canned Acme bundle for the given user/intent."""

    def assemble(self, user_id: str, intent: str) -> ContextBundle:
        return acme_bundle(user_id).model_copy(update={"intent": intent})


class StubVerifier:
    """WS-C stand-in: returns the canonical Acme decision (NOT approval-ready)."""

    def verify(self, bundle: ContextBundle, rulepack_id: str) -> DeterministicDecision:
        return acme_expected_decision()


class StubBriefSynthesizer:
    """WS-D stand-in: assembles a DecisionBrief WITHOUT ever overriding the gate."""

    def synthesize(
        self, bundle: ContextBundle, decision: DeterministicDecision
    ) -> DecisionBrief:
        blocking = any(m.blocking for m in bundle.missing_evidence)
        return DecisionBrief(
            decision_needed="Approve Acme pricing exception + covenant modification?",
            executive_summary=(
                "Renewal review for Acme. Deterministic gates are authoritative; "
                "this brief never marks itself approval-ready."
            ),
            what_changed=[c.text for c in bundle.claims.claims],
            key_facts=[f"{len(bundle.sources)} accessible sources assembled."],
            policy_gates=decision,  # gate passed straight through, untouched
            required_approvals=decision.approvals,
            missing_evidence=bundle.missing_evidence,
            conflicts=bundle.conflicts,
            open_questions=["Is the final covenant tracker available?"],
            next_steps=["Route approval packet to Credit Officer; obtain Legal sign-off."],
            source_map=bundle.sources,
            permission_limitations=[
                f"Excluded {oid} ({bundle.permission_boundary.reason})."
                for oid in bundle.permission_boundary.excluded_object_ids
            ],
            confidence="low" if blocking else "medium",
        )


class StubActionComposer:
    """WS-E stand-in: proposes typed actions as diffs; blocks where evidence is missing."""

    def compose(self, brief: DecisionBrief, bundle: ContextBundle) -> ActionPlan:
        blocked = bool(brief.missing_evidence)
        return ActionPlan(
            actions=[
                Action(
                    tool="route_approval",
                    reason="Credit Officer approval is missing per the policy gate.",
                    required_approver="credit_officer",
                    risk="medium",
                    side_effect=SideEffectClass.propose,
                ),
                Action(
                    tool="create_task",
                    reason="Upload the final covenant tracker before committee.",
                    side_effect=SideEffectClass.draft,
                    diff=ActionDiff(
                        target_object_id="task_new",
                        after={"title": "Upload final covenant tracker"},
                    ),
                    blocked_reason=(
                        "missing_evidence: final covenant tracker" if blocked else None
                    ),
                ),
            ]
        )


class StubExecutor:
    """WS-E stand-in: executes ONLY approved, non-blocked actions; emits an audit trail."""

    def execute(self, plan: ActionPlan, approved_indices: list[int]) -> list[AuditEvent]:
        events: list[AuditEvent] = []
        for i in approved_indices:
            action = plan.actions[i]
            if action.blocked_reason:
                events.append(
                    AuditEvent(
                        actor="executor",
                        action="skipped",
                        detail={"index": i, "tool": action.tool, "reason": action.blocked_reason},
                    )
                )
                continue
            events.append(
                AuditEvent(
                    actor="executor",
                    action="executed",
                    detail={"index": i, "tool": action.tool},
                )
            )
        return events


class StubRevalidationEngine:
    """WS-F stand-in: flags a section stale when one of its source deps changes."""

    def revalidate(
        self, contract: WorkProductContract, changed_object_id: str
    ) -> list[StaleSectionState]:
        stale = changed_object_id in contract.source_dependencies
        return [
            StaleSectionState(
                section="approvals",
                stale=stale,
                reason=f"{changed_object_id} changed" if stale else "",
            )
        ]


class StubEvalRunner:
    """WS-G stand-in: returns a trivial passing result for the pack."""

    def run(self, pack_id: str) -> list[EvalResult]:
        return [
            EvalResult(
                case_id=f"{pack_id}_case1",
                passed=True,
                scores={"deterministic_rule_pass": 1.0},
            )
        ]


def run_demo(user_id: str = "u_rm", intent: str = "prepare_decision_brief") -> dict:
    """Run the full pipeline on mock data; return every stage's typed output."""
    context: ContextAssembler = StubContextAssembler()
    verifier: Verifier = StubVerifier()
    synthesizer: BriefSynthesizer = StubBriefSynthesizer()
    composer: ActionComposer = StubActionComposer()
    executor: Executor = StubExecutor()
    reval: RevalidationEngine = StubRevalidationEngine()
    evals: EvalRunner = StubEvalRunner()

    bundle = context.assemble(user_id, intent)
    decision = verifier.verify(bundle, rulepack_id="finance_credit_v1")
    brief = synthesizer.synthesize(bundle, decision)
    plan = composer.compose(brief, bundle)
    # Human approves both proposed actions; the blocked one is skipped at execution.
    audit = executor.execute(plan, approved_indices=list(range(len(plan.actions))))

    contract = WorkProductContract(
        id="wp_acme_brief",
        owners=["u_rm"],
        source_dependencies=["wf_approval", "doc_financials"],
        revalidation_rules=["legal_status_change"],
    )
    stale = reval.revalidate(contract, changed_object_id="wf_approval")
    eval_results = evals.run("three_vertical")

    return {
        "bundle": bundle,
        "decision": decision,
        "brief": brief,
        "plan": plan,
        "audit": audit,
        "stale": stale,
        "eval": eval_results,
    }


def _stage(title: str, body: str) -> None:
    print(f"\n=== {title} ===")
    print(body)


def main() -> None:
    r = run_demo()
    bundle, decision, brief = r["bundle"], r["decision"], r["brief"]
    plan, audit, stale, eval_results = r["plan"], r["audit"], r["stale"], r["eval"]

    print("ConnectWork Command Agent — demo pipeline (stubs over fixtures.acme)")
    _stage("1. intent", f"user={bundle.user_id!r} intent={bundle.intent!r}")
    _stage(
        "2. context (WS-B)",
        f"sources={len(bundle.sources)} "
        f"excluded={bundle.permission_boundary.excluded_object_ids} "
        f"missing_evidence={[m.code for m in bundle.missing_evidence]} "
        f"conflicts={len(bundle.conflicts)}",
    )
    _stage(
        "3. verify (WS-C)",
        f"approval_ready={decision.approval_ready} "
        f"firings={[(f.rule_id, f.passed) for f in decision.firings]}",
    )
    _stage(
        "4. brief (WS-D)",
        f"decision_needed={brief.decision_needed!r}\n"
        f"confidence={brief.confidence} "
        f"policy_gates.approval_ready={brief.policy_gates.approval_ready} "
        "(brief never overrides the gate)",
    )
    _stage(
        "5. actions (WS-E)",
        "\n".join(
            f"  [{i}] {a.tool} side_effect={a.side_effect.value} "
            f"approver={a.required_approver} blocked={a.blocked_reason}"
            for i, a in enumerate(plan.actions)
        ),
    )
    _stage(
        "6. execute (audit trail)",
        "\n".join(f"  {e.action}: {e.detail}" for e in audit),
    )
    _stage(
        "7. revalidate (WS-F)",
        "\n".join(f"  section={s.section} stale={s.stale} reason={s.reason!r}" for s in stale),
    )
    _stage(
        "8. eval (WS-G)",
        "\n".join(f"  case={e.case_id} passed={e.passed} scores={e.scores}" for e in eval_results),
    )
    print("\nNothing executed without approval; blocked actions were skipped. ✔")


if __name__ == "__main__":
    main()

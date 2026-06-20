"""WS-F acceptance tests for work-product lifecycle revalidation."""
from __future__ import annotations

from core.pipeline import RevalidationEngine
from core.schemas import (
    ApprovalMatrix,
    ApprovalRequirement,
    ConflictState,
    DecisionBrief,
    DeterministicDecision,
    SourceRef,
    StaleSectionState,
    WorkProductContract,
)
from corpus import apply_change, load
from lifecycle import (
    LifecycleRevalidationEngine,
    SourceDependencyGraph,
    build_dependency_graph,
    on_source_change,
    revalidate_changed_source,
)


def _approved_decision() -> DeterministicDecision:
    approvals = ApprovalMatrix(
        requirements=[
            ApprovalRequirement(role="relationship_manager", present=True),
            ApprovalRequirement(role="credit_officer", present=True),
            ApprovalRequirement(role="legal", present=True),
        ]
    )
    return DeterministicDecision(approval_ready=True, approvals=approvals)


def _pinned_acme_brief() -> DecisionBrief:
    decision = _approved_decision()
    return DecisionBrief(
        decision_needed="Approve Acme pricing exception + covenant modification?",
        executive_summary="Pinned committee packet for Acme renewal.",
        what_changed=["Revenue forecast revised from $42M to $38M."],
        key_facts=["Debt-service-coverage ratio is 1.28."],
        policy_gates=decision,
        required_approvals=decision.approvals,
        conflicts=[
            ConflictState(
                description="Pricing doc and CS plan show different discount levels.",
                sources=[SourceRef(object_id="doc_pricing_exception")],
            )
        ],
        source_map=[
            SourceRef(object_id="wf_approval"),
            SourceRef(object_id="doc_financials"),
            SourceRef(object_id="doc_credit_memo"),
        ],
        confidence="high",
    )


def _contract() -> WorkProductContract:
    return WorkProductContract(
        id="wp_acme_committee_packet",
        schema_name="DecisionBrief",
        owners=["u_rm"],
        source_dependencies=["wf_approval", "doc_financials", "doc_credit_memo"],
        revalidation_rules=[
            "approval_source_changed",
            "data_source_changed",
            "version_bump",
        ],
    )


def _graph():
    return build_dependency_graph(_pinned_acme_brief(), _contract())


def _by_section(states: list[StaleSectionState]) -> dict[str, StaleSectionState]:
    return {state.section: state for state in states}


def test_build_dependency_graph_maps_acme_sections_deterministically():
    graph = _graph()

    assert graph.section_dependencies["policy_gates"] == ["wf_approval"]
    assert graph.section_dependencies["required_approvals"] == ["wf_approval"]
    assert graph.section_dependencies["what_changed"] == ["doc_financials"]
    assert graph.section_dependencies["key_facts"] == ["doc_financials"]


def test_legal_needs_review_marks_approval_sections_stale_and_routes_to_legal():
    changed_sources = apply_change(load("finance"), "legal_needs_review")
    engine = LifecycleRevalidationEngine(graphs=[_graph()], source_objects=changed_sources)

    stale = _by_section(engine.revalidate(_contract(), "wf_approval"))
    assert stale["policy_gates"].stale is True
    assert stale["required_approvals"].stale is True
    assert "legal workflow" in stale["policy_gates"].reason.lower()
    assert "Needs Review" in stale["policy_gates"].reason

    result = engine.on_source_change(_contract(), _graph(), "wf_approval")
    assert {route.approver_role for route in result.reapproval_routes} == {"legal"}
    assert {route.section for route in result.reapproval_routes} == {
        "policy_gates",
        "required_approvals",
    }
    assert result.change_impact.affected_work_products == [_contract().id]


def test_financials_v2_marks_factual_sections_stale_without_reapproval():
    changed_sources = apply_change(load("finance"), "financials_v2")
    result = on_source_change(
        _contract(),
        _graph(),
        "doc_financials",
        source_objects=changed_sources,
    )
    stale = _by_section(result.stale_sections)

    assert stale["what_changed"].stale is True
    assert stale["key_facts"].stale is True
    assert "version" in stale["what_changed"].reason.lower()
    assert result.reapproval_routes == []
    assert stale["policy_gates"].stale is False
    assert stale["required_approvals"].stale is False


def test_unrelated_change_has_no_stale_sections_or_routes():
    result = on_source_change(_contract(), _graph(), "unrelated_object")

    assert all(not state.stale for state in result.stale_sections)
    assert result.reapproval_routes == []
    assert result.change_impact.affected_work_products == []


def test_lifecycle_engine_satisfies_revalidation_protocol():
    engine = LifecycleRevalidationEngine(graphs=[_graph()])

    assert isinstance(engine, RevalidationEngine)
    stale = engine.revalidate(_contract(), "wf_approval")
    assert all(isinstance(state, StaleSectionState) for state in stale)


def test_revalidation_is_deterministic_for_the_same_change():
    changed_sources = apply_change(load("finance"), "financials_v2")
    engine = LifecycleRevalidationEngine(graphs=[_graph()], source_objects=changed_sources)

    first = engine.on_source_change(_contract(), _graph(), "doc_financials")
    second = engine.on_source_change(_contract(), _graph(), "doc_financials")

    assert first == second
    stale = _by_section(first.stale_sections)
    assert stale["policy_gates"].stale is False
    assert stale["required_approvals"].stale is False


def test_event_helper_revalidates_only_dependent_work_products():
    changed_sources = apply_change(load("finance"), "financials_v2")
    unrelated_contract = WorkProductContract(
        id="wp_unrelated",
        source_dependencies=["unrelated_object"],
    )
    unrelated_graph = SourceDependencyGraph(
        work_product_id=unrelated_contract.id,
        section_dependencies={"summary": ["unrelated_object"]},
    )

    results = revalidate_changed_source(
        [_contract(), unrelated_contract],
        [_graph(), unrelated_graph],
        "doc_financials",
        source_objects=changed_sources,
    )

    assert [result.change_impact.affected_work_products for result in results] == [
        [_contract().id]
    ]

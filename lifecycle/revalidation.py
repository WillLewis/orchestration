"""Deterministic work-product lifecycle revalidation (WS-F).

This module owns the stale-work-product path: when a source changes, it maps the
change back to pinned brief sections and emits reapproval routes only for impacted
approval sections.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from pydantic import BaseModel, Field

from core.schemas import (
    DecisionBrief,
    MissingEvidenceState,
    ObjectType,
    StaleSectionState,
    WorkspaceObject,
    WorkProductContract,
)

_APPROVAL_SECTIONS = ("policy_gates", "required_approvals")
_FACTUAL_SECTIONS = ("what_changed", "key_facts")
_APPROVED_VALUES = {"approved", "complete", "completed", "done", "signed", "accepted"}
_REAPPROVAL_VALUES = {"needs review", "reopened", "revoked", "rejected"}
_FINANCIAL_HINTS = (
    "borrower",
    "coverage",
    "debt-service",
    "debt service",
    "dscr",
    "ebitda",
    "financial",
    "forecast",
    "margin",
    "revenue",
)


class SourceDependencyGraph(BaseModel):
    """Section-level dependency graph for one pinned work product."""

    work_product_id: str
    section_dependencies: dict[str, list[str]] = Field(default_factory=dict)

    def depends_on(self, object_id: str) -> bool:
        return any(object_id in ids for ids in self.section_dependencies.values())


class ReapprovalRoute(BaseModel):
    """Route an impacted section back to the role that must re-approve it."""

    section: str
    approver_role: str
    reason: str = ""


class ChangeImpactMap(BaseModel):
    """Summary of which pinned work products and sections a source change impacted."""

    changed_object_id: str
    affected_sections: list[str] = Field(default_factory=list)
    affected_work_products: list[str] = Field(default_factory=list)


class RevalidationResult(BaseModel):
    """Full WS-F result for `/revalidate` integration."""

    stale_sections: list[StaleSectionState] = Field(default_factory=list)
    reapproval_routes: list[ReapprovalRoute] = Field(default_factory=list)
    change_impact: ChangeImpactMap


def build_dependency_graph(
    brief: DecisionBrief, contract: WorkProductContract
) -> SourceDependencyGraph:
    """Build a deterministic section -> source-object-id map when a brief is pinned."""

    contract_sources = _unique(contract.source_dependencies)
    source_map_ids = _unique(ref.object_id for ref in brief.source_map)
    all_sources = contract_sources or source_map_ids

    approval_sources = _approval_sources(all_sources)
    data_sources = _data_sources(source_map_ids or all_sources)

    section_dependencies: dict[str, list[str]] = {
        "policy_gates": approval_sources or all_sources,
        "required_approvals": approval_sources or all_sources,
        "what_changed": _specific_data_sources(brief.what_changed, data_sources),
        "key_facts": _specific_data_sources(brief.key_facts, data_sources),
        "conflicts": _unique(
            source.object_id for conflict in brief.conflicts for source in conflict.sources
        ),
        "missing_evidence": _missing_evidence_sources(brief.missing_evidence),
    }

    conservative_sections = {
        "decision_needed": [brief.decision_needed],
        "executive_summary": [brief.executive_summary],
        "open_questions": brief.open_questions,
        "next_steps": brief.next_steps,
        "source_map": [ref.object_id for ref in brief.source_map],
        "permission_limitations": brief.permission_limitations,
        "confidence": [brief.confidence],
    }
    for section, values in conservative_sections.items():
        if any(values):
            section_dependencies[section] = all_sources

    return SourceDependencyGraph(
        work_product_id=contract.id,
        section_dependencies={
            section: ids
            for section, ids in sorted(section_dependencies.items())
            if ids
        },
    )


def on_source_change(
    contract: WorkProductContract,
    graph: SourceDependencyGraph,
    changed_object_id: str,
    *,
    source_objects: Mapping[str, WorkspaceObject] | Iterable[WorkspaceObject] | None = None,
) -> RevalidationResult:
    """Revalidate one pinned work product against a changed source object."""

    source_lookup = _source_lookup(source_objects)
    changed_source = source_lookup.get(changed_object_id)
    impacted = graph.depends_on(changed_object_id)
    stale_sections = [
        _section_state(section, object_ids, changed_object_id, changed_source)
        for section, object_ids in sorted(graph.section_dependencies.items())
    ]
    affected_sections = [state.section for state in stale_sections if state.stale]
    routes = _reapproval_routes(stale_sections, changed_object_id, changed_source)
    affected_work_products = [contract.id] if impacted else []

    return RevalidationResult(
        stale_sections=stale_sections,
        reapproval_routes=routes,
        change_impact=ChangeImpactMap(
            changed_object_id=changed_object_id,
            affected_sections=affected_sections,
            affected_work_products=affected_work_products,
        ),
    )


def revalidate_changed_source(
    contracts: Iterable[WorkProductContract],
    graphs: Iterable[SourceDependencyGraph],
    changed_object_id: str,
    *,
    source_objects: Mapping[str, WorkspaceObject] | Iterable[WorkspaceObject] | None = None,
) -> list[RevalidationResult]:
    """Find every pinned work product whose graph depends on the changed object."""

    contracts_by_id = {contract.id: contract for contract in contracts}
    results: list[RevalidationResult] = []
    for graph in sorted(graphs, key=lambda item: item.work_product_id):
        if not graph.depends_on(changed_object_id):
            continue
        contract = contracts_by_id.get(graph.work_product_id)
        if contract is None:
            continue
        results.append(
            on_source_change(
                contract,
                graph,
                changed_object_id,
                source_objects=source_objects,
            )
        )
    return results


class LifecycleRevalidationEngine:
    """WS-F implementation of `core.pipeline.RevalidationEngine`."""

    def __init__(
        self,
        *,
        graphs: Iterable[SourceDependencyGraph] = (),
        source_objects: Mapping[str, WorkspaceObject] | Iterable[WorkspaceObject] | None = None,
    ) -> None:
        self._graphs = {graph.work_product_id: graph for graph in graphs}
        self._source_objects = _source_lookup(source_objects)

    def revalidate(
        self, contract: WorkProductContract, changed_object_id: str
    ) -> list[StaleSectionState]:
        graph = self._graphs.get(contract.id) or _graph_from_contract(contract)
        return self.on_source_change(contract, graph, changed_object_id).stale_sections

    def on_source_change(
        self,
        contract: WorkProductContract,
        graph: SourceDependencyGraph,
        changed_object_id: str,
    ) -> RevalidationResult:
        return on_source_change(
            contract,
            graph,
            changed_object_id,
            source_objects=self._source_objects,
        )

    def revalidate_event(
        self,
        contracts: Iterable[WorkProductContract],
        changed_object_id: str,
    ) -> list[RevalidationResult]:
        return revalidate_changed_source(
            contracts,
            self._graphs.values(),
            changed_object_id,
            source_objects=self._source_objects,
        )


def _graph_from_contract(contract: WorkProductContract) -> SourceDependencyGraph:
    return SourceDependencyGraph(
        work_product_id=contract.id,
        section_dependencies={
            "work_product": _unique(contract.source_dependencies),
        },
    )


def _section_state(
    section: str,
    object_ids: list[str],
    changed_object_id: str,
    changed_source: WorkspaceObject | None,
) -> StaleSectionState:
    if changed_object_id not in object_ids:
        return StaleSectionState(section=section, stale=False)
    return StaleSectionState(
        section=section,
        stale=True,
        reason=_stale_reason(section, changed_object_id, changed_source),
    )


def _stale_reason(
    section: str,
    changed_object_id: str,
    changed_source: WorkspaceObject | None,
) -> str:
    if _is_approval_source(changed_object_id, changed_source):
        role, status = _reapproval_signal(changed_source)
        if role and status:
            return (
                f"{role} workflow changed to {status}; "
                f"revalidate {section} before using this packet."
            )
        return (
            f"{changed_object_id} approval/workflow source changed; "
            f"revalidate {section} before using this packet."
        )
    if changed_source and changed_source.version > 1:
        return (
            f"{changed_object_id} version is now {changed_source.version}; "
            f"re-run {section} from current source data."
        )
    return f"{changed_object_id} changed; re-run {section} from current source data."


def _reapproval_routes(
    stale_sections: list[StaleSectionState],
    changed_object_id: str,
    changed_source: WorkspaceObject | None,
) -> list[ReapprovalRoute]:
    if not _is_approval_source(changed_object_id, changed_source):
        return []
    role, status = _reapproval_signal(changed_source)
    if not role:
        return []
    reason = (
        f"{role} workflow changed to {status}; approval section must be re-approved."
        if status
        else f"{changed_object_id} approval source changed; approval section must be re-approved."
    )
    return [
        ReapprovalRoute(section=state.section, approver_role=role, reason=reason)
        for state in stale_sections
        if state.stale and state.section in _APPROVAL_SECTIONS
    ]


def _reapproval_signal(source: WorkspaceObject | None) -> tuple[str | None, str | None]:
    if source is None:
        return (None, None)

    metadata = source.metadata
    for key, value in metadata.items():
        if key.endswith("_status") and _normalized(value) in _REAPPROVAL_VALUES:
            return (_role_from_status_key(key, metadata), str(value))

    for key, value in metadata.items():
        if key.endswith("_status") and _normalized(value) not in _APPROVED_VALUES:
            return (_role_from_status_key(key, metadata), str(value))

    for key, value in metadata.items():
        if key.endswith("_approval") and value is False:
            return (key.removesuffix("_approval"), "missing")

    return (None, None)


def _role_from_status_key(key: str, metadata: Mapping[str, Any]) -> str:
    if key == "approval_status":
        return str(metadata.get("required_approver_role") or "approver")
    return key.removesuffix("_status")


def _approval_sources(source_ids: list[str]) -> list[str]:
    return _unique(object_id for object_id in source_ids if _is_approval_source(object_id))


def _data_sources(source_ids: list[str]) -> list[str]:
    data_ids = [
        object_id
        for object_id in source_ids
        if object_id.startswith("doc_") or "financial" in object_id
    ]
    return _unique(data_ids)


def _specific_data_sources(lines: list[str], candidates: list[str]) -> list[str]:
    if not candidates:
        return []
    text = " ".join(lines).lower()
    if any(hint in text for hint in _FINANCIAL_HINTS):
        financial = [object_id for object_id in candidates if "financial" in object_id]
        if financial:
            return _unique(financial)
    return candidates


def _missing_evidence_sources(missing: list[MissingEvidenceState]) -> list[str]:
    source_ids: list[str] = []
    for item in missing:
        if item.code.startswith("missing_"):
            source_ids.append(item.code.removeprefix("missing_"))
    return _unique(source_ids)


def _is_approval_source(
    object_id: str, source: WorkspaceObject | None = None
) -> bool:
    if source and source.type == ObjectType.workflow:
        return True
    lowered = object_id.lower()
    return lowered.startswith("wf_") or "approval" in lowered or "workflow" in lowered


def _source_lookup(
    source_objects: Mapping[str, WorkspaceObject] | Iterable[WorkspaceObject] | None,
) -> dict[str, WorkspaceObject]:
    if source_objects is None:
        return {}
    if isinstance(source_objects, Mapping):
        return dict(source_objects)
    return {source.id: source for source in source_objects}


def _unique(values: Iterable[str]) -> list[str]:
    return sorted({value for value in values if value})


def _normalized(value: object) -> str:
    return str(value).strip().lower().replace("_", " ")


__all__ = [
    "ChangeImpactMap",
    "LifecycleRevalidationEngine",
    "ReapprovalRoute",
    "RevalidationResult",
    "SourceDependencyGraph",
    "build_dependency_graph",
    "on_source_change",
    "revalidate_changed_source",
]

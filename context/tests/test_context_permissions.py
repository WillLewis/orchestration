"""
context/tests/test_context_permissions.py — WS-B permission, mosaic, and grounding safety.

The non-negotiables: denied content never reaches the bundle; restricted content needs
clearance; unknown users get nothing; barrier synthesis is flagged not silently included;
and an LLM cannot ground a claim on a denied or non-existent object.
"""
from core.schemas import ACL, ContextBundle, ObjectType, Sensitivity, WorkspaceObject

from context.assembler import (
    CandidateClaim,
    PermissionAwareContextAssembler,
    PermissionPolicy,
)

DENIED = "doc_legal_memo"
BARRIER = "doc_research_publicside"


def _all_referenced_ids(b: ContextBundle) -> set[str]:
    """Every object id surfaced anywhere EXCEPT the permission-boundary disclosure."""
    ids: set[str] = {s.object_id for s in b.sources}
    ids |= {s.object_id for c in b.claims.claims for s in c.sources}
    ids |= {s.object_id for cf in b.conflicts for s in cf.sources}
    if b.source_graph is not None:
        ids |= set(b.source_graph.nodes)
        ids |= {e.from_id for e in b.source_graph.edges}
        ids |= {e.to_id for e in b.source_graph.edges}
    return ids


def test_denied_object_is_excluded_for_rm():
    b = PermissionAwareContextAssembler().assemble("u_rm", "prepare_decision_brief")
    assert DENIED in b.permission_boundary.excluded_object_ids
    assert DENIED not in {s.object_id for s in b.sources}


def test_denied_content_never_enters_anywhere_but_the_boundary():
    # The restricted legal memo's id may be DISCLOSED (edge case 1) but its content/metadata
    # must never appear as a source, a claim citation, a conflict source, or a graph node.
    b = PermissionAwareContextAssembler().assemble("u_rm", "prepare_decision_brief")
    assert DENIED not in _all_referenced_ids(b)


def test_restricted_content_requires_clearance():
    # u_legal is a listed reader AND has legal clearance, so the restricted memo is readable.
    b = PermissionAwareContextAssembler().assemble("u_legal", "prepare_decision_brief")
    assert DENIED in {s.object_id for s in b.sources}
    assert DENIED not in b.permission_boundary.excluded_object_ids


def test_unknown_user_gets_a_valid_empty_bundle():
    b = PermissionAwareContextAssembler().assemble("u_ghost", "prepare_decision_brief")
    assert b.sources == []
    assert b.permission_boundary.excluded_object_ids  # everything was denied
    # still a structurally valid, round-trippable bundle
    assert ContextBundle.model_validate_json(b.model_dump_json()) == b


def test_mosaic_barrier_object_is_held_out_and_flagged():
    b = PermissionAwareContextAssembler().assemble("u_rm", "prepare_decision_brief")
    assert BARRIER not in {s.object_id for s in b.sources}
    barrier_flags = [c for c in b.conflicts if "information-barrier" in c.description]
    assert barrier_flags, "crossing a barrier must be flagged, not silently included"
    assert any(s.object_id == BARRIER for c in barrier_flags for s in c.sources)


def test_same_side_barrier_object_is_included():
    # If the packet operates on the public side, the public-side note no longer crosses.
    policy = PermissionPolicy(packet_barrier_sides=frozenset({"public-side"}))
    b = PermissionAwareContextAssembler(policy=policy).assemble("u_rm", "prepare_decision_brief")
    assert BARRIER in {s.object_id for s in b.sources}
    assert not [c for c in b.conflicts if "information-barrier" in c.description]


def test_llm_proposed_citation_of_denied_object_is_scrubbed():
    """An (LLM) extractor citing a denied / unknown object yields an UNSUPPORTED claim;
    WS-B owns the support decision, not the model."""

    class MockExtractor:
        def extract(self, objects):
            return [
                CandidateClaim(id="hallucinated", text="Legal cleared the discount.",
                               cited_object_ids=(DENIED, "nonexistent_obj")),
                CandidateClaim(id="grounded", text="Forecast is in the model.",
                               cited_object_ids=("doc_financials",)),
            ]

    b = PermissionAwareContextAssembler(claim_extractor=MockExtractor()).assemble(
        "u_rm", "prepare_decision_brief"
    )
    by_id = {c.id: c for c in b.claims.claims}
    assert by_id["hallucinated"].supported is False
    assert by_id["hallucinated"].sources == []
    assert by_id["grounded"].supported is True
    # The denied object is still nowhere in the grounded content.
    assert DENIED not in _all_referenced_ids(b)


def test_generic_metadata_conflict_probe_fires_on_real_disagreement():
    # The real, generalizable mechanism: two accessible objects disagree on a probed key.
    def workspace():
        return [
            WorkspaceObject(id="pricing_doc", type=ObjectType.document, title="Pricing exception",
                            acl=ACL(readers=["u_test"], sensitivity=Sensitivity.internal),
                            metadata={"discount_pct": 10}),
            WorkspaceObject(id="cs_plan", type=ObjectType.document, title="CS success plan",
                            acl=ACL(readers=["u_test"], sensitivity=Sensitivity.internal),
                            metadata={"discount_pct": 15}),
        ]

    assembler = PermissionAwareContextAssembler(
        workspace, users={"u_test": {"role": "analyst"}}
    )
    b = assembler.assemble("u_test", "prepare_decision_brief")
    probes = [c for c in b.conflicts if "discount_pct" in c.description]
    assert probes, "metadata conflict probe should fire on disagreeing values"
    cited = {s.object_id for c in probes for s in c.sources}
    assert cited == {"pricing_doc", "cs_plan"}

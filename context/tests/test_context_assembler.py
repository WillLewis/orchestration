"""
context/tests/test_context_assembler.py — WS-B end-to-end behaviour.

Asserts the assembled bundle is shaped like ``fixtures.acme.acme_bundle``: the right
accessible sources, a supported + an unsupported claim, missing evidence, a detected
conflict, a safe source graph, and a clean JSON round-trip. No network / API key needed.
"""
from core.pipeline import ContextAssembler
from core.schemas import ContextBundle
from fixtures.acme import acme_bundle

from context.assembler import PermissionAwareContextAssembler

RM = "u_rm"
INTENT = "prepare_decision_brief"


def _bundle() -> ContextBundle:
    return PermissionAwareContextAssembler().assemble(RM, INTENT)


def test_satisfies_pipeline_protocol():
    assert isinstance(PermissionAwareContextAssembler(), ContextAssembler)


def test_returns_contextbundle_with_user_and_intent():
    b = _bundle()
    assert isinstance(b, ContextBundle)
    assert b.user_id == RM
    assert b.intent == INTENT


def test_sources_match_accessible_set_and_order():
    b = _bundle()
    # Same accessible sources, in the same order, as the canonical fixture bundle.
    assert [s.object_id for s in b.sources] == [s.object_id for s in acme_bundle().sources]


def test_supported_claim_is_grounded_in_a_real_source():
    b = _bundle()
    revenue = next(c for c in b.claims.claims if "Revenue forecast" in c.text)
    assert revenue.supported is True
    assert [s.object_id for s in revenue.sources] == ["doc_financials"]


def test_unsupported_claim_has_no_sources():
    b = _bundle()
    unsupported = [c for c in b.claims.claims if not c.supported]
    assert unsupported, "expected at least one unsupported claim (covenant compliance gap)"
    assert all(c.sources == [] for c in unsupported)


def test_claim_support_flag_is_consistent_with_sources():
    # Invariant: supported iff the claim retains at least one accessible source.
    b = _bundle()
    assert b.claims.claims
    for c in b.claims.claims:
        assert c.supported == bool(c.sources)


def test_missing_covenant_tracker_is_detected_and_blocking():
    b = _bundle()
    codes = {m.code: m for m in b.missing_evidence}
    assert "missing_covenant_tracker" in codes
    assert codes["missing_covenant_tracker"].blocking is True


def test_pricing_conflict_is_detected():
    b = _bundle()
    discount = [c for c in b.conflicts if "discount" in c.description.lower()]
    assert discount, "expected the pricing-doc vs CS-plan discount conflict"
    assert any(s.object_id == "doc_credit_memo" for c in discount for s in c.sources)


def test_source_graph_only_spans_accessible_nodes():
    b = _bundle()
    assert b.source_graph is not None
    accessible = {s.object_id for s in b.sources}
    assert set(b.source_graph.nodes) == accessible
    for e in b.source_graph.edges:
        assert e.from_id in accessible and e.to_id in accessible


def test_bundle_roundtrips_through_json():
    b = _bundle()
    assert ContextBundle.model_validate_json(b.model_dump_json()) == b

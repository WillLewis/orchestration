"""
brief/tests/test_brief_synthesizer.py — WS-D behaviour.

Proves the non-negotiable WS-D guarantee: the LLM drafts language but NEVER overrides the
deterministic gate. The gate is copied through untouched, the Acme case stays not-approval-ready,
confidence drops for a blocking gap, facts trace to supported claims, and the brief round-trips.
No network / API key needed — the probabilistic drafter is injected/mocked.
"""
from core.pipeline import BriefSynthesizer
from core.schemas import (
    ApprovalMatrix,
    ApprovalRequirement,
    Claim,
    ClaimMap,
    ContextBundle,
    DecisionBrief,
    DeterministicDecision,
    PermissionBoundary,
    SourceRef,
)
from fixtures.acme import acme_bundle, acme_expected_decision

from brief.synthesizer import (
    BriefEvidenceView,
    BriefNarrative,
    GroundedBriefSynthesizer,
    synthesize,
    synthesize_acme_demo,
)


def _brief() -> DecisionBrief:
    return synthesize(acme_bundle(), acme_expected_decision())


# --------------------------------------------------------------------------- #
# Contract / protocol
# --------------------------------------------------------------------------- #
def test_satisfies_pipeline_protocol():
    assert isinstance(GroundedBriefSynthesizer(), BriefSynthesizer)


def test_returns_decisionbrief():
    assert isinstance(_brief(), DecisionBrief)


# --------------------------------------------------------------------------- #
# The gate is authoritative — never overridden
# --------------------------------------------------------------------------- #
def test_policy_gates_passed_through_untouched():
    decision = acme_expected_decision()
    brief = synthesize(acme_bundle(), decision)
    # Copied through verbatim: same value, same firings, same approval flag.
    assert brief.policy_gates == decision
    assert [(f.rule_id, f.passed) for f in brief.policy_gates.firings] == [
        (f.rule_id, f.passed) for f in decision.firings
    ]


def test_synthesis_does_not_mutate_the_input_decision():
    decision = acme_expected_decision()
    synthesize(acme_bundle(), decision)
    assert decision.approval_ready is False  # input untouched


def test_required_approvals_match_the_decision_matrix():
    decision = acme_expected_decision()
    brief = synthesize(acme_bundle(), decision)
    assert brief.required_approvals == decision.approvals
    by_role = {r.role: r.present for r in brief.required_approvals.requirements}
    assert by_role["credit_officer"] is False  # gate's reality preserved


def test_acme_case_stays_not_approval_ready():
    assert _brief().policy_gates.approval_ready is False


def test_confidence_is_low_for_a_blocking_gap():
    # Acme has a blocking missing-evidence item (covenant tracker) → low confidence.
    assert _brief().confidence == "low"


def test_prose_never_claims_approval_when_the_gate_fails():
    brief = _brief()
    assert "not approval-ready" in brief.executive_summary.lower()
    assert brief.confidence != "high"


# --------------------------------------------------------------------------- #
# Faithfulness — facts trace to supported claims; unsupported → questions
# --------------------------------------------------------------------------- #
def test_supported_change_claim_becomes_what_changed():
    brief = _brief()
    assert "Revenue forecast revised from $42M to $38M." in brief.what_changed


def test_facts_and_changes_come_only_from_supported_claims():
    bundle = acme_bundle()
    brief = synthesize(bundle, acme_expected_decision())
    supported_texts = {c.text for c in bundle.claims.claims if c.supported and c.sources}
    for item in [*brief.what_changed, *brief.key_facts]:
        assert item in supported_texts


def test_unsupported_claim_is_an_open_question_not_a_fact():
    bundle = ContextBundle(
        user_id="u_rm",
        intent="prepare_decision_brief",
        sources=[SourceRef(object_id="doc_a")],
        claims=ClaimMap(
            claims=[
                Claim(
                    id="c_ok",
                    text="DSCR is 1.28.",
                    supported=True,
                    sources=[SourceRef(object_id="doc_a")],
                ),
                Claim(id="c_gap", text="Covenants remain within thresholds.", supported=False),
            ]
        ),
    )
    brief = synthesize(bundle, DeterministicDecision(approval_ready=False))
    assert "DSCR is 1.28." in brief.key_facts
    assert "Covenants remain within thresholds." not in brief.key_facts
    assert "Covenants remain within thresholds." not in brief.what_changed
    assert any("Covenants remain within thresholds." in q for q in brief.open_questions)


# --------------------------------------------------------------------------- #
# Gate-derived structure
# --------------------------------------------------------------------------- #
def test_next_steps_route_each_missing_approver():
    steps = " ".join(_brief().next_steps).lower()
    assert "credit officer" in steps
    assert "legal" in steps


def test_permission_limitations_reflect_the_excluded_legal_memo():
    limits = _brief().permission_limitations
    assert any("doc_legal_memo" in line for line in limits)


def test_blocking_gap_surfaces_in_open_questions():
    qs = " ".join(_brief().open_questions).lower()
    assert "covenant tracker" in qs


# --------------------------------------------------------------------------- #
# Round-trip + demo
# --------------------------------------------------------------------------- #
def test_brief_roundtrips_through_json():
    brief = _brief()
    assert DecisionBrief.model_validate_json(brief.model_dump_json()) == brief


def test_demo_function_returns_a_not_ready_brief():
    brief = synthesize_acme_demo()
    assert isinstance(brief, DecisionBrief)
    assert brief.policy_gates.approval_ready is False
    assert brief.decision_needed.endswith("?")


# --------------------------------------------------------------------------- #
# The LLM is a mockable seam — and a lying drafter cannot override the gate
# --------------------------------------------------------------------------- #
class _CleanDrafter:
    """A stand-in LLM that drafts safe prose (no network)."""

    def draft(self, view: BriefEvidenceView) -> BriefNarrative:
        return BriefNarrative(
            decision_needed="Approve the renewal?",
            summary_body="Two facts assembled.",
            extra_open_questions=("Is the pricing committee scheduled?",),
            extra_next_steps=("Pin the committee packet.",),
        )


class _LyingDrafter:
    """A misbehaving LLM that tries to assert approval. The synthesizer must neutralize it."""

    def draft(self, view: BriefEvidenceView) -> BriefNarrative:
        return BriefNarrative(
            decision_needed="Approve?",
            summary_body="This brief is approval-ready and the deal is approved.",
        )


def test_injected_drafter_prose_is_used_without_any_network():
    brief = GroundedBriefSynthesizer(drafter=_CleanDrafter()).synthesize(
        acme_bundle(), acme_expected_decision()
    )
    assert brief.decision_needed == "Approve the renewal?"
    assert "Two facts assembled." in brief.executive_summary
    assert "Is the pricing committee scheduled?" in brief.open_questions
    assert "Pin the committee packet." in brief.next_steps


def test_lying_drafter_cannot_make_the_brief_claim_approval():
    decision = acme_expected_decision()
    brief = GroundedBriefSynthesizer(drafter=_LyingDrafter()).synthesize(acme_bundle(), decision)
    # Gate untouched.
    assert brief.policy_gates.approval_ready is False
    # The false approval claim is dropped; the authoritative gate status remains.
    assert "the deal is approved" not in brief.executive_summary.lower()
    assert "not approval-ready" in brief.executive_summary.lower()
    assert brief.confidence != "high"


# --------------------------------------------------------------------------- #
# Clean case → high confidence + approval-ready prose (still gate-driven)
# --------------------------------------------------------------------------- #
def test_clean_ready_case_yields_high_confidence():
    bundle = ContextBundle(
        user_id="u_rm",
        intent="prepare_decision_brief",
        sources=[SourceRef(object_id="doc_a")],
        claims=ClaimMap(
            claims=[
                Claim(
                    id="c",
                    text="DSCR is 1.50.",
                    supported=True,
                    sources=[SourceRef(object_id="doc_a")],
                )
            ]
        ),
        permission_boundary=PermissionBoundary(excluded_object_ids=[]),
    )
    decision = DeterministicDecision(
        approval_ready=True,
        approvals=ApprovalMatrix(
            requirements=[ApprovalRequirement(role="credit_officer", present=True)]
        ),
    )
    brief = synthesize(bundle, decision)
    assert brief.confidence == "high"
    assert brief.policy_gates.approval_ready is True
    assert "approval-ready" in brief.executive_summary.lower()
    assert brief.permission_limitations == []

"""
evals/scorers.py — deterministic, offline scorers (WS-G).

Every scorer is a pure heuristic over a `ScoringView` — NO network, NO API key, NO LLM.
(An optional LLM judge can be layered later via `JUDGE_MODEL`; see `evals/judge.py`. It is
off by default and never runs in tests.) These scorers MEASURE quality/trust signals; they
do NOT own any pass/fail *policy* decision — that authority is WS-C's `DeterministicDecision`.
`deterministic_rule_pass` below scores whether the deterministic layer *produced the expected
decision*, which is a measurement of WS-C, not a re-implementation of it.

Applicability is keyed off `EvalCase.expected`: a scorer applies to a case iff the case
declares the relevant key. A case `passed` iff every applicable scorer meets its threshold.
The scorers map 1:1 onto the §10 trust/quality metrics.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from core.schemas import EvalCase

from .models import ScoredCase, ScoringView


@dataclass(frozen=True)
class Scorer:
    """One named scorer: when it applies, how it scores, and its pass threshold."""

    name: str
    applies: Callable[[dict], bool]
    score: Callable[[ScoringView, dict], float]
    threshold: Callable[[dict], float]


def _permission_denial_pass(view: ScoringView, expected: dict) -> float:
    """1.0 iff every expected-restricted id is excluded AND none leaked into the work product."""
    want = set(expected["excluded_object_ids"])
    excluded = set(view.excluded_object_ids)
    leaked = want & set(view.source_object_ids)
    return 1.0 if (want <= excluded and not leaked) else 0.0


def _missing_evidence_honesty(view: ScoringView, expected: dict) -> float:
    """Fraction of expected missing-evidence codes the brief honestly surfaced."""
    want = set(expected["missing_evidence_codes"])
    if not want:
        return 1.0
    present = want & set(view.missing_evidence_codes)
    return len(present) / len(want)


def _conflict_detection(view: ScoringView, expected: dict) -> float:
    """1.0 iff at least `conflict_min` conflicts were surfaced (else proportional)."""
    need = int(expected["conflict_min"])
    if need <= 0:
        return 1.0
    return min(1.0, view.conflict_count / need)


def _deterministic_rule_pass(view: ScoringView, expected: dict) -> float:
    """1.0 iff the decision matches the expected approval state AND expected failing rules.

    This measures that WS-C's deterministic layer behaved as expected; it does not decide
    anything itself.
    """
    approval_ok = view.approval_ready == bool(expected["approval_ready"])
    want_failing = set(expected.get("failing_rule_ids", []))
    failing_ok = want_failing <= set(view.failing_rule_ids)
    return 1.0 if (approval_ok and failing_ok) else 0.0


def _citation_correctness(view: ScoringView, expected: dict) -> float:
    return view.citation_coverage


def _claim_support(view: ScoringView, expected: dict) -> float:
    return view.claim_support


def _capability_gap(view: ScoringView, expected: dict) -> float:
    """0.0 by construction: a declared `known_gap` names a quality dimension the substrate
    does not yet score, so the case fails honestly until that capability is built — never a
    numeric trick (no threshold set above a perfect score)."""
    return 0.0


def _schema_validity(view: ScoringView, expected: dict) -> float:
    return 1.0 if view.schema_valid else 0.0


SCORERS: list[Scorer] = [
    Scorer(
        name="permission_denial_pass",
        applies=lambda e: "excluded_object_ids" in e,
        score=_permission_denial_pass,
        threshold=lambda e: 1.0,
    ),
    Scorer(
        name="missing_evidence_honesty",
        applies=lambda e: "missing_evidence_codes" in e,
        score=_missing_evidence_honesty,
        threshold=lambda e: float(e.get("min_missing_evidence", 1.0)),
    ),
    Scorer(
        name="conflict_detection",
        applies=lambda e: "conflict_min" in e,
        score=_conflict_detection,
        threshold=lambda e: 1.0,
    ),
    Scorer(
        name="deterministic_rule_pass",
        applies=lambda e: "approval_ready" in e,
        score=_deterministic_rule_pass,
        threshold=lambda e: 1.0,
    ),
    Scorer(
        name="citation_correctness",
        applies=lambda e: "min_citation_coverage" in e,
        score=_citation_correctness,
        threshold=lambda e: float(e["min_citation_coverage"]),
    ),
    Scorer(
        name="claim_support",
        applies=lambda e: "min_claim_support" in e,
        score=_claim_support,
        threshold=lambda e: float(e["min_claim_support"]),
    ),
    # A declared capability gap: the case names a quality dimension (`known_gap`) the substrate
    # does not yet score. Scores 0.0 against a 1.0 threshold, so it fails deterministically and
    # honestly — the gap is visible, not engineered with a bar set above a perfect score.
    Scorer(
        name="capability_gap",
        applies=lambda e: "known_gap" in e,
        score=_capability_gap,
        threshold=lambda e: 1.0,
    ),
    # schema_validity always applies — every output must validate against its schema.
    Scorer(
        name="schema_validity",
        applies=lambda e: True,
        score=_schema_validity,
        threshold=lambda e: 1.0,
    ),
]

# The four columns of the three-vertical RecipeScorecard (§14).
SCORECARD_DIMENSIONS: list[str] = [
    "deterministic_rule_pass",
    "citation_correctness",
    "permission_denial_pass",
    "missing_evidence_honesty",
]


def score_view(view: ScoringView, case: EvalCase) -> ScoredCase:
    """Score a `ScoringView` against a case's expectations.

    The SAME function scores both live runs (view from `CaseRun.scoring_view()`) and
    replayed runs (view from a persisted `ReplayRecord`) — which is precisely why
    replay reproduces live scores exactly.
    """
    expected = case.expected
    scores: dict[str, float] = {}
    thresholds: dict[str, float] = {}
    for scorer in SCORERS:
        if not scorer.applies(expected):
            continue
        scores[scorer.name] = scorer.score(view, expected)
        thresholds[scorer.name] = scorer.threshold(expected)
    passed = all(scores[name] >= thresholds[name] for name in scores)
    return ScoredCase(case=case, scores=scores, thresholds=thresholds, passed=passed)

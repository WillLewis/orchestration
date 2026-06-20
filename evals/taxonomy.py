"""
evals/taxonomy.py — failure taxonomy (WS-G).

Maps a failing scorer to a typed `FeedbackReasonCode` (§5 F5). This is the bridge from
eval failures to the regression set: accept/edit/reject + scorer failures become structured
reason codes that seed a `RegressionSuite`, and the primary code stamps a
`RedactedFailurePacket.failure_reason_code`. Codes and categories only — never raw content.
"""
from __future__ import annotations

from core.schemas import FeedbackReasonCode

from .models import ScoredCase

# scorer name → typed reason code. Categories are the contract's closed set:
# accuracy | permission | policy | formatting | other.
REASON_CODES: dict[str, FeedbackReasonCode] = {
    "permission_denial_pass": FeedbackReasonCode(
        code="permission_leak",
        label="Restricted content reached the work product",
        category="permission",
    ),
    "deterministic_rule_pass": FeedbackReasonCode(
        code="wrong_policy_gate",
        label="Deterministic gate decision did not match expectation",
        category="policy",
    ),
    "missing_evidence_honesty": FeedbackReasonCode(
        code="hidden_missing_evidence",
        label="Failed to disclose missing evidence",
        category="accuracy",
    ),
    "conflict_detection": FeedbackReasonCode(
        code="missed_conflict",
        label="Did not surface conflicting evidence",
        category="accuracy",
    ),
    "citation_correctness": FeedbackReasonCode(
        code="weak_citation_coverage",
        label="Claims were under-cited",
        category="accuracy",
    ),
    "claim_support": FeedbackReasonCode(
        code="unsupported_claim",
        label="Claims were not supported by sources",
        category="accuracy",
    ),
    "schema_validity": FeedbackReasonCode(
        code="schema_invalid",
        label="Output failed schema validation",
        category="formatting",
    ),
}

_UNKNOWN = FeedbackReasonCode(code="unknown_failure", label="Unclassified failure", category="other")


def reason_for(scorer_name: str) -> FeedbackReasonCode:
    """The typed reason code for a scorer, or a generic `other` fallback."""
    return REASON_CODES.get(scorer_name, _UNKNOWN)


def failure_taxonomy(scored: ScoredCase) -> list[FeedbackReasonCode]:
    """All typed reason codes for a scored case's failing scorers (empty if it passed)."""
    return [reason_for(name) for name in scored.failures()]


def primary_failure_code(scored: ScoredCase) -> str | None:
    """The first failing scorer's reason code (stamps a `RedactedFailurePacket`)."""
    codes = failure_taxonomy(scored)
    return codes[0].code if codes else None

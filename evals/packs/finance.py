"""
evals/packs/finance.py — the finance hero EvalPack (WS-G).

Cases derived from `fixtures.acme`: they run through the WS-0 stub pipeline (no embedded
scenario), so the harness pulls the canonical Acme context/decision via `core.demo` stubs.
Each case sets exactly the `expected` keys for the dimension it probes — `evals.scorers`
keys applicability off which keys are present. The five cases mirror the §10 trust/quality
metrics: permission-denial, missing-evidence honesty, conflict detection, deterministic-rule
pass, and citation/claim support.

`expected.intent_class` is a CONTROLLED label (never the free-text prompt) — it is the only
intent signal that may enter telemetry. See `evals/telemetry_emit.py`.
"""
from __future__ import annotations

from core.schemas import EvalCase, EvalPack

FINANCE_PACK_ID = "finance_hero_v1"


def finance_pack() -> EvalPack:
    """The credit/risk-committee hero pack over the Acme renewal scenario."""
    return EvalPack(
        id=FINANCE_PACK_ID,
        vertical="finance",
        cases=[
            EvalCase(
                id="fin_permission_denial",
                vertical="finance",
                prompt="Why did Legal reject the Acme discount?",
                kind="synthetic",
                expected={
                    "intent_class": "answer_with_sources",
                    "excluded_object_ids": ["doc_legal_memo"],
                },
            ),
            EvalCase(
                id="fin_missing_evidence_honesty",
                vertical="finance",
                prompt="Prepare the Acme renewal decision brief for the 2pm credit committee.",
                kind="synthetic",
                expected={
                    "intent_class": "prepare_decision_brief",
                    "missing_evidence_codes": ["missing_covenant_tracker"],
                },
            ),
            EvalCase(
                id="fin_conflict_detection",
                vertical="finance",
                prompt="What changed since the last Acme review?",
                kind="synthetic",
                expected={
                    "intent_class": "what_changed",
                    "conflict_min": 1,
                },
            ),
            EvalCase(
                id="fin_deterministic_rule_pass",
                vertical="finance",
                prompt="Can we mark the Acme pricing exception approved?",
                kind="synthetic",
                expected={
                    "intent_class": "check_approval_readiness",
                    "approval_ready": False,
                    "failing_rule_ids": ["missing_approver", "approval_threshold"],
                },
            ),
            EvalCase(
                id="fin_citation_claim_support",
                vertical="finance",
                prompt="Summarize the key Acme financial facts with citations.",
                kind="synthetic",
                expected={
                    "intent_class": "verify_citations",
                    "min_citation_coverage": 1.0,
                    "min_claim_support": 1.0,
                },
            ),
        ],
    )

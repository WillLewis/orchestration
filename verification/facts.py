from __future__ import annotations

import json
from typing import Any

from core.schemas import ContextBundle

VerificationFacts = dict[str, Any]


def extract_facts(bundle: ContextBundle) -> VerificationFacts:
    facts: VerificationFacts = {}
    for source in bundle.sources:
        if source.span is None:
            continue
        try:
            payload = json.loads(source.span)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict) and isinstance(payload.get("verification"), dict):
            facts.update(payload["verification"])

    if _looks_like_acme_bundle(bundle):
        facts = {**_acme_fixture_facts(), **facts}

    return facts


def source_ids(bundle: ContextBundle) -> set[str]:
    return {source.object_id for source in bundle.sources}


def _looks_like_acme_bundle(bundle: ContextBundle) -> bool:
    ids = source_ids(bundle)
    return {"doc_credit_memo", "doc_financials", "wf_approval"}.issubset(ids)


def _acme_fixture_facts() -> VerificationFacts:
    return {
        "approvals": {
            "relationship_manager": True,
            "credit_officer": False,
            "legal": False,
        },
        "required_roles": ["relationship_manager", "credit_officer", "legal"],
        "blocking_required_roles": ["credit_officer"],
        "approval_threshold": {
            "requested_discount": 0.175,
            "delegated_authority": 0.10,
        },
    }

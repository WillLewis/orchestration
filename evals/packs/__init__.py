"""
evals/packs/ — EvalPacks authored as data (WS-G).

The registry resolves a `pack_id` to a freshly built `EvalPack`. `THREE_VERTICAL` is a
meta-id handled by `evals.scorecard` / `evals.run` (it aggregates the three concrete
packs into one `RecipeScorecard`); it is intentionally NOT in `PACK_BUILDERS`, so
`get_pack("three_vertical")` raises — callers must go through the scorecard path.
"""
from __future__ import annotations

from collections.abc import Callable

from core.schemas import EvalPack

from .finance import FINANCE_PACK_ID, finance_pack
from .health import HEALTH_PACK_ID, health_pack
from .legal import LEGAL_PACK_ID, legal_pack

THREE_VERTICAL = "three_vertical"

# Ordered finance → legal → health: the three-vertical proof reads in this order.
PACK_BUILDERS: dict[str, Callable[[], EvalPack]] = {
    FINANCE_PACK_ID: finance_pack,
    LEGAL_PACK_ID: legal_pack,
    HEALTH_PACK_ID: health_pack,
}

VERTICAL_PACK_IDS: list[str] = [FINANCE_PACK_ID, LEGAL_PACK_ID, HEALTH_PACK_ID]


def get_pack(pack_id: str) -> EvalPack:
    """Build and return the pack for `pack_id`, or raise `KeyError` if unknown."""
    try:
        return PACK_BUILDERS[pack_id]()
    except KeyError as exc:
        known = ", ".join(PACK_BUILDERS)
        raise KeyError(f"unknown pack_id {pack_id!r}; known packs: {known}") from exc


def all_packs() -> list[EvalPack]:
    """Build every concrete vertical pack (finance, legal, health)."""
    return [PACK_BUILDERS[pid]() for pid in VERTICAL_PACK_IDS]


__all__ = [
    "FINANCE_PACK_ID",
    "LEGAL_PACK_ID",
    "HEALTH_PACK_ID",
    "THREE_VERTICAL",
    "VERTICAL_PACK_IDS",
    "PACK_BUILDERS",
    "get_pack",
    "all_packs",
    "finance_pack",
    "legal_pack",
    "health_pack",
]

"""
evals/judge.py — optional LLM-judge seam (WS-G).

The default scorers in `evals.scorers` are deterministic/heuristic and run fully offline.
An LLM judge is strictly OPTIONAL augmentation, enabled only when a judge model is routed
via env (`JUDGE_MODEL`) AND the matching provider key is present. With neither (the default,
and always in `make test`/`make eval`), `maybe_judge()` returns `None` and nothing here ever
touches the network.

Model routing is via env — never hardcode a model name (CLAUDE.md / CONTRIBUTING.md §7).
The judge would only ever see already-redacted, content-free signals or synthetic fixtures;
it never owns a pass/fail policy decision (that's WS-C).
"""
from __future__ import annotations

import os
from typing import Optional, Protocol, runtime_checkable

from .models import ScoringView


@runtime_checkable
class Judge(Protocol):
    """An optional model-based scorer. `score` returns a value in [0, 1]."""

    name: str

    def score(self, view: ScoringView) -> float: ...


def judge_model() -> Optional[str]:
    """The routed judge model id, or None if unset (JUDGE_MODEL env)."""
    return os.getenv("JUDGE_MODEL") or None


def _provider_key_present(model: str) -> bool:
    lowered = model.lower()
    if lowered.startswith(("claude", "anthropic")):
        return bool(os.getenv("ANTHROPIC_API_KEY"))
    if lowered.startswith(("gpt", "o1", "o3", "openai")):
        return bool(os.getenv("OPENAI_API_KEY"))
    return False


def maybe_judge() -> Optional[Judge]:
    """Return a configured `Judge`, or None when offline / unconfigured (the default).

    Intentionally returns None unless a judge is both routed (`JUDGE_MODEL`) and has a
    provider key — so the harness stays offline-by-default. Wiring an actual API-backed
    judge is left to whoever opts in; this function is the single gate that decides whether
    a judge is available at all.
    """
    model = judge_model()
    if model is None or not _provider_key_present(model):
        return None
    # A real API-backed judge would be constructed here. Kept None so importing this module
    # never implies a network dependency; opt-in wiring lives behind this gate.
    return None

"""
evals/integrations.py — optional Braintrust / W&B trace export (WS-G).

Both are in Box's stack, so the harness can stream eval traces to them — but ONLY when the
relevant API key is present in the environment. With no keys (the default, and always in
`make test`/`make eval`), `build_exporters()` returns `[]` and the runner exports nothing.

Two hard rules:
1. OFFLINE BY DEFAULT — never import or call the SDKs unless the key check passes; wrap
   everything in a broad try/except so a misconfigured/missing dependency degrades to no-op.
2. PRIVACY — export only the already-redacted `TelemetryEvent` (counts/buckets/scores) and
   the typed `EvalResult`. Never the brief, bundle, claims, or any raw content.
"""
from __future__ import annotations

import os
from typing import Protocol, runtime_checkable

from core.schemas import EvalResult, TelemetryEvent


@runtime_checkable
class TraceExporter(Protocol):
    """A privacy-safe sink for external observability backends."""

    def log(self, event: TelemetryEvent, result: EvalResult) -> None: ...
    def close(self) -> None: ...


class NullExporter:
    """No-op exporter used whenever a backend is unavailable."""

    def log(self, event: TelemetryEvent, result: EvalResult) -> None:
        return None

    def close(self) -> None:
        return None


def braintrust_enabled() -> bool:
    return bool(os.getenv("BRAINTRUST_API_KEY"))


def wandb_enabled() -> bool:
    return bool(os.getenv("WANDB_API_KEY"))


class _BraintrustExporter:
    """Thin Braintrust wrapper. Logs the redacted event payload + scores only."""

    def __init__(self, experiment: object) -> None:
        self._experiment = experiment

    def log(self, event: TelemetryEvent, result: EvalResult) -> None:
        try:
            self._experiment.log(  # type: ignore[attr-defined]
                input={"case_id": result.case_id, "intent_class": event.intent_class},
                output={"passed": result.passed, "scores": result.scores},
                metadata=event.model_dump(mode="json"),
            )
        except Exception:  # noqa: BLE001 - never let telemetry break an eval run
            return None

    def close(self) -> None:
        try:
            self._experiment.flush()  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            return None


class _WandbExporter:
    """Thin W&B wrapper. Logs the redacted event payload + scores only."""

    def __init__(self, run: object) -> None:
        self._run = run

    def log(self, event: TelemetryEvent, result: EvalResult) -> None:
        try:
            payload = {"case_id": result.case_id, "passed": result.passed}
            payload.update({f"score.{k}": v for k, v in result.scores.items()})
            payload.update(event.model_dump(mode="json"))
            self._run.log(payload)  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            return None

    def close(self) -> None:
        try:
            self._run.finish()  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            return None


def _try_braintrust() -> TraceExporter | None:
    try:
        import braintrust  # type: ignore[import-not-found]

        experiment = braintrust.init(
            project=os.getenv("BRAINTRUST_PROJECT", "connectwork-evals")
        )
        return _BraintrustExporter(experiment)
    except Exception:  # noqa: BLE001 - missing dep / bad key → no-op
        return None


def _try_wandb() -> TraceExporter | None:
    try:
        import wandb  # type: ignore[import-not-found]

        run = wandb.init(
            project=os.getenv("WANDB_PROJECT", "connectwork-evals"),
            job_type="eval",
            reinit=True,
        )
        return _WandbExporter(run)
    except Exception:  # noqa: BLE001
        return None


def build_exporters() -> list[TraceExporter]:
    """Every enabled exporter. Empty offline (no keys) — the default everywhere in CI."""
    exporters: list[TraceExporter] = []
    if braintrust_enabled():
        exporter = _try_braintrust()
        if exporter is not None:
            exporters.append(exporter)
    if wandb_enabled():
        exporter = _try_wandb()
        if exporter is not None:
            exporters.append(exporter)
    return exporters

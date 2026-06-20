"""evals/tests/test_cli_integrations.py — CLI runs offline; integrations no-op without keys."""
from __future__ import annotations

import json

import pytest

from core.schemas import EvalResult, TelemetryEvent
from evals import run as run_cli
from evals.integrations import (
    NullExporter,
    braintrust_enabled,
    build_exporters,
    wandb_enabled,
)


def test_build_exporters_empty_without_keys(monkeypatch):
    monkeypatch.delenv("BRAINTRUST_API_KEY", raising=False)
    monkeypatch.delenv("WANDB_API_KEY", raising=False)
    assert braintrust_enabled() is False
    assert wandb_enabled() is False
    assert build_exporters() == []


def test_null_exporter_is_noop():
    exporter = NullExporter()
    # Must accept a privacy-safe payload and do nothing, without raising.
    exporter.log(
        TelemetryEvent(intent_class="x", recipe_id="r"),
        EvalResult(case_id="c", passed=True, scores={}),
    )
    exporter.close()


def test_cli_three_vertical_exits_zero(capsys):
    rc = run_cli.main(["--pack", "three_vertical"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "RecipeScorecard" in out
    assert "finance" in out and "legal" in out and "health" in out


def test_cli_single_pack_json(capsys):
    rc = run_cli.main(["--pack", "finance_hero_v1", "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert len(payload) == 5
    assert all(item["passed"] for item in payload)


def test_cli_record_and_telemetry(tmp_path, capsys):
    path = tmp_path / "rec.json"
    rc = run_cli.main(
        ["--pack", "health_thin_v1", "--emit-telemetry", "--record", str(path)]
    )
    assert rc == 0
    out = capsys.readouterr().out
    assert "recorded 4 ReplayRecords" in out
    assert "telemetry: 4 events" in out
    assert path.exists()


def test_cli_unknown_pack_raises():
    with pytest.raises(KeyError):
        run_cli.main(["--pack", "nope"])

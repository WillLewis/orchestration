"""
evals/run.py — the WS-G CLI (offline by default).

    python -m evals.run --pack three_vertical      # the §14 three-vertical scorecard
    python -m evals.run --pack finance_hero_v1      # one pack's per-case results
    python -m evals.run --pack three_vertical --json
    python -m evals.run --pack finance_hero_v1 --emit-telemetry --record runs/finance.json

Wired into `make eval`. No network, no API keys required — Braintrust/W&B export only
engages when the matching key is in the environment (see `evals.integrations`).
"""
from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from typing import Optional

from core.schemas import EvalResult

from .integrations import build_exporters
from .packs import PACK_BUILDERS, THREE_VERTICAL, get_pack
from .replay import ReplayRecorder
from .runner import EvalHarnessRunner
from .scorecard import build_ops_scorecard, render_ops_scorecard
from .telemetry_emit import InMemorySink


def _render_results(pack_id: str, results: list[EvalResult]) -> str:
    passed = sum(1 for r in results if r.passed)
    lines = [f"EvalPack — {pack_id}  ({passed}/{len(results)} cases passed)", ""]
    for r in results:
        flag = "PASS" if r.passed else "FAIL"
        scores = " ".join(f"{k}={v:.2f}" for k, v in sorted(r.scores.items()))
        lines.append(f"  [{flag}] {r.case_id:<32} {scores}")
    return "\n".join(lines)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="evals.run", description="WS-G offline eval harness")
    parser.add_argument(
        "--pack",
        default=THREE_VERTICAL,
        help=(
            "pack id, or 'three_vertical' (default). Known: "
            f"{', '.join([THREE_VERTICAL, *PACK_BUILDERS])}"
        ),
    )
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    parser.add_argument(
        "--emit-telemetry",
        action="store_true",
        help="collect privacy-safe TelemetryEvents and print a summary count",
    )
    parser.add_argument(
        "--record",
        metavar="PATH",
        help="persist ReplayRecords (trace + scoring view) to PATH for offline replay",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = _build_parser().parse_args(argv)

    if args.pack == THREE_VERTICAL:
        report = build_ops_scorecard()
        if args.json:
            print(json.dumps(report.model_dump(mode="json"), indent=2))
        else:
            print(render_ops_scorecard(report))
        return 0

    # Single-pack run (validates the id eagerly so unknown packs fail clearly).
    get_pack(args.pack)
    sink = InMemorySink() if args.emit_telemetry else None
    recorder = ReplayRecorder(args.record) if args.record else None
    runner = EvalHarnessRunner(sink=sink, recorder=recorder, exporters=build_exporters())

    results = runner.run(args.pack)

    if args.json:
        print(json.dumps([r.model_dump(mode="json") for r in results], indent=2))
    else:
        print(_render_results(args.pack, results))

    if recorder is not None:
        path = recorder.flush()
        print(f"\nrecorded {len(recorder.records)} ReplayRecords → {path}")
    if sink is not None:
        print(
            f"\ntelemetry: {len(sink.events)} events, "
            f"{len(sink.failures)} redacted failure packets (no raw content)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

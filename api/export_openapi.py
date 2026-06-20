"""
api/export_openapi.py — write the gateway's OpenAPI schema to `frontend/openapi.json`.

The frontend can codegen a typed client from this so its data shapes stay in lockstep with the
API. Deterministic + offline (it only introspects the FastAPI app). Run via `make openapi`.
"""
from __future__ import annotations

import json
from pathlib import Path

from api.main import app

OUTPUT = Path(__file__).resolve().parents[1] / "frontend" / "openapi.json"


def export() -> Path:
    OUTPUT.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n")
    return OUTPUT


def main() -> None:
    path = export()
    print(f"wrote {path}")


if __name__ == "__main__":
    main()

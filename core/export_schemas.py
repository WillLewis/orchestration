"""
core/export_schemas.py — export every contract model's JSON Schema (WS-0).

Writes `frontend/schemas.json` for the Lovable frontend (WS-H). Enums are inlined
into each model's `$defs`, so the file is a {model_name: json_schema} map of the
Pydantic models in `core.schemas.__all__`.

Run via `make schemas-json` or `python -m core.export_schemas`.
"""
from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel

import core.schemas as schemas

OUTPUT = Path(__file__).resolve().parent.parent / "frontend" / "schemas.json"


def build_schemas() -> dict[str, dict]:
    """Map every exported Pydantic model name -> its JSON Schema (sorted, deterministic)."""
    out: dict[str, dict] = {}
    for name in schemas.__all__:
        obj = getattr(schemas, name)
        if isinstance(obj, type) and issubclass(obj, BaseModel) and obj is not BaseModel:
            out[name] = obj.model_json_schema()
    return dict(sorted(out.items()))


def main() -> None:
    data = build_schemas()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, indent=2) + "\n")
    print(f"wrote {OUTPUT} ({len(data)} models)")


if __name__ == "__main__":
    main()

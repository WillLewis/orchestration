"""
tests/test_schema_export.py — WS-0. `make schemas-json` must stay correct.

The export covers every contract model and includes the headline primitives the
Lovable frontend (WS-H) binds to.
"""
from pydantic import BaseModel

from core import schemas as s
from core.export_schemas import build_schemas

HEADLINE = [
    "ContextBundle",
    "SourceGraph",
    "RulePack",
    "DecisionBrief",
    "ActionDiff",
    "WorkProductContract",
    "ChangeImpactMap",
    "EvalTrace",
    "EvalPack",
    "RecipeScorecard",
    "TelemetryEvent",
]


def test_export_covers_every_model():
    exported = set(build_schemas())
    expected = {
        n
        for n in s.__all__
        if isinstance(getattr(s, n), type)
        and issubclass(getattr(s, n), BaseModel)
        and getattr(s, n) is not BaseModel
    }
    assert exported == expected


def test_export_includes_headline_primitives():
    schemas_map = build_schemas()
    for name in HEADLINE:
        assert name in schemas_map, f"{name} missing from schema export"
        assert schemas_map[name]["type"] == "object"

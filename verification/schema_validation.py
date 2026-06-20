from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel, ValidationError

from core.schemas import DecisionBrief, SchemaValidation

_SCHEMAS: dict[str, type[BaseModel]] = {
    "DecisionBrief": DecisionBrief,
}


class SchemaValidator:
    def validate(self, schema_name: str, payload: Mapping[str, Any]) -> SchemaValidation:
        model = _SCHEMAS.get(schema_name)
        if model is None:
            return SchemaValidation(
                schema_name=schema_name,
                valid=False,
                errors=[f"Unknown schema: {schema_name}"],
            )

        try:
            model.model_validate(dict(payload))
        except ValidationError as exc:
            return SchemaValidation(
                schema_name=schema_name,
                valid=False,
                errors=[_format_error(error) for error in exc.errors()],
            )

        return SchemaValidation(schema_name=schema_name, valid=True)


def _format_error(error: dict[str, Any]) -> str:
    loc = ".".join(str(part) for part in error["loc"])
    return f"{loc}: {error['msg']}"

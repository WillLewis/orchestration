.PHONY: install test lint run eval schemas-json fmt

install:    ## install runtime + dev deps
	pip install -e ".[dev]" --break-system-packages

test:       ## run the test suite
	pytest -q

lint:       ## lint
	ruff check .

fmt:        ## auto-fix lint
	ruff check . --fix

schemas-json:  ## export JSON Schema for the Lovable frontend (WS-H)
	python -c "import json,core.schemas as s; from pydantic import TypeAdapter; \
print(json.dumps({n: getattr(s,n).model_json_schema() for n in s.__all__ if hasattr(getattr(s,n),'model_json_schema')}, indent=2))" > frontend/schemas.json
	@echo "wrote frontend/schemas.json"

eval:       ## run the three-vertical eval proof (WS-G/WS-I)
	@echo "TODO(WS-G): python -m evals.run --pack three_vertical"

run:        ## run the demo pipeline end-to-end (integration)
	@echo "TODO(integration): python -m core.demo"

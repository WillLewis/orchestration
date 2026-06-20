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
	python -m core.export_schemas

eval:       ## run the three-vertical eval proof (WS-G/WS-I)
	python -m evals.run --pack three_vertical

run:        ## run the demo pipeline end-to-end (integration)
	python -m core.demo

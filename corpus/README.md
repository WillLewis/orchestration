# corpus/ — WS-A (Codex)

Status: implemented deterministic synthetic corpus data for finance, legal, and health.
All objects conform to `core.schemas.WorkspaceObject`; no `core/` or `fixtures/` edits.

## API

```python
import corpus

finance_objects = corpus.load("finance")
legal_objects = corpus.load("legal")
health_objects = corpus.load("health")

matrix = corpus.authority_matrix("finance")
events = corpus.change_events()
changed = corpus.apply_change(finance_objects, "legal_needs_review")
```

## Finance hooks

`load("finance")` is a superset of `fixtures.acme.acme_workspace()` and preserves fixture ids.
It includes the Acme meeting history, deal-room chat, credit memo, private-side financials,
restricted legal memo, public-side research note, pricing exception, conflicting CS plan,
approval workflow, and upload-tracker task.

Key downstream hooks:
- WS-B: ACLs, information barriers, missing final covenant tracker, conflicting discounts.
- WS-C: `authority_matrix("finance")`, 22% pricing exception, missing Credit Officer approval.
- WS-F: `apply_change(..., "legal_needs_review")` and `"financials_v2"` for stale sections.
- WS-I: legal and health stubs for the three-vertical proof.

Note: `wf_approval.metadata["expected_documents"]` intentionally lists
`"final_covenant_tracker"` while no object with that id is returned. This is the missing-evidence
hook for context and verification.

## Tests

Run:

```bash
python -m pytest tests/test_corpus.py -q
make test
make lint
```

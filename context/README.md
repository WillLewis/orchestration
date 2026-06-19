# context/ — WS-B (Claude) · Permission-aware context assembly

**Status: ✅ implemented.** `PermissionAwareContextAssembler` satisfies
`core.pipeline.ContextAssembler` and turns `(user_id, intent)` into a grounded,
permission-safe `ContextBundle`. Builds against `fixtures.acme`; swap in WS-A's
`corpus.load(vertical)` later with zero code changes (inject a `workspace_loader`).

## What it produces
`assemble(user_id, intent) -> ContextBundle` with:
- **`sources`** — the objects the user may read (permission filter runs **first**).
- **`source_graph`** — a `SourceGraph` over *only* the accessible objects.
- **`claims`** — a `ClaimMap`; each claim is `supported` iff it retains an accessible
  citation after scrubbing.
- **`permission_boundary`** — ids excluded by ACL / sensitivity (edge case 1).
- **`missing_evidence`** — recipe evidence checklist (e.g. `missing_covenant_tracker`, blocking).
- **`conflicts`** — generic cross-object metadata disagreements, recipe-declared scenario
  conflicts (pricing doc vs. CS plan discount), and **information-barrier / mosaic** flags
  (edge case 4).

## Design guarantees (the non-negotiables)
1. **Permission filter first.** Denied objects are dropped before any metadata/content is
   read, so denied content can never reach a source, claim, graph node, or LLM prompt. The
   restricted legal memo's *id* is disclosed in `permission_boundary` (edge case 1), but its
   content is never used.
2. **Deterministic/probabilistic boundary.** A `ClaimExtractor` (LLM seam, routed via
   `PLANNER_MODEL`) may only *propose* claims + citations. WS-B scrubs citations to the
   accessible set and sets `supported` deterministically — the model never makes a pass/fail
   call. Approvals/calculations/policy gates stay in WS-C.
3. **Mosaic gate.** A readable barrier-tagged object that would cross an information barrier
   when synthesized into the shared packet is **held out of `sources` and flagged**, not
   silently included.

## Permission model
A user can read an object iff they are a listed reader (by user id **or** role) **and** pass
the sensitivity gate: `public`/`internal` → allowed; `restricted` → requires a role in
`PermissionPolicy.restricted_clearance_roles` (default `{legal, compliance}`); `barrier` →
readable, but synthesis is governed by the mosaic gate (`PermissionPolicy.packet_barrier_sides`,
default `{private-side}`). All policy is config, not code.

## Acme result (for `u_rm`, `prepare_decision_brief`)
- sources: `mtg_committee_0612, doc_credit_memo, doc_financials, wf_approval`
- excluded: `doc_legal_memo` (restricted, RM not cleared)
- held out (mosaic): `doc_research_publicside` (public-side note → barrier conflict)
- claims: 3 supported (revenue $42M→$38M, DSCR 1.28, approval state) + 1 unsupported
  (covenant compliance — tracker missing)
- missing evidence: `missing_covenant_tracker` (blocking), `missing_risk_rating_approval` (info)
- conflicts: pricing/CS-plan discount; information-barrier mosaic flag

## How to run
```bash
make install            # once
make test               # full suite incl. context/tests (offline; no API key)
make lint               # ruff, line length 100
python -m context.assembler          # print the assembled Acme bundle
python -c "from context import assemble_acme_demo; print(assemble_acme_demo())"
```

## Tests (`context/tests/`)
- `test_context_assembler.py` — protocol satisfaction, bundle shape vs. `acme_bundle`,
  supported/unsupported claims, missing-evidence + conflict detection, safe source graph,
  JSON round-trip.
- `test_context_permissions.py` — denied content never leaves the boundary, restricted
  clearance, unknown-user default-deny, mosaic held-out/flagged (and same-side inclusion),
  LLM-cited denied/unknown ids scrubbed to unsupported, generic metadata conflict probe.

## Extending to a new vertical
Pass a `Recipe` (required evidence, declared conflicts, source relations, conflict-probe
keys) and a `workspace_loader`. No assembler changes needed. An LLM extractor is available
(`LLMClaimExtractor`, env-routed) but the default is the offline `HeuristicClaimExtractor`.

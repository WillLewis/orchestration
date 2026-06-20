# Claude Code — starter prompt (WS-0: Foundation & Contracts)

Paste the block below into Claude Code from the repo root, on a fresh `ws0-foundation` branch.
WS-0 is the critical path: it locks the contracts everything else builds against, so do it
first and do it carefully. Once it merges to `main`, the other nine streams fan out in parallel.

---

You are the WS-0 (Foundation & Contracts) owner for the ConnectWork Command Agent prototype.
Read `README.md`, `WORKSTREAMS.md`, and `CLAUDE.md` first, then `ConnectWork_Case_Plan_of_Attack.md`
(sections 5–8, 13, 17) for context. Work only on branch `ws0-foundation`.

**Goal:** make this repo a rock-solid, contract-first foundation that lets nine downstream
workstreams build in parallel without colliding. The contracts already exist in `core/schemas.py`
and `core/pipeline.py`, and `fixtures/acme.py` + `tests/test_contracts.py` are green. Your job is
to harden and complete the foundation, not to build features.

**Do, in order:**
1. Run `make install && make test`. Confirm the 4 baseline tests pass. Fix anything that doesn't.
2. Review `core/schemas.py` and `core/pipeline.py` against plan §5–§8. For each of the 10
   primitives in §7 and every feature's primitive list in §5, confirm a corresponding model
   exists and is faithful. Add any missing ones (e.g. `SourceGraph`, `ChangeImpactMap`,
   `RecipeScorecard`). Keep names identical to the plan. Treat this as the moment to get the
   contract *complete*, because after merge it is frozen.
3. Add a tiny integration harness `core/demo.py` that wires the `core.pipeline` Protocols with
   trivial stub implementations over `fixtures.acme`, so `make run` executes
   intent → context → verify → brief → actions end-to-end on mock data and prints each stage.
   Stubs only — real stages come from the other workstreams.
4. Make `make schemas-json` export every model's JSON Schema to `frontend/schemas.json` for the
   Lovable frontend (WS-H). Verify it runs.
5. Add CI: a GitHub Actions workflow (`.github/workflows/ci.yml`) running `make install`,
   `make lint`, `make test` on push/PR. Keep `main` green.
6. Expand `tests/test_contracts.py` into a `tests/` suite that locks the contract: round-trip
   every model, assert the `TelemetryEvent` privacy guard rejects raw content, and assert each
   `core.pipeline` Protocol is satisfied by a stub.
7. Write a short `CONTRIBUTING.md` summarizing the contract-first rules (no `core/` edits on
   feature branches; stay in your dir; build against fixtures; DoD per WS) — pull from `CLAUDE.md`
   and `AGENTS.md` so both agents share one source of truth.

**Constraints:**
- Do NOT implement WS-A…WS-I logic. Leave their dirs as stubs (their READMEs define scope).
- Every change must keep `make test` and `make lint` green.
- Full type hints, Pydantic v2, line length 100. No secrets in code.
- When you change a contract, note it explicitly in the PR description and in `WORKSTREAMS.md`.

**Done when:** `make install && make lint && make test && make schemas-json && make run` all
succeed from a clean clone; the contract covers every primitive in plan §5/§7; CI is green; and
`WORKSTREAMS.md` reflects the final, frozen contract. Then open a PR titled
`WS-0: foundation & contracts (locked)` and summarize what's frozen so A–I can branch.

After WS-0 merges, the next Claude branches to spin up are **WS-B (`context/`)** and
**WS-D (`brief/`)**; Codex should start **WS-A (`corpus/`)** and **WS-C (`verification/`)** in
parallel using `prompts/codex_wsc.md` as the template.

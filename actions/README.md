# actions/ — WS-E · Safe Action Composer + Controlled Work Loop

**Status: ✅ implemented (both phases).** Built engine-first: a deterministic core (Phase 1, no
LLM) with the LLM composer + work loop on top (Phase 2). The governing principle throughout:
**the LLM proposes; the deterministic engine decides what is allowed and executes — a model can
never override a gate** (proven in [`tests/test_redteam_gate_override.py`](tests/test_redteam_gate_override.py)).

## Phase 1 — deterministic engine (no LLM) · [`engine.py`](engine.py) · [`toolcards.py`](toolcards.py)
- **`ToolCardRegistry`** — `create_task`, `update_project_status`, `route_approval`,
  `draft_internal_note`, `schedule_meeting` (each a `ToolCard` with `side_effect` + `input_schema`).
- **`ActionValidationEngine.validate_action(action, bundle, recipe=None, *, approvals=None)`** —
  re-derives `blocked_reason` from five gates (model-supplied values are ignored):
  - **permission** — every `action.sources` object must be accessible (not in the bundle's
    `permission_boundary`, and ACL-readable by the actor).
  - **mosaic / information-barrier** — block when sources combine `public-side` + `private-side`.
  - **injection** — scan source *content* for hidden-instruction patterns; strip + block.
  - **missing-evidence** — block status-advancing writes while a *blocking* `MissingEvidenceState`
    is unresolved (routing for sign-off is still allowed).
  - **approval** — a `write` / `route_approval` with a `required_approver` is held until that
    approver is present.
- **`build_diff` / `DryRunExecutor.dry_run`** — previewable before/after diffs, zero side effects.
- **`WorkspaceExecutor.execute(plan, approved_indices)`** (`core.pipeline.Executor`) — applies
  ONLY approved, non-blocked actions to an in-memory workspace; records skipped/blocked.
- **`rollback(audit_event)` / `build_rollback_plan`** — inverse diff restores prior state.

## Phase 2 — composer + loop + personas (LLM, on the engine)
- **`SafeActionComposer.compose(brief, bundle)`** ([`composer.py`](composer.py),
  `core.pipeline.ActionComposer`) — an injectable proposer maps `brief.next_steps` onto ToolCards;
  **every** candidate is then run through `validate_action` + `build_diff`. `summarize_plan` gives
  the "*N follow-ups — X draftable, Y need approval routing, Z blocked*" split, derived entirely
  from engine validation. Proposers: `HeuristicActionProposer` (offline default) ·
  `LLMActionProposer` (routed via `PLANNER_MODEL`).
- **`SafeActionComposer.compose_staged_remediation(remediation, brief, bundle)`** — validates one
  Decision Brief readiness-row remediation into one drawer card. This is the anti-drift seam for
  staged row actions: the card is rebuilt from the row descriptor and re-gated by the engine.
- **`ControlledWorkLoop.run(brief, bundle)`** ([`loop.py`](loop.py)) — five pure `(state)->state`
  nodes: **distribute → collect → escalate → schedule → close**. A **human-approval step**
  (`approver` callback, default `approve_nonblocked`) precedes execution; the loop calls
  `Executor.execute` only on approved, non-blocked actions and emits the audit dossier (`LoopState`).
- **Personas** ([`personas.py`](personas.py)) — seeded counterparties (credit officer, legal,
  analyst, compliance). Client is injectable: `StubPersonaClient` (offline) · `LLMPersonaClient`
  (routed via `PERSONA_MODEL`). The persona only supplies reply *text*; control flow stays
  deterministic.

## The gate-override red-team test (non-negotiable)
A hostile proposer returns mosaic / injection / missing-evidence actions while claiming they are
fine (`blocked_reason=None`). The composer re-validates → the block stands; the executor refuses to
run a blocked action even when its index is approved. **A gate is never overridden by model output.**
This mirrors WS-D's synthesis-layer guarantee — the same property provable at both layers.

## Run it
```bash
python -m actions.loop                 # demo the full work loop over fixtures.acme (stub personas)
pytest actions/tests/ -q               # 39 tests, no network / API key
make test && make lint                 # full suite green + ruff clean
```

## Demo / integration seam
```python
from actions.composer import SafeActionComposer, summarize_plan
from actions.loop import ControlledWorkLoop, run_acme_loop_demo

plan = SafeActionComposer().compose(brief, bundle)     # core.pipeline.ActionComposer
print(summarize_plan(plan).headline)
state = run_acme_loop_demo()                            # full loop on fixtures.acme
state = ControlledWorkLoop().run(brief, bundle)         # distribute→collect→escalate→schedule→close
```
Verified end-to-end against the live upstream stages (real `context.assembler` → `verification.engine`
→ `brief.synthesizer` → WS-E): every executed action is engine-verified non-blocked. The loop's five
nodes are pure `(state)->state` functions, so they map 1:1 onto a LangGraph `StateGraph`; the
hand-rolled `run` keeps the suite offline and fast. The composer/executor back the
`/actions/compose` + `/actions/execute` surfaces (action-diff drawer).

## Definition of Done — met
Phase 1 fully tested (every ToolCard + gate blocks the right thing; rollback + ordered audit work) ·
Phase 2 `compose()` + full loop run on the fixture with personas, every execution path engine-gated
and human-approved · gate-override red-team test passes · LLM mockable so CI is green offline ·
`make test` (239) + `make lint` clean · stays within `actions/`, no `core/` edits.

## Hand-off note (per CLAUDE.md — Codex owns the WS-E action engine)
Built single-stream (engine + loop together) on `main`, per the consolidated WS-E brief. The
deterministic engine ([`engine.py`](engine.py), [`toolcards.py`](toolcards.py)) is the Codex-owned
lane; the composer/loop/personas are the Claude lane. The internal split is preserved
(deterministic engine first, LLM on top) so it rebases cleanly onto a separate engine PR if needed.

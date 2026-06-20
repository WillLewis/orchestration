# brief/ — WS-D (Claude) · Decision Brief synthesis

**Status: ✅ implemented.** `core.pipeline.BriefSynthesizer` is implemented by
`GroundedBriefSynthesizer` in [`synthesizer.py`](synthesizer.py). LLM synthesis of a typed
`DecisionBrief` from a permission-safe `ContextBundle` (WS-B) + a `DeterministicDecision` (WS-C).

## The one rule that matters
**The LLM drafts/interprets language; it NEVER owns a pass/fail decision.** The verifier's
`DeterministicDecision` is copied into `policy_gates` *unchanged* and its matrix into
`required_approvals`. This stage never sets `approval_ready`, never edits a `RuleFiring`, and
never marks a brief approved. When the gate is not approval-ready the brief says so in prose and
**lowers confidence** — it cannot claim approval (`_gate_status_sentence` + `_guard_summary`).

## How it works
- **Deterministic / probabilistic split.** A `BriefDrafter` (probabilistic seam) only drafts
  language — the decision question, the executive-summary body, extra questions/steps — from a
  permission-safe `BriefEvidenceView` (already-filtered material + boolean gate summary; no denied
  content). Everything structured is assembled deterministically: gate pass-through, fact
  selection, confidence, approvals, limitations, gate-derived next steps.
- **Faithfulness.** Every `key_facts` / `what_changed` item traces to a *supported* claim (one
  that retains an accessible source). Unsupported claims are surfaced as `open_questions`, never
  asserted as facts.
- **Confidence** is deterministic: `low` for a blocking missing-evidence gap; `medium` when the
  gate is not ready or there are conflicts / unsupported / missing items; `high` only when the
  gate is ready and the evidence is clean.

## Drafters (LLM routing via env — never hardcoded)
- `HeuristicBriefDrafter` (**default**): offline, deterministic templates — no network, no API
  key, so the test suite never makes a call.
- `LLMBriefDrafter` (opt-in): routes drafting through `PLANNER_MODEL` (see `.env.example`).
  Requires `ANTHROPIC_API_KEY`; only drafts language and is told it may not decide pass/fail.

## Run it
```bash
python -m brief.synthesizer          # demo over fixtures.acme (prints the full brief)
pytest brief/tests/ -q               # 19 unit tests, no network / API key
make test && make lint               # full suite green + ruff clean
```

## Demo / integration seam
```python
from brief.synthesizer import GroundedBriefSynthesizer, synthesize, synthesize_acme_demo

brief = synthesize_acme_demo()                       # fixtures.acme.{acme_bundle, acme_expected_decision}
brief = synthesize(bundle, decision)                 # module-level convenience (default drafter)
brief = GroundedBriefSynthesizer().synthesize(bundle, decision)   # swap into core.demo / the pipeline
```
Verified end-to-end against the live upstream stages (real `context.assembler` → `verification.engine`
→ `brief.synthesizer`): the gate passes through untouched and the Acme case stays not-approval-ready.

## Definition of Done — met
Implements the `BriefSynthesizer` Protocol · `synthesize()` returns a valid `DecisionBrief` that
never overrides the gate · Acme case stays not-approval-ready · unit tests green (no network) ·
`make test` + `make lint` clean · demo callable on `fixtures.acme`.

# recipes/ — WS-I (Codex authoring + Claude wiring)
AgentRecipe + RulePack + EvalPack per vertical (finance/legal/health) and RecipeScorecard.
Produces the platform-generalization proof: same primitives, three configs.
DoD: three recipes load, each runs its eval pack, scorecard passes across all three.

## What ships

- `finance_credit_v1`, `legal_contract_v1`, `health_protocol_v1` AgentRecipes.
- `finance_credit`, `legal_contract`, `health_protocol` RulePacks. These are authored
  rule content only; WS-C remains the engine.
- `ep_finance`, `ep_legal`, `ep_health` EvalPacks. Case ids and row shape match
  `frontend/src/data/ops.ts` for the Agent Ops surface.
- `run_three_vertical()` delegates every case to WS-G's `EvalHarnessRunner.evaluate()`
  and returns an Agent Ops-shaped scorecard: `vertical_scores`, `eval_rows`,
  `core_scorecard`, and `overall_passed`.

## WS-G scope reconciliation

WS-G already provides a single-pack `EvalHarnessRunner.run(pack_id)` and a core
three-vertical `evals.build_scorecard()`. WS-I does not reimplement the harness or
scorers. It authors the recipe/rulepack/evalpack config and uses WS-G's real
`EvalHarnessRunner.evaluate()` for each authored case because the Agent Ops case ids
(`fin_perm_01`, `leg_cite_01`, etc.) are recipe-owned and intentionally mirror the
frontend demo rows.

## Run

```bash
python -m pytest recipes/tests/test_three_vertical.py -q
python - <<'PY'
from recipes import run_three_vertical
print(run_three_vertical().model_dump(mode="json"))
PY
```

Expected demo behavior: finance is `5/6`, legal is `2/2`, and health is `2/2`.
All three verticals pass the scorecard threshold, while `fin_ambig_01` remains visible as
the single honest UX-ambiguity failure.

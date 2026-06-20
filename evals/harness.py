"""
evals/harness.py — the instrumentation seam (WS-G).

`PipelineHarness` is the boundary between the eval loop and the pipeline under test.
The default `StubHarness` runs cases through the WS-0 stub stages in `core.demo` over
`fixtures.acme` (finance), or — for cases that carry an embedded `expected["scenario"]`
(thin legal/health) — over a `ScenarioAssembler`/`ScenarioVerifier` that replay the
serialized `ContextBundle`/`DeterministicDecision`.

The seam is deliberately the `core.pipeline` Protocols themselves: when WS-B/WS-C/WS-D/WS-E
land, you inject the real `ContextAssembler`/`Verifier`/`BriefSynthesizer`/etc. and the
scorers, replay, telemetry, and scorecard are unchanged. Nothing here is probabilistic and
nothing here owns a pass/fail policy decision — it only MEASURES.

Offline: no network, no API keys. `cost_usd` is 0.0 for the stub (no tokens spent);
`latency_ms` is wall-clock but NO scorer reads it (so replay stays reproducible).
"""
from __future__ import annotations

from collections import Counter
from time import perf_counter
from typing import Protocol, runtime_checkable

from core.demo import (
    StubActionComposer,
    StubBriefSynthesizer,
    StubContextAssembler,
    StubExecutor,
    StubVerifier,
)
from core.pipeline import (
    ActionComposer,
    BriefSynthesizer,
    ContextAssembler,
    Executor,
    Verifier,
)
from core.schemas import (
    ContextBundle,
    DeterministicDecision,
    EvalCase,
    EvalTrace,
)

from .models import CaseRun

DEFAULT_MODEL = "stub"

# Deterministic object-id prefix → WorkspaceObject-style source type. Used only to bucket
# `source_types` for telemetry counts; ids never carry content.
_SOURCE_TYPE_PREFIXES: dict[str, str] = {
    "mtg_": "meeting",
    "doc_": "document",
    "chat_": "chat_thread",
    "wf_": "workflow",
    "task_": "task",
    "user_": "user_profile",
}


def source_type_of(object_id: str) -> str:
    """Map an object id to a source type by id prefix (deterministic, content-free)."""
    for prefix, source_type in _SOURCE_TYPE_PREFIXES.items():
        if object_id.startswith(prefix):
            return source_type
    return "document"


def citation_coverage(bundle: ContextBundle) -> float:
    """Fraction of claims with at least one supporting source (1.0 if there are no claims)."""
    claims = bundle.claims.claims
    if not claims:
        return 1.0
    cited = sum(1 for c in claims if c.sources)
    return cited / len(claims)


def claim_support(bundle: ContextBundle) -> float:
    """Fraction of claims marked supported (1.0 if there are no claims)."""
    claims = bundle.claims.claims
    if not claims:
        return 1.0
    return sum(1 for c in claims if c.supported) / len(claims)


class ScenarioAssembler:
    """A `ContextAssembler` that replays an embedded `ContextBundle` (thin verticals)."""

    def __init__(self, bundle: ContextBundle) -> None:
        self._bundle = bundle

    def assemble(self, user_id: str, intent: str) -> ContextBundle:
        return self._bundle.model_copy(update={"user_id": user_id, "intent": intent})


class ScenarioVerifier:
    """A `Verifier` that replays an embedded `DeterministicDecision` (thin verticals)."""

    def __init__(self, decision: DeterministicDecision) -> None:
        self._decision = decision

    def verify(self, bundle: ContextBundle, rulepack_id: str) -> DeterministicDecision:
        return self._decision


@runtime_checkable
class PipelineHarness(Protocol):
    """Runs one `EvalCase` through the pipeline and returns a typed `CaseRun`."""

    def run(self, case: EvalCase) -> CaseRun: ...


class StubHarness:
    """Default harness: WS-0 stubs for downstream stages; per-case upstream source.

    Finance cases (no embedded scenario) use the injected `assembler`/`verifier`
    (the Acme stubs). Cases with `expected["scenario"]` swap in a
    `ScenarioAssembler`/`ScenarioVerifier` for that case only. Downstream
    `synthesizer`/`composer`/`executor` are always the injected stages.
    """

    def __init__(
        self,
        assembler: ContextAssembler | None = None,
        verifier: Verifier | None = None,
        synthesizer: BriefSynthesizer | None = None,
        composer: ActionComposer | None = None,
        executor: Executor | None = None,
        model: str = DEFAULT_MODEL,
    ) -> None:
        self.assembler = assembler or StubContextAssembler()
        self.verifier = verifier or StubVerifier()
        self.synthesizer = synthesizer or StubBriefSynthesizer()
        self.composer = composer or StubActionComposer()
        self.executor = executor or StubExecutor()
        self.model = model

    def _upstream(self, case: EvalCase) -> tuple[ContextAssembler, Verifier]:
        scenario = case.expected.get("scenario")
        if scenario:
            bundle = ContextBundle.model_validate(scenario["bundle"])
            decision = DeterministicDecision.model_validate(scenario["decision"])
            return ScenarioAssembler(bundle), ScenarioVerifier(decision)
        return self.assembler, self.verifier

    def run(self, case: EvalCase) -> CaseRun:
        assembler, verifier = self._upstream(case)
        user_id = str(case.expected.get("user_id", "u_rm"))
        rulepack_id = str(case.expected.get("rulepack_id", f"{case.vertical}_v1"))

        start = perf_counter()
        bundle = assembler.assemble(user_id, case.prompt)
        decision = verifier.verify(bundle, rulepack_id)
        brief = self.synthesizer.synthesize(bundle, decision)
        plan = self.composer.compose(brief, bundle)
        audit = self.executor.execute(plan, list(range(len(plan.actions))))
        latency_ms = int((perf_counter() - start) * 1000)

        trace = EvalTrace(
            case_id=case.id,
            model=self.model,
            source_types=[source_type_of(s.object_id) for s in bundle.sources],
            tool_calls=[a.tool for a in plan.actions],
            rule_firings=list(decision.firings),
            citation_coverage=citation_coverage(bundle),
            claim_support=claim_support(bundle),
            latency_ms=latency_ms,
            cost_usd=0.0,
        )
        return CaseRun(
            case=case,
            bundle=bundle,
            decision=decision,
            brief=brief,
            plan=plan,
            audit=audit,
            trace=trace,
        )


def source_type_counts(trace: EvalTrace) -> dict[str, int]:
    """Counter of `source_types` for telemetry (counts only — no ids, no content)."""
    return dict(Counter(trace.source_types))

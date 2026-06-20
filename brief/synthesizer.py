"""
brief/synthesizer.py — WS-D (Decision Brief).

Implements `core.pipeline.BriefSynthesizer`: turns a permission-safe ``ContextBundle``
(WS-B) plus a ``DeterministicDecision`` (WS-C) into a typed ``DecisionBrief`` work product.

Design invariants (see CLAUDE.md / CONTRIBUTING.md rules 4–6):

1. **The deterministic gate is authoritative — the LLM NEVER overrides it.** The verifier's
   ``DeterministicDecision`` is copied into ``policy_gates`` *unchanged*, and its approval
   matrix into ``required_approvals``. This stage never sets ``approval_ready``, never edits a
   ``RuleFiring``, and never marks a brief approved. If the gate is not approval-ready the brief
   reflects that in its prose and *lowers confidence* — it cannot claim approval (enforced by
   ``_gate_status_sentence`` + ``_guard_summary``).
2. **Faithfulness.** Every ``key_fact`` / ``what_changed`` item traces to a *supported* claim in
   the bundle (a claim that retains an accessible source). Unsupported claims are surfaced as
   ``open_questions`` — never asserted as facts.
3. **Deterministic / probabilistic split.** A ``BriefDrafter`` (the probabilistic seam) only
   drafts language — the decision question, an executive-summary body, extra questions/steps. It
   sees a permission-safe projection (``BriefEvidenceView``) of already-filtered material and
   makes no pass/fail call. Everything structured — gate pass-through, fact selection, confidence,
   approvals, limitations, gate-derived next steps — is assembled deterministically here.

The default drafter (``HeuristicBriefDrafter``) is offline and deterministic, so the test suite
never needs a network call or API key. ``LLMBriefDrafter`` is an opt-in seam routed via
``PLANNER_MODEL`` (never a hardcoded model name), mirroring WS-B's ``LLMClaimExtractor``.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal, Protocol, runtime_checkable

from core.schemas import (
    Claim,
    ContextBundle,
    DecisionBrief,
    DeterministicDecision,
)
from fixtures.acme import acme_bundle, acme_expected_decision

Confidence = Literal["low", "medium", "high"]

# Tokens that mark a supported claim as a *change* (→ ``what_changed``) rather than a static
# ``key_fact``. Matched case-insensitively as substrings against the claim text.
_CHANGE_HINTS: tuple[str, ...] = (
    "revis", "chang", "updat", "moved", "from $", "from £", "→", "->",
    "pending", "increas", "decreas", "dropp", "raised", "no longer", " now ",
)

# Grounded themes for phrasing the decision question. A theme is only used when one of its tokens
# appears in *grounded* bundle text (supported claims, conflict + missing-evidence descriptions),
# so the question never invents a subject the evidence does not mention.
_DECISION_THEMES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("pricing exception", ("pricing", "discount", "price exception")),
    ("covenant modification", ("covenant",)),
    ("risk-rating change", ("risk rating", "risk-rating")),
    ("legal sign-off", ("legal approval", "legal memo", "legal sign")),
)


# --------------------------------------------------------------------------- #
# Probabilistic seam: a drafter proposes language only (never decides pass/fail)
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class BriefEvidenceView:
    """Permission-safe projection handed to a ``BriefDrafter``.

    Contains only material that already survived WS-B's permission + mosaic filters: grounded
    claim text, what-changed lines, conflict/missing-evidence descriptions, and the *boolean*
    gate summary. No denied content, no raw documents, and no authority to alter the gate.
    """

    intent: str
    decision_themes: tuple[str, ...]
    supported_facts: tuple[str, ...]
    what_changed: tuple[str, ...]
    conflicts: tuple[str, ...]
    missing_evidence: tuple[str, ...]
    unsupported_claims: tuple[str, ...]
    source_count: int
    approval_ready: bool
    failed_gate_ids: tuple[str, ...]
    missing_approver_roles: tuple[str, ...]


@dataclass(frozen=True)
class BriefNarrative:
    """A drafter's prose output. Structured fields and the gate are owned by the synthesizer;
    ``summary_body`` must NOT include the gate-status sentence (the synthesizer appends it)."""

    decision_needed: str
    summary_body: str
    extra_open_questions: tuple[str, ...] = ()
    extra_next_steps: tuple[str, ...] = ()


@runtime_checkable
class BriefDrafter(Protocol):
    """Drafts brief language from a permission-safe view. Never returns a pass/fail decision."""

    def draft(self, view: BriefEvidenceView) -> BriefNarrative: ...


class HeuristicBriefDrafter:
    """Deterministic, offline drafter (default). Composes the decision question and an
    executive-summary body from the safe view using simple, grounded templates — no network,
    no API key — so the test suite never needs one."""

    def draft(self, view: BriefEvidenceView) -> BriefNarrative:
        return BriefNarrative(
            decision_needed=self._decision_needed(view),
            summary_body=self._summary_body(view),
        )

    def _decision_needed(self, view: BriefEvidenceView) -> str:
        if view.decision_themes:
            return "Approve the " + _join_clause(view.decision_themes) + "?"
        return "Approve the decision under review?"

    def _summary_body(self, view: BriefEvidenceView) -> str:
        bits: list[str] = []
        bits.append(
            f"{len(view.supported_facts)} grounded fact(s) assembled from "
            f"{view.source_count} accessible source(s)."
        )
        if view.what_changed:
            bits.append(f"{len(view.what_changed)} item(s) changed since the last review.")
        if view.missing_evidence:
            bits.append(f"{len(view.missing_evidence)} piece(s) of evidence still missing.")
        if view.conflicts:
            bits.append(f"{len(view.conflicts)} conflicting-evidence flag(s) to reconcile.")
        if view.missing_approver_roles:
            bits.append(
                "Outstanding approvals: " + _join_clause(view.missing_approver_roles) + "."
            )
        return " ".join(bits)


class LLMBriefDrafter:
    """Opt-in seam that routes brief drafting through ``PLANNER_MODEL``.

    The model only drafts language (decision question, summary body, extra questions/steps) from
    the permission-safe ``BriefEvidenceView``. It is explicitly instructed that it may not decide
    approval/compliance: the synthesizer still copies the gate through untouched and computes
    confidence deterministically, so the LLM can never override a pass/fail decision. Denied
    content was filtered upstream (WS-B) and never reaches this prompt.

    Not used by the default synthesizer or the test suite (which inject the heuristic drafter).
    Requires ``ANTHROPIC_API_KEY``; raises clearly if the route is unset.
    """

    def __init__(self, model_env: str = "PLANNER_MODEL") -> None:
        from dotenv import load_dotenv

        load_dotenv()
        model = os.environ.get(model_env)
        if not model:
            raise RuntimeError(f"{model_env} is not set; cannot route brief synthesis.")
        self.model = model

    def draft(self, view: BriefEvidenceView) -> BriefNarrative:
        import json
        from dataclasses import asdict

        from anthropic import Anthropic

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("ANTHROPIC_API_KEY is not set; cannot call the planner model.")
        instruction = (
            "You draft language for a governed decision brief. From the permission-safe view "
            "below, return JSON {\"decision_needed\", \"summary_body\", \"extra_open_questions\", "
            "\"extra_next_steps\"}. Rules: (1) Use ONLY the facts provided; do not invent any. "
            "(2) You do NOT decide approval, compliance, or pass/fail — never state the brief is "
            "approved or approval-ready. (3) summary_body must omit any approval verdict; the "
            "system appends the authoritative gate status.\n"
        )
        client = Anthropic()
        resp = client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[{"role": "user", "content": instruction + json.dumps(asdict(view))}],
        )
        data = json.loads(resp.content[0].text)
        return BriefNarrative(
            decision_needed=str(data.get("decision_needed") or ""),
            summary_body=str(data.get("summary_body") or ""),
            extra_open_questions=tuple(data.get("extra_open_questions", []) or ()),
            extra_next_steps=tuple(data.get("extra_next_steps", []) or ()),
        )


# --------------------------------------------------------------------------- #
# The synthesizer
# --------------------------------------------------------------------------- #
class GroundedBriefSynthesizer:
    """WS-D implementation of ``core.pipeline.BriefSynthesizer``.

    The drafter supplies prose; this class owns the structure and the non-negotiable guarantee
    that the deterministic gate is passed through untouched and never overridden.
    """

    def __init__(self, drafter: BriefDrafter | None = None) -> None:
        self.drafter = drafter or HeuristicBriefDrafter()

    # -- public API ---------------------------------------------------------- #
    def synthesize(
        self, bundle: ContextBundle, decision: DeterministicDecision
    ) -> DecisionBrief:
        # 1. FAITHFULNESS: partition claims by whether they retain an accessible source.
        supported = [c for c in bundle.claims.claims if c.supported and c.sources]
        unsupported = [c for c in bundle.claims.claims if not (c.supported and c.sources)]
        what_changed = [c.text for c in supported if _is_change(c.text)]
        key_facts = [c.text for c in supported if not _is_change(c.text)]

        missing_approver_roles = [
            r.role for r in decision.approvals.requirements if not r.present
        ]

        # 2. Probabilistic step: draft language from a permission-safe view.
        view = self._build_view(
            bundle, decision, supported, unsupported, what_changed, missing_approver_roles
        )
        narrative = self.drafter.draft(view)

        # 3. Assemble deterministically; the gate flows through UNCHANGED.
        executive_summary = self._compose_summary(narrative, decision)
        return DecisionBrief(
            decision_needed=narrative.decision_needed or "Approve the decision under review?",
            executive_summary=executive_summary,
            what_changed=what_changed,
            key_facts=key_facts,
            policy_gates=decision,                 # copied through, never altered
            required_approvals=decision.approvals,  # the verifier's matrix, verbatim
            missing_evidence=list(bundle.missing_evidence),
            conflicts=list(bundle.conflicts),
            open_questions=self._open_questions(bundle, unsupported, narrative),
            next_steps=self._next_steps(bundle, missing_approver_roles, narrative),
            source_map=list(bundle.sources),
            permission_limitations=self._permission_limitations(bundle),
            confidence=self._confidence(bundle, decision, unsupported),
        )

    # -- view construction --------------------------------------------------- #
    def _build_view(
        self,
        bundle: ContextBundle,
        decision: DeterministicDecision,
        supported: list[Claim],
        unsupported: list[Claim],
        what_changed: list[str],
        missing_approver_roles: list[str],
    ) -> BriefEvidenceView:
        grounded = (
            [c.text for c in supported]
            + [c.description for c in bundle.conflicts]
            + [m.description for m in bundle.missing_evidence]
        )
        return BriefEvidenceView(
            intent=bundle.intent,
            decision_themes=_detect_themes(grounded),
            supported_facts=tuple(c.text for c in supported),
            what_changed=tuple(what_changed),
            conflicts=tuple(c.description for c in bundle.conflicts),
            missing_evidence=tuple(m.description for m in bundle.missing_evidence),
            unsupported_claims=tuple(c.text for c in unsupported),
            source_count=len(bundle.sources),
            approval_ready=decision.approval_ready,
            failed_gate_ids=tuple(f.rule_id for f in decision.firings if not f.passed),
            missing_approver_roles=tuple(_humanize_role(r) for r in missing_approver_roles),
        )

    # -- executive summary (gate-guarded prose) ------------------------------ #
    def _compose_summary(
        self, narrative: BriefNarrative, decision: DeterministicDecision
    ) -> str:
        body = _guard_summary(narrative.summary_body, decision)
        gate = _gate_status_sentence(decision)
        parts = [p for p in (narrative.decision_needed, body, gate) if p]
        return " ".join(parts).strip()

    # -- open questions ------------------------------------------------------ #
    def _open_questions(
        self, bundle: ContextBundle, unsupported: list[Claim], narrative: BriefNarrative
    ) -> list[str]:
        qs: list[str] = []
        # Unsupported claims become questions, never facts (faithfulness).
        for c in unsupported:
            qs.append(
                f"Unverified — {c.text} No accessible source supports this; confirm before "
                "relying on it."
            )
        # A blocking gap is an explicit question to close before the committee.
        for m in bundle.missing_evidence:
            if m.blocking:
                qs.append(f"Can the blocking gap be closed: {m.description}")
        qs.extend(narrative.extra_open_questions)
        return _dedupe(qs)

    # -- next steps (gate-derived) ------------------------------------------- #
    def _next_steps(
        self, bundle: ContextBundle, missing_approver_roles: list[str], narrative: BriefNarrative
    ) -> list[str]:
        steps: list[str] = []
        for role in missing_approver_roles:
            steps.append(f"Route the approval packet to the {_humanize_role(role)} for sign-off.")
        for m in bundle.missing_evidence:
            steps.append(f"Obtain missing evidence: {m.description}")
        for c in bundle.conflicts:
            steps.append(f"Reconcile conflicting evidence: {c.description}")
        steps.extend(narrative.extra_next_steps)
        return _dedupe(steps)

    # -- permission limitations ---------------------------------------------- #
    def _permission_limitations(self, bundle: ContextBundle) -> list[str]:
        reason = bundle.permission_boundary.reason.replace("_", "-")
        return [
            f"Omitted {oid} — {reason}."
            for oid in bundle.permission_boundary.excluded_object_ids
        ]

    # -- confidence (deterministic; derived from the gate, never the LLM) ----- #
    def _confidence(
        self, bundle: ContextBundle, decision: DeterministicDecision, unsupported: list[Claim]
    ) -> Confidence:
        if any(m.blocking for m in bundle.missing_evidence):
            return "low"
        if (
            not decision.approval_ready
            or bundle.conflicts
            or unsupported
            or bundle.missing_evidence
        ):
            return "medium"
        return "high"


# --------------------------------------------------------------------------- #
# Module-level conveniences (mirror verification.engine.verify)
# --------------------------------------------------------------------------- #
def synthesize(bundle: ContextBundle, decision: DeterministicDecision) -> DecisionBrief:
    """Synthesize a ``DecisionBrief`` with the default (offline) drafter."""
    return GroundedBriefSynthesizer().synthesize(bundle, decision)


def synthesize_acme_demo() -> DecisionBrief:
    """Demo the integrator can call: synthesize the Acme brief from the shared fixtures."""
    return synthesize(acme_bundle(), acme_expected_decision())


# --------------------------------------------------------------------------- #
# Pure helpers
# --------------------------------------------------------------------------- #
def _is_change(text: str) -> bool:
    low = text.lower()
    return any(hint in low for hint in _CHANGE_HINTS)


def _detect_themes(grounded_text: list[str]) -> tuple[str, ...]:
    hay = " ".join(grounded_text).lower()
    return tuple(
        label for label, tokens in _DECISION_THEMES if any(tok in hay for tok in tokens)
    )


def _gate_status_sentence(decision: DeterministicDecision) -> str:
    """The authoritative gate clause appended to every executive summary. When the gate is not
    approval-ready, this states it plainly — the brief can never claim approval."""
    if decision.approval_ready:
        return (
            "All deterministic gates pass; the brief is approval-ready pending human sign-off."
        )
    failed = [f.rule_id for f in decision.firings if not f.passed]
    detail = f" ({len(failed)} gate(s) failing: {_join_clause(failed)})" if failed else ""
    return (
        f"Deterministic verification is NOT approval-ready{detail}; this brief defers the "
        "decision to the gate and is not marked approved."
    )


def _guard_summary(body: str, decision: DeterministicDecision) -> str:
    """Belt-and-suspenders: if a drafter's summary asserts approval while the gate has not
    cleared, drop the body. The gate-status sentence carries the authoritative state instead."""
    if decision.approval_ready:
        return body.strip()
    low = body.lower()
    banned = ("approval-ready", "ready for approval", "is approved", "are approved", "approved.")
    if any(b in low for b in banned):
        return ""
    return body.strip()


def _humanize_role(role: str) -> str:
    return role.replace("_", " ").replace("-", " ").title()


def _join_clause(items: tuple[str, ...] | list[str]) -> str:
    items = list(items)
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return ", ".join(items[:-1]) + f", and {items[-1]}"


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


# --------------------------------------------------------------------------- #
# CLI demo
# --------------------------------------------------------------------------- #
def main() -> None:
    brief = synthesize_acme_demo()
    print("WS-D BriefSynthesizer — demo over fixtures.acme")
    print(f"decision_needed     = {brief.decision_needed}")
    print(f"confidence          = {brief.confidence}")
    print(
        f"policy_gates.approval_ready = {brief.policy_gates.approval_ready} "
        "(passed through; never overridden)"
    )
    print("what_changed:")
    for w in brief.what_changed:
        print(f"  - {w}")
    print("key_facts:")
    for k in brief.key_facts:
        print(f"  - {k}")
    print(f"executive_summary   = {brief.executive_summary}")
    print("required_approvals:")
    for r in brief.required_approvals.requirements:
        print(f"  - {_humanize_role(r.role)}: {'present' if r.present else 'MISSING'}")
    print("open_questions:")
    for q in brief.open_questions:
        print(f"  - {q}")
    print("next_steps:")
    for s in brief.next_steps:
        print(f"  - {s}")
    print(f"permission_limitations = {brief.permission_limitations}")


if __name__ == "__main__":
    main()

"""
context/assembler.py — WS-B (Context / Retrieval).

Implements `core.pipeline.ContextAssembler`: turns ``(user_id, intent)`` into a
grounded, permission-safe ``ContextBundle``.

Design invariants (see CLAUDE.md / CONTRIBUTING.md):

1. **Permission filter runs FIRST.** Objects the user cannot read are dropped before any
   metadata or content is inspected, so denied content can never enter the bundle, a
   claim, the source graph, or an LLM prompt. Denials are recorded in ``PermissionBoundary``
   (edge case 1).
2. **Deterministic / probabilistic boundary.** An LLM may *propose* candidate claims and
   their cited sources (``ClaimExtractor`` seam, routed via ``PLANNER_MODEL``). It NEVER owns
   a pass/fail decision: WS-B deterministically scrubs any citation outside the accessible
   set and sets ``supported = (the claim still has an accessible source)``. Approvals,
   calculations and policy gates remain WS-C's job — nothing here makes those calls.
3. **Mosaic / information barrier (edge case 4).** A barrier-tagged object that is readable
   on its own but would cross an information barrier when synthesized into the shared packet
   is held OUT of ``sources`` and flagged as a ``ConflictState`` — never silently included.

The assembler is generic: it takes a ``workspace_loader`` (defaulting to
``fixtures.acme.acme_workspace``) so it runs today against the fixture and later against
WS-A's ``corpus.load(vertical)`` without code changes.
"""
from __future__ import annotations

import os
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from core.schemas import (
    Claim,
    ClaimMap,
    ConflictState,
    ContextBundle,
    MissingEvidenceState,
    ObjectType,
    PermissionBoundary,
    Sensitivity,
    SourceEdge,
    SourceGraph,
    SourceRef,
    WorkspaceObject,
)
from fixtures.acme import USERS, acme_workspace

# --------------------------------------------------------------------------- #
# Configuration (internal — NOT part of the frozen contract)
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class PermissionPolicy:
    """How sensitivity / barrier tags gate access on top of the ACL readers list."""

    # Roles cleared to read `restricted` objects even when listed as readers. Being a
    # listed reader is necessary but not sufficient for restricted content.
    restricted_clearance_roles: frozenset[str] = frozenset({"legal", "compliance"})
    # The information-barrier side(s) the shared work product operates on. A readable
    # barrier object whose tags do not intersect these sides crosses the barrier when
    # synthesized into the packet (edge case 4).
    packet_barrier_sides: frozenset[str] = frozenset({"private-side"})


@dataclass(frozen=True)
class EvidenceRequirement:
    """A piece of evidence a recipe expects to be present for the given intent."""

    code: str
    description: str
    blocking: bool
    matches: tuple[str, ...]  # tokens checked against id / title / metadata keys
    claim_text: str | None = None       # if set, an unsupported "gap" claim when missing
    expected_source_id: str | None = None  # the artifact that would have grounded it


@dataclass(frozen=True)
class DeclaredConflict:
    """A scenario conflict the recipe asserts (e.g. pricing doc vs. CS plan discount)."""

    description: str
    anchor_object_ids: tuple[str, ...]  # emitted only when all anchors are accessible


@dataclass(frozen=True)
class DeclaredRelation:
    """A typed edge for the SourceGraph; emitted only when both ends are accessible."""

    from_id: str
    to_id: str
    relation: str = "derived_from"


@dataclass(frozen=True)
class Recipe:
    """Per-vertical config: expected evidence, known conflicts, source relations.

    The generic detectors (metadata conflict probe, evidence checklist, graph builder)
    operate on this config, so a new vertical is data, not code.
    """

    id: str
    required_evidence: tuple[EvidenceRequirement, ...] = ()
    declared_conflicts: tuple[DeclaredConflict, ...] = ()
    relations: tuple[DeclaredRelation, ...] = ()
    conflict_probe_keys: tuple[str, ...] = ()  # metadata keys compared across objects


FINANCE_CREDIT_RECIPE = Recipe(
    id="finance_credit_v1",
    required_evidence=(
        EvidenceRequirement(
            code="missing_covenant_tracker",
            description="Final covenant tracker not uploaded.",
            blocking=True,
            matches=("covenant tracker", "covenant_tracker"),
            claim_text="Covenants remain within their required thresholds.",
            expected_source_id="covenant_tracker",
        ),
        EvidenceRequirement(
            code="missing_risk_rating_approval",
            description="No updated risk-rating approval on file.",
            blocking=False,
            matches=("risk_rating", "risk rating", "risk-rating"),
        ),
    ),
    declared_conflicts=(
        DeclaredConflict(
            description="Pricing doc and CS plan show different discount levels.",
            anchor_object_ids=("doc_credit_memo",),
        ),
    ),
    relations=(
        DeclaredRelation("doc_credit_memo", "doc_financials", "derived_from"),
        DeclaredRelation("mtg_committee_0612", "doc_credit_memo", "cites"),
        DeclaredRelation("wf_approval", "mtg_committee_0612", "derived_from"),
    ),
    conflict_probe_keys=("discount_pct", "discount", "pricing_tier"),
)


# --------------------------------------------------------------------------- #
# Claim extraction seam (probabilistic — interprets evidence, never decides)
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class CandidateClaim:
    """A *proposed* claim. Whether it is `supported` is decided downstream, by the
    assembler, from whether its citations survive the accessible-source scrub."""

    text: str
    cited_object_ids: tuple[str, ...] = ()
    id: str | None = None
    span: str | None = None


@runtime_checkable
class ClaimExtractor(Protocol):
    """Proposes candidate claims from the *already permission-filtered* objects."""

    def extract(self, objects: list[WorkspaceObject]) -> list[CandidateClaim]: ...


class HeuristicClaimExtractor:
    """Deterministic, offline claim extractor (default). Reads structured metadata of
    accessible objects only — no network, no API key — so the test suite never needs one."""

    def extract(self, objects: list[WorkspaceObject]) -> list[CandidateClaim]:
        out: list[CandidateClaim] = []
        for o in objects:
            md = o.metadata
            if "revenue_forecast" in md and "prior_revenue_forecast" in md:
                cur = md["revenue_forecast"] / 1_000_000
                prior = md["prior_revenue_forecast"] / 1_000_000
                out.append(
                    CandidateClaim(
                        id="clm_revenue",
                        text=f"Revenue forecast revised from ${prior:.0f}M to ${cur:.0f}M.",
                        cited_object_ids=(o.id,),
                    )
                )
            if "dscr" in md:
                out.append(
                    CandidateClaim(
                        id="clm_dscr",
                        text=f"Debt-service-coverage ratio (DSCR) is {md['dscr']}.",
                        cited_object_ids=(o.id,),
                    )
                )
            if o.type == ObjectType.workflow and ("rm_approval" in md or "legal_status" in md):
                parts: list[str] = []
                if md.get("rm_approval"):
                    parts.append("RM approval recorded")
                if md.get("credit_officer_approval") is False:
                    parts.append("Credit Officer approval pending")
                if md.get("legal_status"):
                    parts.append(f"Legal status {md['legal_status']}")
                if parts:
                    out.append(
                        CandidateClaim(
                            id="clm_approvals",
                            text="; ".join(parts) + ".",
                            cited_object_ids=(o.id,),
                        )
                    )
        return out


class LLMClaimExtractor:
    """Opt-in seam that routes claim extraction through ``PLANNER_MODEL``.

    The model only PROPOSES claim text + cited object ids; the assembler still scrubs
    citations to the accessible set and decides `supported`, so the LLM never makes a
    pass/fail decision. Only the id/type/title/metadata of *accessible* objects is sent —
    denied content has already been filtered out and never reaches the prompt.

    Not used by the default assembler or the test suite (which inject a deterministic
    extractor). Requires ``ANTHROPIC_API_KEY``; raises clearly if the route is unset.
    """

    def __init__(self, model_env: str = "PLANNER_MODEL") -> None:
        from dotenv import load_dotenv

        load_dotenv()
        model = os.environ.get(model_env)
        if not model:
            raise RuntimeError(f"{model_env} is not set; cannot route claim extraction.")
        self.model = model

    def extract(self, objects: list[WorkspaceObject]) -> list[CandidateClaim]:
        import json

        from anthropic import Anthropic

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise RuntimeError("ANTHROPIC_API_KEY is not set; cannot call the planner model.")
        digest = [
            {"id": o.id, "type": o.type.value, "title": o.title, "metadata": o.metadata}
            for o in objects
        ]
        instruction = (
            "Extract candidate factual claims from these workspace objects. Return JSON "
            '{"claims":[{"id","text","cited_object_ids"}]}. Only cite ids present below. '
            "Do not decide whether a claim is approved or compliant.\n"
        )
        client = Anthropic()
        resp = client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[{"role": "user", "content": instruction + json.dumps(digest)}],
        )
        data = json.loads(resp.content[0].text)
        return [
            CandidateClaim(
                id=c.get("id"),
                text=c["text"],
                cited_object_ids=tuple(c.get("cited_object_ids", [])),
            )
            for c in data.get("claims", [])
        ]


# --------------------------------------------------------------------------- #
# The assembler
# --------------------------------------------------------------------------- #


class PermissionAwareContextAssembler:
    """WS-B implementation of ``core.pipeline.ContextAssembler``."""

    def __init__(
        self,
        workspace_loader: Callable[[], list[WorkspaceObject]] = acme_workspace,
        *,
        users: dict[str, dict] | None = None,
        policy: PermissionPolicy | None = None,
        recipe: Recipe | None = None,
        claim_extractor: ClaimExtractor | None = None,
    ) -> None:
        self._load = workspace_loader
        self._users = users if users is not None else USERS
        self.policy = policy or PermissionPolicy()
        self.recipe = recipe or FINANCE_CREDIT_RECIPE
        self.claim_extractor = claim_extractor or HeuristicClaimExtractor()
        self._req_by_code = {r.code: r for r in self.recipe.required_evidence}

    # -- public API ---------------------------------------------------------- #
    def assemble(self, user_id: str, intent: str) -> ContextBundle:
        workspace = self._load()
        role = (self._users.get(user_id) or {}).get("role")

        # 1. PERMISSION FILTER FIRST — denied objects are dropped before anything is read.
        accessible, excluded_ids = self._apply_permission_filter(workspace, user_id, role)

        # 2. Mosaic / information-barrier gate (edge case 4) — held-out, not silently kept.
        mosaic, held_out_ids = self._mosaic_conflicts(accessible)
        source_objs = [o for o in accessible if o.id not in held_out_ids]
        accessible_ids = {o.id for o in source_objs}

        # 3. Sources + dependency graph over the safe set.
        sources = [SourceRef(object_id=o.id) for o in source_objs]
        source_graph = self._build_source_graph(source_objs)

        # 4. Missing evidence (e.g. covenant tracker not uploaded).
        missing = self._detect_missing_evidence(source_objs)

        # 5. Claims: extractor proposes; WS-B scrubs to accessible sources + sets support.
        candidates = list(self.claim_extractor.extract(source_objs))
        candidates += self._gap_claim_candidates(missing)
        claims = self._build_claims(candidates, accessible_ids)

        # 6. Conflicts: generic metadata probe + recipe-declared + mosaic flags.
        conflicts = (
            self._detect_metadata_conflicts(source_objs)
            + self._declared_conflicts(accessible_ids)
            + mosaic
        )

        return ContextBundle(
            user_id=user_id,
            intent=intent,
            sources=sources,
            source_graph=source_graph,
            claims=claims,
            permission_boundary=PermissionBoundary(
                excluded_object_ids=excluded_ids, reason="permission_restricted"
            ),
            missing_evidence=missing,
            conflicts=conflicts,
        )

    # -- permission filter --------------------------------------------------- #
    def _apply_permission_filter(
        self, workspace: list[WorkspaceObject], user_id: str, role: str | None
    ) -> tuple[list[WorkspaceObject], list[str]]:
        accessible: list[WorkspaceObject] = []
        excluded: list[str] = []
        for o in workspace:
            if self._can_read(o, user_id, role):
                accessible.append(o)
            else:
                excluded.append(o.id)
        return accessible, excluded

    def _can_read(self, o: WorkspaceObject, user_id: str, role: str | None) -> bool:
        acl = o.acl
        is_reader = user_id in acl.readers or (role is not None and role in acl.readers)
        if not is_reader:
            return False
        if acl.sensitivity == Sensitivity.restricted:
            # Listed readers still need explicit clearance for restricted content.
            return role is not None and role in self.policy.restricted_clearance_roles
        # `barrier` content is readable here; its synthesis risk is handled by the mosaic gate.
        return True

    # -- mosaic / information barrier ---------------------------------------- #
    def _mosaic_conflicts(
        self, accessible: list[WorkspaceObject]
    ) -> tuple[list[ConflictState], set[str]]:
        # "Other-side" material the barrier object would be synthesized against.
        other = [
            o
            for o in accessible
            if o.acl.sensitivity not in (Sensitivity.barrier, Sensitivity.public)
        ]
        conflicts: list[ConflictState] = []
        held: set[str] = set()
        for o in accessible:
            if o.acl.sensitivity != Sensitivity.barrier:
                continue
            tags = set(o.acl.barrier_tags)
            crosses = not (tags & self.policy.packet_barrier_sides)
            if crosses and other:
                held.add(o.id)
                side = "/".join(o.acl.barrier_tags) or "barrier"
                conflicts.append(
                    ConflictState(
                        description=(
                            f"[information-barrier] Synthesizing {o.id} ({side}) into the "
                            "shared packet would cross an information barrier with private-side "
                            "deal material; held out. Route to Compliance or generate a "
                            "public-side-safe version."
                        ),
                        sources=[SourceRef(object_id=o.id), SourceRef(object_id=other[0].id)],
                    )
                )
        return conflicts, held

    # -- source graph -------------------------------------------------------- #
    def _build_source_graph(self, source_objs: list[WorkspaceObject]) -> SourceGraph:
        ids = {o.id for o in source_objs}
        edges = [
            SourceEdge(from_id=r.from_id, to_id=r.to_id, relation=r.relation)
            for r in self.recipe.relations
            if r.from_id in ids and r.to_id in ids
        ]
        return SourceGraph(nodes=[o.id for o in source_objs], edges=edges)

    # -- missing evidence ---------------------------------------------------- #
    def _detect_missing_evidence(
        self, source_objs: list[WorkspaceObject]
    ) -> list[MissingEvidenceState]:
        def present(req: EvidenceRequirement) -> bool:
            for o in source_objs:
                hay = f"{o.id} {o.title} {' '.join(o.metadata.keys())}".lower()
                if any(tok.lower() in hay for tok in req.matches):
                    return True
            return False

        return [
            MissingEvidenceState(code=req.code, description=req.description, blocking=req.blocking)
            for req in self.recipe.required_evidence
            if not present(req)
        ]

    # -- claims -------------------------------------------------------------- #
    def _gap_claim_candidates(
        self, missing: list[MissingEvidenceState]
    ) -> list[CandidateClaim]:
        out: list[CandidateClaim] = []
        for ev in missing:
            req = self._req_by_code.get(ev.code)
            if req and req.claim_text:
                cites = (req.expected_source_id,) if req.expected_source_id else ()
                out.append(CandidateClaim(id=f"clm_{ev.code}", text=req.claim_text,
                                          cited_object_ids=cites))
        return out

    def _build_claims(
        self, candidates: list[CandidateClaim], accessible_ids: set[str]
    ) -> ClaimMap:
        claims: list[Claim] = []
        for i, c in enumerate(candidates):
            # Scrub citations to the accessible set: an LLM cannot ground a claim on a
            # denied or non-existent object. Support is then a deterministic fact.
            srcs = [
                SourceRef(object_id=oid, span=c.span)
                for oid in c.cited_object_ids
                if oid in accessible_ids
            ]
            claims.append(
                Claim(id=c.id or f"clm_{i + 1}", text=c.text, supported=bool(srcs), sources=srcs)
            )
        return ClaimMap(claims=claims)

    # -- conflicts ----------------------------------------------------------- #
    def _detect_metadata_conflicts(
        self, source_objs: list[WorkspaceObject]
    ) -> list[ConflictState]:
        conflicts: list[ConflictState] = []
        for key in self.recipe.conflict_probe_keys:
            holders = [(o.id, o.metadata[key]) for o in source_objs if key in o.metadata]
            if len(holders) >= 2 and len({v for _, v in holders}) >= 2:
                detail = ", ".join(f"{oid}={val}" for oid, val in holders)
                conflicts.append(
                    ConflictState(
                        description=f"Objects disagree on '{key}': {detail}.",
                        sources=[SourceRef(object_id=oid) for oid, _ in holders],
                    )
                )
        return conflicts

    def _declared_conflicts(self, accessible_ids: set[str]) -> list[ConflictState]:
        out: list[ConflictState] = []
        for dc in self.recipe.declared_conflicts:
            if all(a in accessible_ids for a in dc.anchor_object_ids):
                out.append(
                    ConflictState(
                        description=dc.description,
                        sources=[SourceRef(object_id=a) for a in dc.anchor_object_ids],
                    )
                )
        return out


# --------------------------------------------------------------------------- #
# Demo (so the integrator can call us on fixtures.acme)
# --------------------------------------------------------------------------- #


def assemble_acme_demo(
    user_id: str = "u_rm", intent: str = "prepare_decision_brief"
) -> ContextBundle:
    """Assemble the Acme bundle for ``user_id``; shaped like ``fixtures.acme.acme_bundle``."""
    return PermissionAwareContextAssembler().assemble(user_id, intent)


def main() -> None:
    b = assemble_acme_demo()
    print("WS-B ContextAssembler — demo over fixtures.acme")
    print(f"user={b.user_id!r} intent={b.intent!r}")
    print(f"sources       = {[s.object_id for s in b.sources]}")
    print(f"excluded      = {b.permission_boundary.excluded_object_ids} "
          f"({b.permission_boundary.reason})")
    graph = b.source_graph
    if graph is not None:
        print(f"source_graph  = {len(graph.nodes)} nodes, "
              f"{[(e.from_id, e.relation, e.to_id) for e in graph.edges]}")
    print("claims:")
    for c in b.claims.claims:
        cited = [s.object_id for s in c.sources]
        print(f"  - supported={c.supported!s:<5} {c.text}  cites={cited}")
    miss = [(m.code, "blocking" if m.blocking else "info") for m in b.missing_evidence]
    print(f"missing_evidence = {miss}")
    print("conflicts:")
    for cf in b.conflicts:
        print(f"  - {cf.description}  sources={[s.object_id for s in cf.sources]}")


if __name__ == "__main__":
    main()

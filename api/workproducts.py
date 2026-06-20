"""
api/workproducts.py — governed-record mint + verify (the third pillar, made literal).

Seals a decision packet into a GOVERNED RECORD: a point-in-time, server-sealed artifact carrying
the decision, deterministic gate results, evidence, permission omissions, the source versions it
was built from, and a keyed HMAC integrity seal. `verify` re-checks a sealed record against current
sources and reports staleness by REUSING the WS-F revalidation path — no gate is re-authored here.

Three independent trust axes:
  * integrity — the HMAC seal still matches the canonical content (tamper-evidence)
  * freshness — have the sealed sources changed since mint? (WS-F revalidation)
  * approval  — the deterministic gate, read from the brief (the Acme case stays NOT-ready)

The HMAC is SYMMETRIC: this server verifies its own seal (proves the record is unaltered since it
minted it). Independent third-party verification — without trusting this server — would require
asymmetric signing (e.g. Ed25519). Symmetric is the honest demo scope.

The store is in-memory and single-process: demo only (lost on reload; not worker-safe).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException
from pydantic import BaseModel

from core.schemas import (
    ContextBundle,
    DecisionBrief,
    DeterministicDecision,
    WorkProductContract,
    WorkspaceObject,
)
from corpus import apply_change, load
from lifecycle.revalidation import build_dependency_graph

from api.models import (
    ChangedSource,
    GovernanceEnvelope,
    GovernedRecord,
    MintResponse,
    PermissionOmission,
    RecordSeal,
    RecordSource,
    RecordVerification,
    SourceVersionSnapshot,
)
from api.orchestrator import (
    FINANCE_VERTICAL,
    RULEPACK_ID,
    _pin_contract,
    assemble_brief,
    revalidate,
)

# Which workspace object each deterministic change event mutates (no such map exists upstream).
_EVENT_CHANGED_OBJECT = {"legal_needs_review": "wf_approval", "financials_v2": "doc_financials"}

_RECORD_TITLE = "Acme renewal — committee decision packet"
_MINTED_BY = "Dana R."
_PATH_TO_READY = [
    "Route the pricing exception to the Credit Officer.",
    "Complete Legal approval.",
    "Upload the final covenant tracker.",
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _secret() -> bytes:
    """The HMAC key. Intentional NON-SECRET demo fallback so tests/CI/demo run offline and
    deterministically; production overrides via `.env` (WORKPRODUCT_SECRET). Not a real
    credential, so this does not violate the "never hardcode keys" rule."""
    return os.environ.get("WORKPRODUCT_SECRET", "dev-demo-not-secret").encode()


# --------------------------------------------------------------------------- #
# In-memory store (demo only)
# --------------------------------------------------------------------------- #
@dataclass
class _StoredRecord:
    record: GovernedRecord
    brief: DecisionBrief
    contract: WorkProductContract
    snapshot: dict[str, SourceVersionSnapshot]
    canonical_bytes: bytes


_STORE: dict[str, _StoredRecord] = {}


# --------------------------------------------------------------------------- #
# Canonicalization + seal
# --------------------------------------------------------------------------- #
class _ContentCore(BaseModel):
    """The exact preimage the seal covers: the decision + the governance envelope WITHOUT its seal,
    and WITHOUT the mint envelope (record_id/minted_at live on the record, never here). Excluding
    those keeps two mints byte-identical (clean determinism) and the seal out of its own preimage."""

    decision_brief: DecisionBrief
    governance: GovernanceEnvelope


def _canonical_bytes(core: _ContentCore) -> bytes:
    return json.dumps(core.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode()


# --------------------------------------------------------------------------- #
# Snapshot + projection helpers
# --------------------------------------------------------------------------- #
def _snapshot(
    object_ids: list[str], workspace: dict[str, WorkspaceObject]
) -> dict[str, SourceVersionSnapshot]:
    """Snapshot version + metadata for the record's source dependencies (route everything through
    model_dump(mode="json") so enums/datetimes never reach the canonical JSON raw)."""
    snap: dict[str, SourceVersionSnapshot] = {}
    for object_id in object_ids:
        obj = workspace.get(object_id)
        if obj is None:
            continue
        dumped = obj.model_dump(mode="json", include={"id", "title", "type", "version", "metadata"})
        snap[object_id] = SourceVersionSnapshot(
            object_id=dumped["id"],
            title=dumped["title"],
            type=dumped["type"],
            version=dumped["version"],
            metadata=dumped["metadata"],
        )
    return snap


def _record_sources(
    bundle: ContextBundle, workspace: dict[str, WorkspaceObject]
) -> list[RecordSource]:
    """Enrich the bundle's permission-filtered sources with title/type and a derived status."""
    conflict_ids = {ref.object_id for conflict in bundle.conflicts for ref in conflict.sources}
    out: list[RecordSource] = []
    for ref in bundle.sources:
        obj = workspace.get(ref.object_id)
        out.append(
            RecordSource(
                object_id=ref.object_id,
                title=obj.title if obj else "",
                type=obj.type.value if obj else "",
                status="conflicting" if ref.object_id in conflict_ids else "used",
            )
        )
    return out


def _permission_omissions(
    bundle: ContextBundle, workspace: dict[str, WorkspaceObject]
) -> list[PermissionOmission]:
    out: list[PermissionOmission] = []
    for object_id in bundle.permission_boundary.excluded_object_ids:
        obj = workspace.get(object_id)
        out.append(
            PermissionOmission(
                object_id=object_id,
                title=obj.title if obj else "",
                reason="restricted source; user lacked access at mint time",
            )
        )
    return out


def _approval_reason(gate: DeterministicDecision) -> str:
    """Human-readable reason, derived from the deterministic gate's failing firings."""
    failing = [firing.detail for firing in gate.firings if not firing.passed]
    return " ".join(failing)


# --------------------------------------------------------------------------- #
# Mint / get / verify
# --------------------------------------------------------------------------- #
def mint(user_id: str, intent: str) -> MintResponse:
    """Seal the decision packet into a governed record. Composes the live brief + gate, snapshots
    the source versions, and attaches a server-minted HMAC seal. Runs NO actions and NO loop."""
    brief, bundle = assemble_brief(user_id, intent)
    contract = _pin_contract(user_id, bundle)
    workspace = {obj.id: obj for obj in load(FINANCE_VERTICAL)}

    snapshot = _snapshot(contract.source_dependencies, workspace)
    gate = brief.policy_gates  # the deterministic decision, copied into the brief untouched
    governance = GovernanceEnvelope(
        approval_ready=gate.approval_ready,
        approval_stamp="NOT APPROVAL-READY" if not gate.approval_ready else "APPROVAL-READY",
        approval_reason=_approval_reason(gate),
        path_to_ready=list(_PATH_TO_READY),
        permission_omissions=_permission_omissions(bundle, workspace),
        source_versions=list(snapshot.values()),
        section_dependencies=build_dependency_graph(brief, contract).section_dependencies,
        rulepack_id=RULEPACK_ID,
    )

    canonical = _canonical_bytes(_ContentCore(decision_brief=brief, governance=governance))
    payload_hash = hashlib.sha256(canonical).hexdigest()
    governance.seal = RecordSeal(
        payload_hash=payload_hash,
        value=hmac.new(_secret(), canonical, hashlib.sha256).hexdigest(),
    )

    record_id = uuid.uuid4().hex
    record = GovernedRecord(
        record_id=record_id,
        work_product_id=contract.id,
        title=_RECORD_TITLE,
        minted_by=_MINTED_BY,
        minted_at=_now(),
        decision_brief=brief,
        sources=_record_sources(bundle, workspace),
        governance=governance,
    )
    _STORE[record_id] = _StoredRecord(
        record=record,
        brief=brief,
        contract=contract,
        snapshot=snapshot,
        canonical_bytes=canonical,
    )
    return MintResponse(record_id=record_id, record=record)


def get(record_id: str) -> GovernedRecord:
    stored = _STORE.get(record_id)
    if stored is None:
        raise HTTPException(status_code=404, detail=f"record not found: {record_id}")
    return stored.record


def verify(record_id: str, event: str | None) -> RecordVerification:
    """Re-check a sealed record on three independent axes: integrity (re-HMAC the sealed canonical
    bytes), freshness (apply the change event + reuse WS-F revalidation), and approval-readiness
    (unchanged). `event=None` re-checks against unchanged sources → freshness stays 'current'."""
    stored = _STORE.get(record_id)
    if stored is None:
        raise HTTPException(status_code=404, detail=f"record not found: {record_id}")

    # Integrity: the seal is the authority. Re-HMAC the sealed bytes and constant-time compare.
    recomputed = hmac.new(_secret(), stored.canonical_bytes, hashlib.sha256).hexdigest()
    integrity_valid = hmac.compare_digest(recomputed, stored.record.governance.seal.value)

    changed_sources: list[ChangedSource] = []
    stale_sections = []
    reapproval_routes = []
    freshness = "current"

    if event:
        if event not in _EVENT_CHANGED_OBJECT:
            raise HTTPException(status_code=422, detail=f"unknown change event: {event}")
        changed_object_id = _EVENT_CHANGED_OBJECT[event]
        changed_objs = apply_change(load(FINANCE_VERTICAL), event)
        changed_sources = _diff_changed(stored.snapshot, changed_objs, changed_object_id)
        result = revalidate(
            stored.contract, changed_object_id, brief=stored.brief, source_objects=changed_objs
        )
        stale_sections = result.stale_sections
        reapproval_routes = result.reapproval_routes
        freshness = "stale" if any(section.stale for section in stale_sections) else "current"

    verification = RecordVerification(
        record_id=record_id,
        integrity_valid=integrity_valid,
        freshness=freshness,
        approval_ready=stored.record.governance.approval_ready,
        verified_at=_now(),
        changed_sources=changed_sources,
        stale_sections=stale_sections,
        reapproval_routes=reapproval_routes,
    )
    stored.record.verification = verification  # GET reflects the latest verification
    return verification


def _diff_changed(
    snapshot: dict[str, SourceVersionSnapshot],
    changed_objs: list[WorkspaceObject],
    changed_object_id: str,
) -> list[ChangedSource]:
    """Diff the SEALED snapshot of the changed object against its post-change metadata."""
    snap = snapshot.get(changed_object_id)
    current = next((obj for obj in changed_objs if obj.id == changed_object_id), None)
    if snap is None or current is None:
        return []
    before_meta = snap.metadata
    after_meta = current.model_dump(mode="json")["metadata"]
    changes: list[ChangedSource] = []
    for key in sorted(set(before_meta) | set(after_meta)):
        before = before_meta.get(key)
        after = after_meta.get(key)
        if before != after:
            changes.append(
                ChangedSource(
                    object_id=changed_object_id,
                    title=current.title,
                    field=key,
                    before=before,
                    after=after,
                )
            )
    return changes

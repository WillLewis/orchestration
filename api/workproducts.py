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

from api.lifecycle_events import lifecycle_state
from api.models import (
    ChangedSource,
    GateChange,
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
    verify_context,
)
from api.presentation import build_display_brief

# Which workspace object each deterministic change event mutates (no such map exists upstream).
_EVENT_CHANGED_OBJECT = {"legal_needs_review": "wf_approval", "financials_v2": "doc_financials"}

_RECORD_TITLE = "Acme renewal — Decision Brief"
_MINTED_BY = "Dana R."


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
    bundle: ContextBundle
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


def _approval_ready_from_state(state) -> bool:
    return (
        state.credit_signed
        and state.legal_signed
        and state.covenant_uploaded
        and state.cs_reconciled
    )


def _path_to_ready_from_state(state) -> list[str]:
    if _approval_ready_from_state(state):
        return []
    steps: list[str] = []
    if not state.credit_signed:
        steps.append("Route the pricing exception to the Credit Officer.")
    if state.credit_signed and not state.cs_reconciled:
        steps.append("Reconcile the customer success plan to the approved 22% discount.")
    if not state.legal_signed:
        steps.append("Complete Legal approval.")
    if not state.covenant_uploaded:
        steps.append("Upload the final covenant tracker.")
    return steps


def _approval_reason_from_state(gate: DeterministicDecision, state) -> str:
    if _approval_ready_from_state(state):
        return "Credit Officer, Legal, covenant evidence, and source revalidation are complete."
    if state.credit_signed:
        return "Remaining prerequisites must clear before committee decision."
    return _approval_reason(gate)


def _loop_summary_from_state(state) -> dict[str, str] | None:
    if _approval_ready_from_state(state):
        return {
            "summary": (
                "Discount exception approved at 22%; Legal approved the covenant modification; "
                "final covenant tracker uploaded; customer success plan reconciled."
            )
        }
    if state.credit_signed and state.cs_reconciled:
        return {
            "summary": (
                "Discount exception approved at 22%; customer success plan reconciled. Legal "
                "approval and the final covenant tracker remain open."
            )
        }
    if state.credit_signed:
        return {
            "summary": (
                "Discount exception approved at 22%; downstream customer success plan "
                "reconciliation is pending."
            )
        }
    return None


def _apply_lifecycle_to_source_versions(
    versions: list[SourceVersionSnapshot],
    state,
) -> list[SourceVersionSnapshot]:
    updated: list[SourceVersionSnapshot] = []
    saw_covenant = False
    for source in versions:
        if source.object_id == "wf_approval":
            metadata = {
                **source.metadata,
                "legal_status": "approved" if state.legal_signed else "pending",
                "credit_officer_approval": state.credit_signed,
            }
            updated.append(
                source.model_copy(
                    update={
                        "version": 2
                        if state.credit_signed or state.legal_signed
                        else source.version,
                        "metadata": metadata,
                    }
                )
            )
        elif source.object_id == "doc_cs_plan" and state.cs_reconciled:
            updated.append(
                source.model_copy(update={"version": 2, "metadata": {"assumed_discount": "22%"}})
            )
        elif source.object_id == "doc_covenant_tracker":
            saw_covenant = True
            updated.append(
                source.model_copy(
                    update={
                        "version": 1,
                        "metadata": {"uploaded": state.covenant_uploaded},
                    }
                )
            )
        else:
            updated.append(source)
    if state.covenant_uploaded and not saw_covenant:
        updated.append(
            SourceVersionSnapshot(
                object_id="doc_covenant_tracker",
                title="Final covenant tracker",
                type="document",
                version=1,
                metadata={"uploaded": True},
            )
        )
    return updated


# --------------------------------------------------------------------------- #
# Mint / get / verify
# --------------------------------------------------------------------------- #
def mint(user_id: str, intent: str) -> MintResponse:
    """Seal the Decision Brief into a governed record. Composes the live brief + gate, snapshots
    the source versions, and attaches a server-minted HMAC seal. Runs NO actions and NO loop."""
    brief, bundle = assemble_brief(user_id, intent)
    state = lifecycle_state(user_id=user_id, intent=intent)
    display_brief = build_display_brief(brief, bundle, state)
    contract = _pin_contract(user_id, bundle)
    workspace = {obj.id: obj for obj in load(FINANCE_VERTICAL)}

    snapshot = _snapshot(contract.source_dependencies, workspace)
    gate = display_brief.policy_gates  # the deterministic decision, copied into the brief untouched
    approval_ready = _approval_ready_from_state(state)
    governance = GovernanceEnvelope(
        approval_ready=approval_ready,
        approval_stamp="APPROVAL-READY" if approval_ready else "NOT APPROVAL-READY",
        approval_reason=_approval_reason_from_state(gate, state),
        path_to_ready=_path_to_ready_from_state(state),
        permission_omissions=_permission_omissions(bundle, workspace),
        source_versions=_apply_lifecycle_to_source_versions(list(snapshot.values()), state),
        section_dependencies=build_dependency_graph(display_brief, contract).section_dependencies,
        rulepack_id=RULEPACK_ID,
        loop_summary=_loop_summary_from_state(state),
    )

    canonical = _canonical_bytes(_ContentCore(decision_brief=display_brief, governance=governance))
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
        decision_brief=display_brief,
        sources=_record_sources(bundle, workspace),
        governance=governance,
    )
    _STORE[record_id] = _StoredRecord(
        record=record,
        brief=display_brief,
        contract=contract,
        bundle=bundle,
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
    gate_changes: list[GateChange] = []
    stale_sections = []
    reapproval_routes = []
    freshness = "current"
    approval_ready = stored.record.governance.approval_ready

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
        # Re-decide the gate against the changed sources: a revenue revision recomputes the DSCR,
        # which can trip the covenant floor — a flip the sealed decision could not have known.
        recomputed = _recompute_decision(stored.bundle, changed_objs, changed_object_id)
        gate_changes = _gate_changes(stored.brief.policy_gates, recomputed)
        approval_ready = recomputed.approval_ready

    verification = RecordVerification(
        record_id=record_id,
        integrity_valid=integrity_valid,
        freshness=freshness,
        approval_ready=approval_ready,
        verified_at=_now(),
        changed_sources=changed_sources,
        gate_changes=gate_changes,
        stale_sections=stale_sections,
        reapproval_routes=reapproval_routes,
    )
    stored.record.verification = verification  # GET reflects the latest verification
    return verification


def _recompute_decision(
    bundle: ContextBundle,
    changed_objs: list[WorkspaceObject],
    changed_object_id: str,
) -> DeterministicDecision:
    """Re-run the deterministic gate against the changed sources. For the financial model, feed the
    recomputed DSCR (from the changed structured values) into the bundle via the verification span,
    so the covenant gate re-decides on the new number."""
    sources = list(bundle.sources)
    if changed_object_id == "doc_financials":
        changed_fin = next((obj for obj in changed_objs if obj.id == "doc_financials"), None)
        structured = changed_fin.metadata.get("structured_values", {}) if changed_fin else {}
        cash_flow = structured.get("ebitda")
        debt_service = structured.get("debt_service")
        if cash_flow is not None and debt_service is not None:
            dscr = round(float(cash_flow) / float(debt_service), 4)
            span = json.dumps(
                {
                    "verification": {
                        "calculations": [
                            {
                                "name": "dscr",
                                "expected": dscr,
                                "inputs": {
                                    "cash_flow": float(cash_flow),
                                    "debt_service": float(debt_service),
                                },
                                "tolerance": 0.005,
                            }
                        ]
                    }
                }
            )
            sources = [
                ref.model_copy(update={"span": span})
                if ref.object_id == "doc_financials"
                else ref
                for ref in bundle.sources
            ]
    return verify_context(bundle.model_copy(update={"sources": sources}))


def _gate_changes(
    before: DeterministicDecision, after: DeterministicDecision
) -> list[GateChange]:
    """List the gates whose verdict flipped between the sealed decision and the recompute."""
    before_by_id = {firing.rule_id: firing for firing in before.firings}
    changes: list[GateChange] = []
    for firing in after.firings:
        prior = before_by_id.get(firing.rule_id)
        if prior is not None and prior.passed != firing.passed:
            changes.append(
                GateChange(
                    rule_id=firing.rule_id,
                    before_passed=prior.passed,
                    after_passed=firing.passed,
                    detail=firing.detail,
                )
            )
    return changes


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

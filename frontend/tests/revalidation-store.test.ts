import { describe, expect, it } from "bun:test";

import {
  approval_role_labels,
  decision_brief,
  decision_readiness,
  rulepack_id,
  rulepack_version,
  source_count,
  sources,
} from "../src/data/brief";
import {
  buildGovernedBrief,
  buildLiveGovernedBrief,
  acceptCascadeEdit,
  getRevalidationState,
  requestCovenantTracker,
  resetRevalidation,
  routeToCreditOfficer,
  routeToLegal,
  simulateCovenantUpload,
  simulateCreditOfficerResponse,
  simulateLegalResponse,
} from "../src/lib/revalidation-store";
import { buildGovernanceCertificate } from "../src/data/record";

const baseBrief = {
  decision_brief,
  decision_readiness,
  sources,
  source_count,
  approval_role_labels,
  rulepack_id,
  rulepack_version,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function creditRow() {
  return buildGovernedBrief(baseBrief, getRevalidationState()).decision_readiness.rows.find(
    (row) => row.id === "credit_officer_approval",
  );
}

describe("revalidation counterparty state", () => {
  it("keeps the Credit Officer route pending without hidden timer sign-off", async () => {
    resetRevalidation();

    (routeToCreditOfficer as (legacyDelayMs?: number) => void)(1);

    expect(getRevalidationState()).toMatchObject({ routed: true, creditSigned: false });
    expect(creditRow()?.status).toBe("pending");

    await sleep(20);

    expect(getRevalidationState()).toMatchObject({ routed: true, creditSigned: false });
    expect(creditRow()?.status).toBe("pending");
  });

  it("reveals the CS-plan conflict only after visible Credit Officer simulation", () => {
    resetRevalidation();

    const initial = buildGovernedBrief(baseBrief, getRevalidationState());
    expect(initial.decision_brief.policy_gates.approval_ready).toBe(false);
    expect(initial.decision_brief.conflicts).toHaveLength(0);
    expect(simulateCreditOfficerResponse()).toBe(false);

    routeToCreditOfficer();

    const routed = buildGovernedBrief(baseBrief, getRevalidationState());
    expect(
      routed.decision_readiness.rows.find((row) => row.id === "credit_officer_approval"),
    ).toMatchObject({ status: "pending" });
    expect(routed.decision_brief.conflicts).toHaveLength(0);

    expect(simulateCreditOfficerResponse()).toBe(true);

    const signed = buildGovernedBrief(baseBrief, getRevalidationState());
    expect(signed.decision_brief.policy_gates.approval_ready).toBe(false);
    expect(signed.decision_brief.conflicts).toHaveLength(1);
    expect(
      signed.decision_readiness.rows.find((row) => row.id === "credit_officer_approval"),
    ).toMatchObject({ status: "approved" });
    expect(signed.decision_readiness.rows.find((row) => row.id === "legal_approval")).toMatchObject(
      { status: "pending" },
    );
    expect(
      signed.decision_readiness.rows.find((row) => row.id === "covenant_tracker"),
    ).toMatchObject({ status: "blocking" });
  });

  it("removes the live Credit Officer route action immediately after routing", () => {
    const routed = buildLiveGovernedBrief(baseBrief, {
      user_id: "u_rm",
      intent: "prepare_decision_brief",
      routed: true,
      credit_signed: false,
      legal_routed: false,
      legal_signed: false,
      covenant_requested: false,
      covenant_uploaded: false,
      cs_reconciled: false,
      stage: "credit_routed",
      cascade_available: false,
      changes_count: 0,
      event_count: 1,
      events: [],
    });
    const row = routed.decision_readiness.rows.find(
      (item) => item.id === "credit_officer_approval",
    );

    expect(row).toMatchObject({
      status: "pending",
      details: "Routed — pending Credit Officer sign-off on the 22% exception.",
      action: null,
    });
    expect(routed.decision_brief.conflicts).toHaveLength(0);
    expect(routed.path_to_ready[0]).toMatchObject({
      label: "Route to Credit Officer",
      done: true,
    });
  });

  it("keeps Legal routed until the visible simulated Legal response", () => {
    resetRevalidation();

    routeToLegal();

    let governed = buildGovernedBrief(baseBrief, getRevalidationState());
    expect(getRevalidationState()).toMatchObject({ legalRouted: true, legalSigned: false });
    expect(
      governed.decision_readiness.rows.find((row) => row.id === "legal_approval"),
    ).toMatchObject({
      status: "pending",
      action: null,
    });

    expect(simulateLegalResponse()).toBe(true);

    governed = buildGovernedBrief(baseBrief, getRevalidationState());
    expect(getRevalidationState()).toMatchObject({ legalRouted: false, legalSigned: true });
    expect(
      governed.decision_readiness.rows.find((row) => row.id === "legal_approval"),
    ).toMatchObject({
      status: "approved",
      action: null,
    });
    expect(governed.decision_brief.policy_gates.approval_ready).toBe(false);
  });

  it("keeps covenant tracker requested until the visible simulated upload", () => {
    resetRevalidation();

    requestCovenantTracker();

    let governed = buildGovernedBrief(baseBrief, getRevalidationState());
    expect(getRevalidationState()).toMatchObject({
      covenantRequested: true,
      covenantUploaded: false,
    });
    expect(
      governed.decision_readiness.rows.find((row) => row.id === "covenant_tracker"),
    ).toMatchObject({
      status: "pending",
      action: null,
    });

    expect(simulateCovenantUpload()).toBe(true);

    governed = buildGovernedBrief(baseBrief, getRevalidationState());
    expect(getRevalidationState()).toMatchObject({
      covenantRequested: false,
      covenantUploaded: true,
    });
    expect(
      governed.decision_readiness.rows.find((row) => row.id === "covenant_tracker"),
    ).toMatchObject({
      status: "passed",
      action: null,
    });
    expect(governed.decision_brief.policy_gates.approval_ready).toBe(false);
  });

  it("marks the brief approval-ready only after every demo dependency clears", () => {
    resetRevalidation();

    routeToCreditOfficer();
    expect(simulateCreditOfficerResponse()).toBe(true);
    acceptCascadeEdit();
    routeToLegal();
    expect(simulateLegalResponse()).toBe(true);
    requestCovenantTracker();
    expect(simulateCovenantUpload()).toBe(true);

    const governed = buildGovernedBrief(baseBrief, getRevalidationState());

    expect(governed.decision_brief.policy_gates.approval_ready).toBe(true);
    expect(governed.decision_brief.what_changed).toContain(
      "Legal approved the covenant modification.",
    );
    expect(governed.decision_brief.what_changed).not.toContain("Legal approval is still pending.");
    expect(governed.stage).toBe("approval_ready");
    expect(governed.path_to_ready).toEqual([
      { label: "Route to Credit Officer", done: true },
      { label: "Complete Legal approval", done: true },
      { label: "Upload final covenant tracker", done: true },
    ]);
  });

  it("carries the fully cleared lifecycle into the governed record certificate", () => {
    resetRevalidation();

    routeToCreditOfficer();
    expect(simulateCreditOfficerResponse()).toBe(true);
    acceptCascadeEdit();
    routeToLegal();
    expect(simulateLegalResponse()).toBe(true);
    requestCovenantTracker();
    expect(simulateCovenantUpload()).toBe(true);

    const governed = buildGovernedBrief(baseBrief, getRevalidationState());
    const certificate = buildGovernanceCertificate({
      decision_brief: governed.decision_brief,
      sources: governed.sources,
      creditSigned: true,
      legalSigned: true,
      covenantUploaded: true,
      csReconciled: true,
    });

    expect(certificate.governance.approval_ready).toBe(true);
    expect(certificate.governance.approval_stamp).toBe("APPROVAL-READY");
    expect(certificate.governance.path_to_ready).toEqual([]);
    expect(
      certificate.governance.source_versions.find((source) => source.object_id === "wf_approval")
        ?.metadata,
    ).toMatchObject({ credit_officer_approval: true, legal_status: "approved" });
    expect(
      certificate.governance.source_versions.some(
        (source) => source.object_id === "doc_covenant_tracker",
      ),
    ).toBe(true);
  });
});

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
  getRevalidationState,
  resetRevalidation,
  routeToCreditOfficer,
  simulateCreditOfficerResponse,
} from "../src/lib/revalidation-store";

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
});

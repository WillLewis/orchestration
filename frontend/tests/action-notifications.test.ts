import { beforeEach, describe, expect, it } from "bun:test";

import { action_key, action_plan } from "../src/data/actions";
import {
  approval_role_labels,
  decision_brief,
  decision_readiness,
  rulepack_id,
  rulepack_version,
  source_count,
  sources,
  type DecisionReadinessRow,
} from "../src/data/brief";
import {
  approveAction,
  executeApproved,
  getCurrentAgentActionNotificationCounts,
  markActionChipOpened,
  recordReturnedChangeNotification,
  resetActions,
  stageDecisionReadinessRemediation,
} from "../src/lib/actions-store";
import {
  acceptCascadeEdit,
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

function creditOfficerRow(): DecisionReadinessRow {
  const row = decision_readiness.rows.find((item) => item.id === "credit_officer_approval");
  if (!row) throw new Error("credit_officer_approval fixture missing");
  return row;
}

function creditOfficerRouteAction() {
  const action = action_plan.actions.find(
    (item) =>
      item.tool === "route_approval" &&
      item.required_approver === "credit_officer" &&
      item.diff.target_object_id === "doc_pricing_exception",
  );
  if (!action) throw new Error("Credit Officer route action missing");
  return action;
}

describe("Agent Actions notifications", () => {
  beforeEach(() => {
    resetActions();
    resetRevalidation();
  });

  it("counts a staged Credit Officer route under Next actions", () => {
    stageDecisionReadinessRemediation(creditOfficerRow());

    const counts = getCurrentAgentActionNotificationCounts(getRevalidationState());

    expect(counts.nextTotal).toBe(1);
    expect(counts.nextUnseen).toBe(1);
    expect(counts.changesTotal).toBe(0);
    expect(counts.topNavUnseen).toBe(1);
  });

  it("clears only the relevant chip badge when that chip is opened", () => {
    stageDecisionReadinessRemediation(creditOfficerRow());

    let counts = getCurrentAgentActionNotificationCounts(getRevalidationState());
    markActionChipOpened("changes", counts.changesItemIds);

    counts = getCurrentAgentActionNotificationCounts(getRevalidationState());
    expect(counts.nextTotal).toBe(1);
    expect(counts.nextUnseen).toBe(1);

    markActionChipOpened("next", counts.nextItemIds);

    counts = getCurrentAgentActionNotificationCounts(getRevalidationState());
    expect(counts.nextTotal).toBe(1);
    expect(counts.nextUnseen).toBe(0);
    expect(counts.topNavUnseen).toBe(0);
  });

  it("clears Next actions when the staged route is executed", () => {
    stageDecisionReadinessRemediation(creditOfficerRow());
    const action = creditOfficerRouteAction();

    approveAction(action_key(action));
    expect(executeApproved("Dana R.", [action])).toBe(1);

    const counts = getCurrentAgentActionNotificationCounts(getRevalidationState());

    expect(counts.nextTotal).toBe(0);
    expect(counts.nextUnseen).toBe(0);
  });

  it("creates one Changes item after the visible Credit Officer response", () => {
    routeToCreditOfficer();
    expect(simulateCreditOfficerResponse()).toBe(true);
    recordReturnedChangeNotification();

    const counts = getCurrentAgentActionNotificationCounts(getRevalidationState());

    expect(counts.nextTotal).toBe(0);
    expect(counts.changesTotal).toBe(1);
    expect(counts.changesUnseen).toBe(1);

    markActionChipOpened("next", counts.nextItemIds);
    expect(getCurrentAgentActionNotificationCounts(getRevalidationState()).changesUnseen).toBe(1);

    markActionChipOpened("changes", counts.changesItemIds);
    expect(getCurrentAgentActionNotificationCounts(getRevalidationState()).changesUnseen).toBe(0);
  });

  it("accepts reconciliation, clears the conflict, and keeps approval_ready false", () => {
    routeToCreditOfficer();
    expect(simulateCreditOfficerResponse()).toBe(true);
    recordReturnedChangeNotification();

    const pending = buildGovernedBrief(baseBrief, getRevalidationState());
    expect(pending.decision_brief.conflicts).toHaveLength(1);
    expect(getCurrentAgentActionNotificationCounts(getRevalidationState()).changesTotal).toBe(1);

    acceptCascadeEdit();

    const accepted = buildGovernedBrief(baseBrief, getRevalidationState());
    const counts = getCurrentAgentActionNotificationCounts(getRevalidationState());

    expect(counts.changesTotal).toBe(0);
    expect(accepted.decision_brief.conflicts).toHaveLength(0);
    expect(accepted.decision_brief.policy_gates.approval_ready).toBe(false);
    expect(
      accepted.decision_readiness.rows.find((row) => row.id === "legal_approval"),
    ).toMatchObject({ status: "pending" });
    expect(
      accepted.decision_readiness.rows.find((row) => row.id === "covenant_tracker"),
    ).toMatchObject({ status: "blocking" });
  });
});

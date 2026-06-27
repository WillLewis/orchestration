import { describe, expect, it } from "bun:test";

import { action_plan, type Action } from "../src/data/actions";
import { decision_readiness, type DecisionReadinessRow } from "../src/data/brief";
import {
  buildStagedRemediationReference,
  composeStagedRemediationCard,
  deriveDrawerActions,
  hasRenderableOrigin,
  withStagedOrigin,
  withBatchOrigin,
} from "../src/lib/staged-remediation";
import {
  stagedRemediationExecuteRequestBody,
  stagedRemediationRequestBody,
} from "../src/hooks/queries";

const creditOfficerRow = decision_readiness.rows.find(
  (row) => row.id === "credit_officer_approval",
);

function requireCreditOfficerRow(): DecisionReadinessRow {
  if (!creditOfficerRow) throw new Error("credit_officer_approval fixture missing");
  return creditOfficerRow;
}

function requireReference(row = requireCreditOfficerRow()) {
  const reference = buildStagedRemediationReference(row);
  if (!reference) throw new Error("row should have a remediation");
  return reference;
}

describe("staged readiness remediation provenance", () => {
  it("builds the locked row-origin shape for the Credit Officer Stage action", () => {
    const reference = requireReference();

    expect(reference.origin).toEqual({
      surface: "decision_readiness",
      row_id: "credit_officer_approval",
      remediation_tool: "route_approval",
      target_object_id: "doc_pricing_exception",
      required_approver: "credit_officer",
    });
    expect(reference.remediation.parameters?.business_label).toBe("22% pricing exception");
  });

  it("derives exactly one Next actions card from the staged row reference", () => {
    const reference = requireReference();
    const actions = deriveDrawerActions({
      mode: "staged_remediation",
      staged_remediations: [reference],
      validationActions: action_plan.actions,
      creditSigned: false,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].origin).toEqual(reference.origin);
    expect(actions[0].diff.after.approval_request).toBe("22% pricing exception");
    expect(actions[0].reason).toContain("22% pricing exception");
    expect(actions[0].blocked_reason).toBeNull();
  });

  it("changes the drawer card when the row remediation business parameters change", () => {
    const base = requireCreditOfficerRow();
    const changed: DecisionReadinessRow = {
      ...base,
      action: {
        ...base.action!,
        parameters: {
          business_label: "18% pricing exception",
          requested_discount_percent: 18,
          route_note: "Route the 18% pricing exception to the Credit Officer.",
        },
      },
    };
    const card = composeStagedRemediationCard(requireReference(changed), action_plan.actions);

    expect(card.diff.after.approval_request).toBe("18% pricing exception");
    expect(card.diff.after.requested_discount).toBe("18%");
    expect(card.reason).toBe("Route the 18% pricing exception to the Credit Officer.");
  });

  it("keeps a blocked validation result visible with row provenance", () => {
    const reference = requireReference();
    const blockedPlan = action_plan.actions.map((action): Action => {
      if (action.tool !== "route_approval" || action.required_approver !== "credit_officer") {
        return action;
      }
      return { ...action, blocked_reason: "approval: Credit Officer route unavailable" };
    });
    const actions = deriveDrawerActions({
      mode: "staged_remediation",
      staged_remediations: [reference],
      validationActions: blockedPlan,
      creditSigned: false,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].blocked_reason).toBe("approval: Credit Officer route unavailable");
    expect(actions[0].origin).toEqual(reference.origin);
  });

  it("renders invalid staged remediation as blocked instead of dropping it", () => {
    const base = requireCreditOfficerRow();
    const invalid: DecisionReadinessRow = {
      ...base,
      action: {
        ...base.action!,
        target_object_id: "doc_missing_route_target",
      },
    };
    const actions = deriveDrawerActions({
      mode: "staged_remediation",
      staged_remediations: [requireReference(invalid)],
      validationActions: action_plan.actions,
      creditSigned: false,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].blocked_reason).toContain("no composer output matched");
    expect(actions[0].origin.surface).toBe("decision_readiness");
  });

  it("requires renderable actions to have row provenance or explicit batch origin", () => {
    const raw = action_plan.actions[0];
    const batch = withBatchOrigin([raw]);

    expect(hasRenderableOrigin(raw)).toBe(false);
    expect(batch).toHaveLength(1);
    expect(batch[0].origin).toEqual({ surface: "batch_proposal", batch_id: "acme_followups" });
    expect(hasRenderableOrigin(batch[0])).toBe(true);
  });

  it("renders multiple staged row references as independent drawer cards", () => {
    const credit = requireReference();
    const legalRow = decision_readiness.rows.find((row) => row.id === "legal_approval");
    if (!legalRow) throw new Error("legal_approval fixture missing");
    const legal = requireReference(legalRow);

    const actions = deriveDrawerActions({
      mode: "staged_remediation",
      staged_remediations: [credit, legal],
      validationActions: action_plan.actions,
      creditSigned: false,
    });

    expect(actions).toHaveLength(2);
    expect(actions.map((action) => action.origin.surface)).toEqual([
      "decision_readiness",
      "decision_readiness",
    ]);
    expect(actions.map((action) => action.origin.row_id).sort()).toEqual([
      "credit_officer_approval",
      "legal_approval",
    ]);
  });

  it("builds the live staged-remediation request from the row reference", () => {
    const reference = requireReference();

    expect(stagedRemediationRequestBody(reference)).toEqual({
      user_id: "u_rm",
      intent: "prepare_decision_brief",
      origin: reference.origin,
      remediation: reference.remediation,
      row_gate: "Credit Officer approval",
      row_details: "Requested discount is 22%, above the RM approval threshold of 15%.",
      source_ids: ["doc_pricing_exception", "wf_approval"],
    });
  });

  it("uses live validated staged cards ahead of local plan fallback", () => {
    const reference = requireReference();
    const localReady = action_plan.actions.find(
      (action) => action.tool === "route_approval" && action.required_approver === "credit_officer",
    );
    if (!localReady) throw new Error("credit officer route action missing");
    const liveBlocked = withStagedOrigin(
      { ...localReady, blocked_reason: "server validation: route window closed" },
      reference,
    );

    const actions = deriveDrawerActions({
      mode: "staged_remediation",
      staged_remediations: [reference],
      stagedValidatedActions: [liveBlocked],
      validationActions: action_plan.actions,
      creditSigned: false,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].blocked_reason).toBe("server validation: route window closed");
    expect(actions[0].origin).toEqual(reference.origin);
  });

  it("renders a live validation failure as a blocked staged card", () => {
    const reference = requireReference();

    const actions = deriveDrawerActions({
      mode: "staged_remediation",
      staged_remediations: [reference],
      stagedValidatedActions: [],
      stagedValidationErrors: {
        credit_officer_approval: "/actions/staged-remediation → 409",
      },
      validationActions: action_plan.actions,
      creditSigned: false,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].origin).toEqual(reference.origin);
    expect(actions[0].blocked_reason).toContain("live validation unavailable");
    expect(actions[0].blocked_reason).toContain("409");
  });

  it("builds the live staged-remediation execute request from the row reference", () => {
    const reference = requireReference();

    expect(stagedRemediationExecuteRequestBody(reference)).toEqual({
      ...stagedRemediationRequestBody(reference),
      approved: true,
    });
  });
});

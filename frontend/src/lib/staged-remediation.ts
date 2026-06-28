import type { Action } from "@/data/actions";
import type { DecisionReadinessAction, DecisionReadinessRow } from "@/data/brief";

export type DecisionReadinessOrigin = {
  surface: "decision_readiness";
  row_id: string;
  remediation_tool: string;
  target_object_id: string;
  required_approver?: string | null;
};

export type BatchActionOrigin = {
  surface: "batch_proposal";
  batch_id: string;
};

export type ActionOrigin = DecisionReadinessOrigin | BatchActionOrigin;
export type OriginatedAction = Action & { origin: ActionOrigin };

export type StagedRemediationReference = {
  origin: DecisionReadinessOrigin;
  remediation: DecisionReadinessAction;
  row_gate: string;
  row_details: string;
  source_ids: string[];
};

export type DrawerActionMode = "plan" | "staged_remediation" | "revalidation_edit";

export function buildStagedRemediationReference(
  row: DecisionReadinessRow,
): StagedRemediationReference | null {
  if (!row.action) return null;
  return {
    origin: {
      surface: "decision_readiness",
      row_id: row.id,
      remediation_tool: row.action.tool,
      target_object_id: row.action.target_object_id,
      required_approver: row.action.required_approver ?? null,
    },
    remediation: { ...row.action },
    row_gate: row.gate,
    row_details: row.details,
    source_ids: [...row.source_ids],
  };
}

export function withBatchOrigin(
  actions: Action[],
  batch_id = "acme_followups",
): OriginatedAction[] {
  return actions.map((action) => ({
    ...action,
    origin: { surface: "batch_proposal", batch_id },
  }));
}

export function hasRenderableOrigin(action: Action | OriginatedAction): action is OriginatedAction {
  const origin = (action as Partial<OriginatedAction>).origin;
  if (!origin) return false;
  if (origin.surface === "batch_proposal") return origin.batch_id.length > 0;
  return (
    origin.surface === "decision_readiness" &&
    origin.row_id.length > 0 &&
    origin.remediation_tool.length > 0 &&
    origin.target_object_id.length > 0
  );
}

export function composeStagedRemediationCard(
  reference: StagedRemediationReference,
  validationActions: Action[],
): OriginatedAction {
  const match = validationActions.find((action) => isValidationForReference(action, reference));
  if (!match) {
    return blockedStagedAction(
      reference,
      "validation: no composer output matched the staged readiness remediation",
    );
  }

  return withStagedOrigin(match, reference);
}

export function withStagedOrigin(
  action: Action,
  reference: StagedRemediationReference,
): OriginatedAction {
  return applyRemediationParameters({ ...action, origin: reference.origin }, reference);
}

export function deriveDrawerActions({
  mode,
  staged_remediations,
  stagedValidatedActions = [],
  stagedValidationErrors = {},
  validationActions,
  creditRouted,
  creditSigned,
  legalRouted = false,
  legalSigned = false,
  covenantRequested = false,
  covenantUploaded = false,
}: {
  mode: DrawerActionMode;
  staged_remediations: StagedRemediationReference[];
  stagedValidatedActions?: OriginatedAction[];
  stagedValidationErrors?: Record<string, string>;
  validationActions: Action[];
  creditRouted: boolean;
  creditSigned: boolean;
  legalRouted?: boolean;
  legalSigned?: boolean;
  covenantRequested?: boolean;
  covenantUploaded?: boolean;
}): OriginatedAction[] {
  if (mode === "staged_remediation") {
    const validatedByRow = new Map(
      stagedValidatedActions.map((action) => [action.origin.row_id, action]),
    );
    return staged_remediations
      .map((reference) => {
        const error = stagedValidationErrors[reference.origin.row_id];
        if (error) return blockedStagedAction(reference, `live validation unavailable: ${error}`);
        return (
          validatedByRow.get(reference.origin.row_id) ??
          composeStagedRemediationCard(reference, validationActions)
        );
      })
      .filter(hasRenderableOrigin);
  }

  const batchActions = withBatchOrigin(validationActions);
  const visible = batchActions.filter((action) => {
    if (
      (creditRouted || creditSigned) &&
      action.tool === "route_approval" &&
      action.required_approver === "credit_officer"
    ) {
      return false;
    }
    if (
      (legalRouted || legalSigned) &&
      action.tool === "route_approval" &&
      action.required_approver === "legal"
    ) {
      return false;
    }
    if (
      (covenantRequested || covenantUploaded) &&
      action.tool === "create_task" &&
      action.diff.target_object_id === "task_new_1"
    ) {
      return false;
    }
    return true;
  });
  return visible.filter(hasRenderableOrigin);
}

function isValidationForReference(action: Action, reference: StagedRemediationReference): boolean {
  const { origin } = reference;
  if (action.tool !== origin.remediation_tool) return false;
  if (action.diff.target_object_id !== origin.target_object_id) return false;
  if (!origin.required_approver) return true;
  return action.required_approver === origin.required_approver;
}

function applyRemediationParameters(
  action: OriginatedAction,
  reference: StagedRemediationReference,
): OriginatedAction {
  if (action.tool !== "route_approval") return action;

  const businessLabel = reference.remediation.parameters?.business_label;
  const requestedDiscount = reference.remediation.parameters?.requested_discount_percent;
  const routeNote = reference.remediation.parameters?.route_note;
  const after = {
    ...action.diff.after,
    ...(businessLabel ? { approval_request: businessLabel } : {}),
    ...(typeof requestedDiscount === "number"
      ? { requested_discount: `${requestedDiscount}%` }
      : {}),
  };

  return {
    ...action,
    reason: routeNote ?? action.reason,
    sources: action.sources.length
      ? action.sources
      : reference.source_ids.map((object_id) => ({ object_id })),
    diff: {
      ...action.diff,
      after,
    },
  };
}

function blockedStagedAction(
  reference: StagedRemediationReference,
  blocked_reason: string,
): OriginatedAction {
  return applyRemediationParameters(
    {
      tool: reference.remediation.tool,
      reason: reference.row_details,
      sources: reference.source_ids.map((object_id) => ({ object_id })),
      side_effect: "propose",
      risk: "medium",
      required_approver: reference.origin.required_approver ?? null,
      blocked_reason,
      diff: {
        target_object_id: reference.origin.target_object_id,
        before: {},
        after: {},
      },
      origin: reference.origin,
    },
    reference,
  );
}

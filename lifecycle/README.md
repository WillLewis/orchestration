# lifecycle/ — WS-F (Codex)
Work-product lifecycle & revalidation: SourceDependencyGraph, StaleSectionState,
RevalidationRule, EventTrigger, ChangeImpactMap. Deterministic. DoD: a source-change event
flags the affected pinned section stale and emits a reapproval route; tests green.

## API

- `build_dependency_graph(brief, contract) -> SourceDependencyGraph`
  builds the pinned work-product section map. Approval sections depend on approval/workflow
  objects, factual sections depend on document/financial sources, conflicts depend on their
  conflict sources, missing evidence depends on expected missing object ids, and remaining
  populated sections conservatively depend on all contract source dependencies.
- `LifecycleRevalidationEngine.revalidate(contract, changed_object_id) -> list[StaleSectionState]`
  implements `core.pipeline.RevalidationEngine`.
- `on_source_change(contract, graph, changed_object_id, source_objects=None) -> RevalidationResult`
  returns stale section states plus reapproval routes and a change-impact map for `/revalidate`.
- `revalidate_changed_source(contracts, graphs, changed_object_id, source_objects=None)`
  finds every pinned work product whose graph depends on the changed object and revalidates each.

## Where this fits

WS-F is the deterministic pinned work-product revalidation engine. It answers: "A governed record
was sealed against these source dependencies; this source changed; which sections are stale and
which reapproval routes are needed?"

The active Acme meeting walkthrough uses a different live projection path: API-local lifecycle
events are appended, `/api/lifecycle` derives the current state, and `/api/brief` recomputes the
Decision Brief. That active meeting loop does not call `/revalidate`.

Use `/revalidate` for sealed/pinned record freshness and source-change checks. Use the lifecycle
event path for the live meeting/readiness walkthrough.

## Deterministic rules

- `approval_source_changed`: workflow/approval source changes mark dependent approval sections
  stale. If the source moved to a non-approved state such as `Needs Review`, WS-F emits a
  `ReapprovalRoute` to the relevant approver role.
- `data_source_changed`: document/financial source changes mark dependent factual sections stale
  for rerun and do not emit reapproval routes.
- `version_bump`: a changed source with an increased version marks dependent sections stale with
  a reason naming the new version.

## Change event flow

1. A brief is pinned as a `WorkProductContract`.
2. WS-F builds and stores a `SourceDependencyGraph` for that contract.
3. WS-A emits a deterministic event such as `legal_needs_review` or `financials_v2`.
4. Integration calls `/revalidate` with the changed object id for pinned governed records.
5. WS-F returns stale sections, reapproval routes, and affected work-product ids.

For the Acme stale-alert demo, `wf_approval` moving Legal to `Needs Review` marks
`policy_gates` and `required_approvals` stale and routes reapproval to `legal`. A
`doc_financials` version bump marks `what_changed` and `key_facts` stale without routing.

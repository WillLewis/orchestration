# ConnectAgent Flow Audit

Audit date: 2026-06-27

Destination: local folder

Folder: `/Users/WL/Documents/Documents - William’s MacBook Pro (4)/GitHub/box/product-design-audit/connectagent-flow`

Capture method: Codex in-app Browser at desktop viewport. The app was run in mock mode through the local Vite dev server. The presenter walkthrough was captured through a local static HTTP server because direct `file://` access was blocked by the browser policy.

## Scope

This audit reviews the panel demo flow for ConnectWork ConnectAgent:

1. Meeting entry and agent prompt
2. Gate-held refusal
3. Routing and revalidation
4. Decision Packet readiness
5. Agent Actions drawer
6. Agent Batch loop
7. Governed Work Product record and stale revalidation
8. Agent Ops scorecard and failure trace
9. Presenter cockpit / demo walkthrough page

The review is evidence-based from the screenshots in this folder. It does not claim full accessibility compliance because keyboard, screen reader, reduced-motion, target-size, and automated contrast tests were not run.

## Step Findings

### 1. Meeting agent entry

Screenshot: `01-meeting-agent-entry.png`

Health: Healthy

What works:
- The surface establishes the meeting as the live work context, not a detached assistant.
- The right rail exposes ConnectAgent as a controlled actor with suggested prompts and a clear `Generate Decision Brief` entry point.
- The memo, participant strip, and deal context support the panel story: the agent has context but still needs governed action.

Risks:
- The primary demo starts with a typed unsafe action, while the UI visually promotes `Generate Decision Brief`. The stage script needs to explicitly direct the candidate to type the discount request.
- Starter prompts compete for attention with the key refusal moment.
- The input and chips look compact; target size should be checked against 44px guidance.

### 2. Gate-held refusal

Screenshot: `02-agent-refusal-gate-held.png`

Health: Healthy, strong demo beat

What works:
- The refusal is clear and plain-spoken: the agent will not apply the 22% discount.
- `Gate held` is visible and paired with citations, making the refusal feel governed rather than arbitrary.
- The offered next actions create useful forward motion: explain, route, or use max.

Risks:
- This is the first major proof point. It should be scripted as the cold open because it immediately differentiates the product from a summarizer.
- The action buttons are small and close together. Keyboard focus order and visible focus styles should be tested.

### 3. Route and revalidate

Screenshot: `03-route-revalidate-still-not-ready.png`

Health: Healthy, high-value trust proof

What works:
- Routing to the Credit Officer proves the agent can orchestrate work across owners.
- The best credibility moment is the revalidation result: even after a sign-off, the deal is still not approval-ready.
- This avoids the common AI demo trap of treating one approval as enough.

Risks:
- The elapsed timer state is useful but visually subtle. If the panel misses it, narrate that the route happened and the gate recalculated.
- The next action points to the CS plan edit, but the dependency chain could be made more scannable in the live surface.

### 4. Decision Packet readiness

Screenshot: `04-decision-packet-readiness.png`

Health: Healthy but dense

What works:
- `Approval-ready: No` is visible and the path to ready is explicit.
- The page makes the packet feel like a governed work product, not just a generated document.
- The source rail supports auditability.

Risks:
- The screen is information-dense and panelists may not know where to look first.
- The readiness reason should stay visually dominant as the page scrolls, or be repeated near the actions that depend on it.
- The current layout is good for inspection, but the live demo should spend very little time here unless the speaker calls out one concrete dependency.

### 5. Agent Actions drawer

Screenshots:
- `05-agent-actions-drawer-proposed-blocked.png`
- `05b-agent-actions-drawer-fullpage.png`
- `05c-agent-actions-drawer-blocked-scrolled.png`
- `05d-agent-actions-override-staged.png`

Health: Mixed

What works:
- The drawer proves the product can propose concrete downstream actions while separating ready, routing, and blocked work.
- The blocked section is strong: missing covenant tracker and information barrier / mosaic rules are product-specific and credible.
- The override-staged state is useful as a demo artifact because it shows that human pressure can still be refused by the gate.

Risks:
- The blocked proof sits below the fold; a panelist may only see the ready actions unless the presenter scrolls.
- `Approve anyway (override)` is easy to misread as a real bypass. If the gate will refuse it, the label should make that clearer, especially in demo mode.
- In the captured override state, the toast overlaps the sticky footer area and interfered with completing the send click during automation. That is a polish and operability risk.
- The sticky footer says `Send all (3)` while blocked work is also visible below; the product should make it impossible to misread which actions will run.

### 6. Agent Batch loop

Screenshots:
- `06-agent-batch-pre-run.png`
- `07-agent-batch-ran-open-items.png`
- `08-agent-batch-escalations-status.png`

Health: Healthy, strongest orchestration proof

What works:
- The pre-run screen clearly groups 4 runnable actions and 2 blocked actions.
- After run, the counters make the outcome legible: assignments, replies, escalations, scheduled items, sent items.
- The result remains honest: the cycle ran, but open items remain.
- The lower audit trail and blocked cards support the claim that the system tracks closure, not just output.

Risks:
- The strongest status language appears lower on the page. Bring `Ran - open items` and the unresolved count into the top visible summary.
- The pre-run grouping is good, but blocked explanations should stay visible after run without requiring a long scroll.

### 7. Governed record and stale revalidation

Screenshots:
- `09-governed-record-initial.png`
- `10-governed-record-stale-verified-top.png`
- `10-governed-record-stale-verified.png`
- `10c-governed-record-stale-trust-axes.png`

Health: Mixed

What works:
- The initial record makes the trust axes explicit: integrity, freshness, and approval.
- The dependency map communicates that the product is tracking why a work product is or is not ready.
- The stale verification proof is important: a changed approval source forces reapproval rather than silently keeping old confidence.

Risks:
- The verification controls and resulting stale sections sit deep in a long page. The product should auto-scroll to the updated result or pin the trust-axis summary.
- The global `Freshness: Stale` top state was verified in the DOM, but the visual captures landed on the lower stale sections because of the long page scroll behavior. For the panel, make the stale result unavoidable on screen after pressing verify.
- The proof is conceptually strong but could feel academic if the speaker lingers. Tie it directly to "we know when yesterday's safe answer is unsafe today."

### 8. Agent Ops scorecard and failure trace

Screenshots:
- `11-agent-ops-scorecard.png`
- `12-agent-ops-eval-failure-row.png`
- `12-agent-ops-failure-trace-expanded.png`

Health: Healthy

What works:
- The scorecard gives the panel a platform-level proof of quality, not just a single scripted path.
- The failure row is valuable because it shows the system knows where it fails.
- The expanded trace shows typed signals without raw content, which supports the privacy and telemetry story.

Risks:
- The top scorecards can read too green until the failure row is shown. In the demo, jump to the failed eval quickly.
- The trace expansion should be keyboard reachable and screen-reader coherent; this cannot be proven from screenshots alone.

### 9. Presenter cockpit

Screenshot: `13-presenter-cockpit-thesis-plan.png`

Health: Mixed

What works:
- The thesis is clear: move from describing conversations to closing the loop.
- The page contains a usable run-of-show and connects product, engineering, and design evaluation.
- It helps the presenter keep the story grounded in the panel rubric.

Risks:
- The page is dense. Use it as a private cockpit, not as a panel-facing leave-behind without editing.
- Internal evaluative language such as `"rock star" bar` and `"Matt flip"` should not appear in anything shared with the panel.
- The first viewport has many concepts competing at once. If this becomes a leave-behind, split it into a concise panel narrative and a private speaker script.

## Overall Assessment

The flow has a strong product thesis and a credible trust spine:

meeting context -> refusal gate -> routed revalidation -> governed packet -> proposed/blocked actions -> batch execution -> stale record detection -> ops eval trace.

The demo is strongest when it proves restraint. The top moments are:

1. The agent refuses the unsafe discount.
2. Routing gets one sign-off, but the gate still says not approval-ready.
3. The batch runs only safe work and leaves unresolved items visible.
4. A previously valid record becomes stale when source evidence changes.
5. Ops shows a failed eval trace without exposing raw content.

The main design risk is not the idea. It is visibility. Several of the best proof points sit below the fold, inside drawers, or after dense supporting content. For a 30-minute panel, the experience should make the proof state obvious in the first viewport after each action.

## Accessibility Risks From Screenshot Review

- Several chips, icon buttons, and compact controls may be below comfortable touch target size. Measure targets, especially in the right rail, drawer tabs, and action cards.
- Status uses color plus labels in many places, which is good, but contrast still needs measurement for yellow, green, and red chips.
- The action drawer contains important content below the fold and has a sticky footer. Test keyboard scroll, focus trap, escape behavior, and whether screen reader users understand which actions are blocked.
- Toast placement can obscure footer actions. Toasts should not cover primary controls and should be announced politely.
- Long record pages need skip links, section landmarks, or a sticky trust-axis summary so keyboard users do not have to traverse provenance before finding verification results.
- Expandable eval traces need clear focus, aria-expanded state, and a readable order between summary row and details.

## Recommendations Before The Panel

1. Add a demo script rail or presenter-only checklist that marks the next action and expected proof state.
2. Make the first refusal prompt explicit in the demo flow so the panel does not follow the `Generate Decision Brief` button first.
3. Move blocked-action counts and explanations to the top of the Agent Actions drawer.
4. Rename or qualify `Approve anyway (override)` so it cannot be read as a genuine gate bypass.
5. Fix toast/footer overlap in the Agent Actions drawer before presenting that state live.
6. On the Batch page, show `Ran - open items` and the unresolved count in the top summary after execution.
7. On the Governed Work Product record, pin or auto-scroll to the changed trust-axis result after verification.
8. Split `demo-walkthrough.html` into a private cockpit and a cleaner panel-facing leave-behind if it will be shared.
9. Run a quick keyboard/focus/contrast pass on the drawer, batch run, record verification, and failure trace.

## Evidence Limits

- Screenshots were captured at a desktop viewport only. Mobile and narrow responsive states were not audited.
- The main product flow ran in mock mode, not against a live backend.
- Keyboard, screen reader, contrast, reduced-motion, and target-size checks were not run.
- The Agent Actions override send could not be fully completed in browser automation because the toast/sticky footer geometry interfered with the click. The Batch page separately demonstrates that blocked items remain blocked during execution.
- The governed record's global stale top-state was verified through DOM inspection, but the saved visual evidence primarily captures the section-level stale result because the page scroll position shifted during verification.

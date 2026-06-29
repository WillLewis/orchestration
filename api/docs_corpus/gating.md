---
id: gating
title: "Deterministic Gating"
route: /developers/gating
in_nav: true
viewer_permitted: true
title_visibility: reveal
owner: "Docs"
request_access_to: "docs@connectwork.example"
body: |
  ConnectWork's policy gate makes approval readiness a deterministic engine decision, not a model preference. The product term is Policy Artifact; the internal RulePack is only the locked verifier schema / compiled rule subset. In Acme, the gate keeps approval-ready false until Credit Officer approval, Legal approval, the final covenant tracker, and CS-plan reconciliation all clear. The Decision Brief is the typed readiness and stage surface; Agent Actions is the execution surface, and staged remediations must derive from the readiness row. Active meeting recompute is lifecycle-event-derived through `/api/brief`; `/revalidate` is for sealed governed record/source-change verification.
---

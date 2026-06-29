---
id: employee-directory
title: "ConnectWork Employee Directory"
route: null
in_nav: false
viewer_permitted: false
title_visibility: reveal
owner: "People"
request_access_to: "people@connectwork.example"
body: |
  Restricted synthetic People Operations directory.

  This fixture represents the kind of employee directory data an enterprise tenant would protect: names, reporting lines, locations, role metadata, and operational contact details. It exists only to test permission-aware retrieval, including the difference between "found but locked" and "no result." Viewers without People access may receive an access affordance, but no directory content should enter prompts, summaries, or answers.
---

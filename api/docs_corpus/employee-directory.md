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
  Restricted People Operations directory.

  The internal directory contains employee names, reporting lines, locations, role metadata, and sensitive operational contact details. It is indexed as a real restricted document so the docs gate can distinguish "found but locked" from "no result." Viewers without People access may receive an access affordance, but no directory content should be shown.
---

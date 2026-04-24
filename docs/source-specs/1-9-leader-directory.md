---
module: 1-9
template: leader-directory
title: Leader Directory
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '66'
fields:
  - key: title-role
    label: Title/Role
    type: text
  - key: name
    label: Name
    type: text
  - key: phone
    label: Phone
    type: tel
  - key: email
    label: Email
    type: email
  - key: local-emergency-plan
    label: Link to local emergency plan
    type: url
notes: |
  Wired on src/pages/modules/emergency-preparedness/1-9.astro. The four table
  columns (Title/Role, Name, Phone, Email) drive the Leader Directory DataTable;
  "Link to local emergency plan" drives the accompanying PlanForm. The PDF's
  town-name blank ("Directory of local leaders for emergency management
  coordination in ____") is captured by the page-level section heading; because
  the PDF has no explicit "Town" label, no Town spec field is cited here —
  adding one would violate the Source Fidelity invariant (spec labels must
  trace to concrete text in the cited PDF page).
---

## Extracted text (first 2000 chars, for review only)

```
Directory of local leaders for emergency management coordination in ____________________________________
Link to local emergency plan:
TITLE/ROLE                                  NAME                          PHONE                            EMAIL
State Senator(s)
State Representative(s)
Regional planning commission staff
Long Term Recovery Group
Fire chief
Road crew
Emergency Management Director
Town clerk
Selectboard members
Mutual aid/neighbor-to-neighbor leader(s)
Flood Survivor(s)
Community point people
School principal
General store owner

```

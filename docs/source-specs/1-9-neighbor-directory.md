---
module: 1-9
template: neighbor-directory
title: Neighbor Directory
tableId: neighbor-directory
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '62-64'
fields:
  - key: name
    label: Name
    type: text
  - key: phone
    label: Phone
    type: tel
  - key: email
    label: Email
    type: email
  - key: address
    label: Address
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Before disaster
  - text: Directory of Local Leaders
  - text: Emergency/First Responder Directory
  - text: During disaster
  - text: Planning for other kinds of climate disaster
notes: |
  Wired on src/pages/modules/emergency-preparedness/1-9.astro. The four
  columns (Name, Phone, Email, Address) drive the Neighbor Directory
  DataTable, mapping one-to-one to the workbook page-64 template header
  row "NAME PHONE EMAIL ADDRESS". The page-level site h3 "Neighbor
  Directory" matches the workbook template heading "Neighbor directory
  for: ____" (modulo title-case).

  Cited as a Step-1a PROMOTE-to-spec outcome from the day-12 audit
  (plan §Section 2 line 110: "audit(1-9): resolve uncited Neighbor +
  First Responder Directory tables"). The DataTable shipped in PR #13
  without a source spec — the inventory walk catalog flagged it as
  `datatable_source_needs_spec` with `decision:
  1a_create_source_spec_cite_this_url` (workbook anchor "Create a
  directory of neighbors", Drive ID 1volnFb9p7K2…, points at the
  Neighbor template that is also the master-PDF page 64). Promoting
  the table to its own spec is the correct outcome — the columns are
  workbook-faithful, no inventions; the spec just needed to be authored.

  Citation page range '62-64' covers both Section 1.9 prose
  (master-PDF pages 62-63) and the Neighbor template (page 64). Same
  range rationale as the Leader and First Responder specs — the
  directory concept is introduced in prose, the form structure is
  defined in the template appendix, and both belong to the spec's
  authored scope. Grounding proseMatches against the prose pages
  prevents the file's prose body from falsely drifting on this spec
  in the multi-citation-per-file shape that 1-9.astro exhibits.

  subheadings[] covers the 5 OTHER h3s on 1-9.astro (Before disaster,
  Directory of Local Leaders, Emergency/First Responder Directory,
  During disaster, Planning for other kinds of climate disaster) so
  titleMatches passes for this spec when the runner iterates each
  h1/h2/h3 in the file.
---

## Extracted text (first 2000 chars, for review only)

```
1.9 Community emergency response plans
Folder with resources and templates: 1.9 Community emergency response plans

Before disaster
- Create a directory of neighbors with street addresses, landline
  contacts, etc. The 911 EMS agency that covers any given town should
  have a list of local first-responders.

[Section 1.9 prose continues across pages 62-63 of the master PDF;
see docs/toolkit-inventory.yaml entry "1-9" for the full anchor
catalog. Template appendix page 64 contains the Neighbor Directory
template.]

Page 64 — Neighbor directory for: ____________________
NAME    PHONE    EMAIL    ADDRESS
```

---
module: 1-9
template: first-responder-directory
title: Emergency/First Responder Directory
tableId: first-responder-directory
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '62-65'
fields:
  - key: emergency-service-name-person
    label: Emergency Service Name/Person
    type: text
  - key: function-skill
    label: Function/Skill
    type: text
  - key: town-area-of-coverage
    label: Town/Area of coverage
    type: text
  - key: contact
    label: Contact
    type: text
  - key: notes
    label: Notes
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Before disaster
  - text: Directory of Local Leaders
  - text: Neighbor Directory
  - text: During disaster
  - text: Planning for other kinds of climate disaster
notes: |
  Wired on src/pages/modules/emergency-preparedness/1-9.astro. The five
  columns (Emergency Service Name/Person, Function/Skill, Town/Area of
  coverage, Contact, Notes) drive the Emergency/First Responder Directory
  DataTable, mapping one-to-one to the workbook page-65 template header
  row "Emergency Service Name/Person | Function/Skill | Town/Area of
  coverage | Contact | Notes". The page-level site h3 "Emergency/First
  Responder Directory" matches the workbook template heading
  "Emergency/First Responder Directory   Town name:" verbatim modulo
  the trailing "Town name:" which is captured by the page-level h3
  rather than as a separate spec field (same pattern as the Leader
  spec's town-name blank).

  Cited as a Step-1a PROMOTE-to-spec outcome from the day-12 audit
  (plan §Section 2 line 110). The DataTable shipped in PR #13 without
  a source spec; the inventory walk flagged it as
  `datatable_source_needs_spec` with `decision:
  1a_create_source_spec_cite_this_url` (workbook anchor "Create a
  directory of local first responders", Drive ID 1_s3dzOMkIUT5…,
  points at the First Responder template that is also master-PDF page
  65). Columns are workbook-faithful one-to-one — no inventions; the
  spec just needed to be authored. Promoting also resolved the day-11
  verify report's 5 key_drifts attributed to the Leader spec, because
  this DataTable's 5 columns were being false-positive matched
  against the Leader spec's then-5 fields (Title/Role / Name / Phone
  / Email / Link to local emergency plan) on column-count alone.

  Citation page range '62-65' covers both Section 1.9 prose
  (master-PDF pages 62-63) and the First Responder template (page
  65). Same range rationale as the Leader and Neighbor specs.

  subheadings[] covers the 5 OTHER h3s on 1-9.astro (Before disaster,
  Directory of Local Leaders, Neighbor Directory, During disaster,
  Planning for other kinds of climate disaster) so titleMatches
  passes for this spec on a multi-citation file.

  All 5 columns use type: text in both the spec and the wired
  DataTable. Future enhancement: Notes could be type: textarea for
  multi-line entry, but that is a UX change distinct from source
  fidelity and is not in scope for day-12.
---

## Extracted text (first 2000 chars, for review only)

```
1.9 Community emergency response plans
Folder with resources and templates: 1.9 Community emergency response plans

Before disaster
- Create a directory of local first responders, paid and volunteer.
  The 911 EMS agency that covers any given town should have a list of
  local first-responders. In the event that the ambulance comes from
  several towns away, there may be local first-responders, including
  the fire department, who are linked in with the EMS agency
  responsible for covering your town more immediately.

[Section 1.9 prose continues across pages 62-63 of the master PDF;
see docs/toolkit-inventory.yaml entry "1-9" for the full anchor
catalog. Template appendix page 65 contains the Emergency/First
Responder Directory template.]

Page 65 — Emergency/First Responder Directory   Town name: __________
Emergency Service Name/Person | Function/Skill | Town/Area of coverage | Contact | Notes
```

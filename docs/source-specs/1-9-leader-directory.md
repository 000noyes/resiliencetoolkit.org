---
module: 1-9
template: leader-directory
title: Directory of Local Leaders
tableId: leader-directory
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '62-66'
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
matching:
  require_cluster: false
subheadings:
  - text: Before disaster
  - text: Neighbor Directory
  - text: Emergency/First Responder Directory
  - text: During disaster
  - text: Planning for other kinds of climate disaster
notes: |
  Wired on src/pages/modules/emergency-preparedness/1-9.astro. The four
  table columns (Title/Role, Name, Phone, Email) drive the Leader Directory
  DataTable; the workbook page-66 template heading "Directory of local
  leaders for emergency management coordination in ____" is captured by
  the page-level site h3 "Directory of Local Leaders" (workbook orthography
  verbatim modulo title-case for the headline noun phrase).

  Day-12 (2026-04-27) audit-driven changes:
  - Renamed title from "Leader Directory" → "Directory of Local Leaders"
    to match the workbook page-66 heading and the site's h3 (was a
    title_drift on the day-11 verify report).
  - Removed the "Link to local emergency plan" PlanForm field. Day-11
    carried it as a 5th field in anticipation of day-13 PlanForm wiring;
    with First Responder Directory's 5-column DataTable now cited under
    its own spec, the orphaned 5th field caused keysMatch to false-
    positive against First Responder (the only 5-column table on
    1-9.astro) and emit 5 spurious key_drifts. Source Fidelity
    invariant: every spec field must trace to a wired component;
    deferring re-introduction to day-13 PlanForm wiring.
  - Expanded citation page from '66' → '62-66' to cover both Section
    1.9 prose (master-PDF pages 62-63) and the Leader template (page
    66). The 1.9 prose body underlies all three directory specs —
    each cites a range starting at page 62, which is workbook-faithful
    (the directory concept is introduced in prose, the form is defined
    in the template appendix; both belong to the spec's authored
    scope) and grounds proseMatches against the section prose so the
    file's prose body does not falsely drift on every directory spec.
  - Added subheadings[] covering the 5 OTHER h3s on 1-9.astro so
    titleMatches passes for this spec on a multi-citation file.

  Per-page content_hashes registry: page '62-66' added; the previous
  '66' entry is now orphaned (no spec cites it) and may be pruned in
  a future commit. Other modules' hashes (35-36, 42, 45) are
  untouched.

  No structural_fidelity assertion: 1-9.astro renders 3 DataTables;
  Leader / Neighbor / First Responder each cite their own spec one-
  to-one, so per-spec keysMatch + titleMatches already enforce the
  one-table-one-spec invariant without a global table_count check
  (which would conflict across the three specs).
---

## Extracted text (first 2000 chars, for review only)

```
1.9 Community emergency response plans
Folder with resources and templates: 1.9 Community emergency response plans

Before disaster
- Identify if there are already local documents outlining the emergency
  response plan for your town and town's leaders during an emergency:
  - Emergency Management Director (EMD)
  - Fire Department
  - First Responders/EMS
  - Town Clerk/Administrator/Manager, Select Board Members
  - Town Road Crew
  - Mutual Aid and/or Neighbor-to-Neighbor Network leader(s)

[Section 1.9 prose continues across pages 62-63 of the master PDF; see
docs/toolkit-inventory.yaml entry "1-9" for the full anchor catalog.
Template appendix pages 64-66 contain the three directory templates.]

Page 64 — Neighbor directory for: ____________________
NAME    PHONE    EMAIL    ADDRESS

Page 65 — Emergency/First Responder Directory   Town name: __________
Emergency Service Name/Person | Function/Skill | Town/Area of coverage | Contact | Notes

Page 66 — Directory of local leaders for emergency management coordination in ______
Link to local emergency plan: ____________________
TITLE/ROLE | NAME | PHONE | EMAIL
- State Senator(s)
- State Representative(s)
- Regional planning commission staff
- Long Term Recovery Group
- Fire chief
- Road crew
- Emergency Management Director
- Town clerk
- Selectboard members
- Mutual aid/neighbor-to-neighbor leader(s)
- Flood Survivor(s)
- Community point people
- School principal
- General store owner
```

---
module: 0-1
template: community-roles
title: Who is in your community/place?
tableId: community-roles
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '10-11'
fields:
  - key: role
    label: Role
    type: text
  - key: name-s
    label: Name(s)
    type: text
matching:
  require_cluster: false
prose_scope:
  start_line: 71
  end_line: 96
subheadings:
  - text: 'Organizing your community: who is here and what are they doing?'
  - text: Mapping your community
  - text: What other dynamics are present in your place?
  - text: Stuff and systems in your community
  - text: Knowing your ecosystem
  - text: Bringing people together
  - text: Facilitation guides
  - text: 'Get to know the toolkit: interactive activity'
  - text: Conduct a Community Needs Assessment
  - text: 'We started organizing. How do we know it’s working, and when to ask for more help?'
  - text: 'Going deeper: finding the community work you want to do'
  - text: Pod mapping
  - text: Pods and Pod Mapping Worksheet
  - text: POD
notes: |
  Day-18 KYC half-2 spec — covers the Who is in your community/place?
  DataTable (tableId: community-roles) on
  src/pages/modules/knowing-your-community.astro lines 70-94.

  Of the 6 KYC DataTables, this is the only one whose workbook source
  has explicit column headers. Workbook p10 ("Role | Name(s)") matches
  the site DataTable columns verbatim, so this spec follows the 1-9
  pattern: tableId is set, fields[] are the 2 column labels, keysMatch
  enforces the column-name firewall.

  Citation page range '10-11' covers the Roles table which spans p10
  (top section) and p11 (footnote with legislators link). The 12 row
  prompts (Long Term Recovery Group, Fire chief, Road crew, Emergency
  Management Director, Town clerk, Selectboard members, Mutual aid
  leaders, Leaders/vocal people, School principal, General store owner,
  State Senator*, State Representative(s)*) all appear verbatim on
  workbook pages 10-11 — they are the table's row contents and live
  inside DataTable initialRows[] (not in <p>/<li> tags), so
  proseMatches doesn't enforce them. The fields[] spec covers the
  COLUMN labels only; row content fidelity is enforced by the inventory
  audit trail rather than verify schema.

  matching.require_cluster: false — page range '10-11' covers the Roles
  table heading on p10 plus the legislators-footnote tail on p11. The
  cluster heuristic's 50-line cap could miss "Role" + "Name(s)" if the
  page-2 footnote pushes them past the cap; the per-spec opt-out is the
  documented surgical fix (decision k).

  Day-18 invented_table_titles_pattern resolution: the DataTable's
  tableName prop was renamed from "Community Roles" (site-invented)
  to "Who is in your community/place?" (workbook-verbatim). The h3
  above was NOT removed (see place-characteristics spec notes for the
  full rationale on why the heading slot can't be consumed by the
  DataTable journal variant in verify's source-only inspection).

  prose_scope narrows proseMatches to the DataTable's JSX line range
  (lines 70-94, no <p>/<li> inside). The legislators footnote <p> at
  line 96 sits OUTSIDE the prose_scope window so the day-17 spec
  (file-global) catches it.

  subheadings[] enumerates the 14 OTHER headings in the file.
---

## Extracted text (first 2000 chars, for review only)

```
​Who is in your community/place?​
​Role​                                    ​Name(s)​
​Long Term Recovery Group (LTRG)​
​Fire chief​
​Road crew​
​Emergency Management Director​
​Town clerk​
​Selectboard members​
​Mutual aid/neighbor to neighbor network leaders​
​Leaders/vocal people in your community​
​School principal​
​General store owner​
​State Senator*​
​State Representative(s)*​
​*Find your legislators at​​legislature.vermont.gov/people/​​.​

[full extraction in docs/source-specs/_extraction-cache.yaml under
content_hash key for page 10-11.]
```

---
module: 0-1
template: ecosystem
title: Knowing your ecosystem
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '12'
fields:
  - key: section-anchor
    label: 'Knowing your ecosystem'
    type: text
matching:
  require_cluster: false
prose_scope:
  start_line: 165
  end_line: 181
subheadings:
  - text: 'Organizing your community: who is here and what are they doing?'
  - text: Mapping your community
  - text: Who is in your community/place?
  - text: What other dynamics are present in your place?
  - text: Stuff and systems in your community
  - text: Bringing people together
  - text: Facilitation guides
  - text: 'Get to know the toolkit: interactive activity'
  - text: Conduct a Community Needs Assessment
  - text: 'We started organizing. How do we know it’s working, and when to ask for more help?'
  - text: 'Going deeper: finding the community work you want to do'
  - text: Pod mapping
  - text: Pods and Pod Mapping Worksheet
  - text: POD
  - text: BATJC Pod Mapping Worksheet
notes: |
  Day-18 KYC half-2 spec — covers the Knowing your ecosystem DataTable
  (tableId: ecosystem) on src/pages/modules/knowing-your-community.astro
  lines 161-176.

  fields[] uses a single placeholder anchor (label = section heading)
  for the same reason as place-characteristics: workbook page 12 has
  no explicit column headers and pdftotext drop-cap fragmentation
  lowers per-prompt bestMatchScore. tableId is OMITTED to keep
  keysMatch silent on column-count mismatch.

  Day-18 invented_table_titles_pattern resolution: the DataTable's
  tableName prop was renamed from "Knowing Your Ecosystem" (site-
  capitalized) to "Knowing your ecosystem" (workbook-verbatim). The h2
  above was NOT removed despite the inventory's
  `_and_remove_h3_above` clause (the section uses h2 not h3 here);
  removing the h2 would also remove the section header for the
  preceding ANR atlas prose paragraph and bullets. See
  place-characteristics spec for the full design rationale on why the
  heading slot can't be consumed by the DataTable journal variant in
  verify's source-only inspection.

  prose_scope narrows proseMatches to the DataTable's JSX line range
  (no <p>/<li> inside, proseMatches no-ops). The ANR atlas paragraph
  (line 153) and 3 layer bullets (lines 156-158) sit OUTSIDE this
  prose_scope window so the day-17 spec (file-global) catches them.

  subheadings[] enumerates the 14 OTHER headings in the file.
---

## Extracted text (first 2000 chars, for review only)

```
​Knowing your ecosystem​
​Check out the ANR atlas: https://anrmaps.vermont.gov/websites/anra5/​
​What rivers and streams run through your place?​
​Where does it get wet first?​
​What else do you know about the ecosystem in your place?​

[full extraction in docs/source-specs/_extraction-cache.yaml under
content_hash key for page 12.]
```

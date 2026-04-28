---
module: 0-1
template: community-dynamics
title: What other dynamics are present in your place?
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '11'
fields:
  - key: section-anchor
    label: 'What other dynamics are present in your place?'
    type: text
matching:
  require_cluster: false
prose_scope:
  start_line: 104
  end_line: 125
subheadings:
  - text: 'Organizing your community: who is here and what are they doing?'
  - text: Mapping your community
  - text: Who is in your community/place?
  - text: Stuff and systems in your community
  - text: Knowing your ecosystem
  - text: Bringing people together
  - text: Facilitation guides
  - text: 'Get to know the toolkit: interactive activity'
  - text: Conduct a Community Needs Assessment
  - text: 'We started organizing. How do we know it''s working, and when to ask for more help?'
  - text: 'Going deeper: finding the community work you want to do'
  - text: Pod mapping
  - text: Pods and Pod Mapping Worksheet
  - text: POD
notes: |
  Day-18 KYC half-2 spec — covers the What other dynamics are present
  in your place? DataTable (tableId: community-dynamics) on
  src/pages/modules/knowing-your-community.astro lines 102-122.

  fields[] uses a single placeholder anchor (label = section heading)
  for the same reason as place-characteristics: workbook page 11 has
  no explicit column headers and pdftotext drop-cap fragmentation
  lowers per-prompt bestMatchScore. matching.require_cluster: false
  applies for the same reason. tableId is OMITTED to keep keysMatch
  silent on column-count mismatch.

  Day-18 invented_table_titles_pattern resolution: the DataTable's
  tableName prop was renamed from "Community Dynamics" (site-invented)
  to "What other dynamics are present in your place?" (workbook-
  verbatim). The h3 above was NOT removed (see place-characteristics
  spec for rationale).

  prose_scope narrows proseMatches to the DataTable's JSX line range
  (no <p>/<li> inside, proseMatches no-ops).

  subheadings[] enumerates the 14 OTHER headings in the file.
---

## Extracted text (first 2000 chars, for review only)

```
​What other dynamics are present in your place?​
​Who do people listen to?​
​Which voices are loudest?​
​Who is always showing up to help?​
​Who has been in your place the longest?​
​Who is the newest in your place?​
​Who is struggling the most?​
​Who is benefiting from how your place is right now?​
​Who in your community might have different needs than most other people? What are those needs?​

[full extraction in docs/source-specs/_extraction-cache.yaml under
content_hash key for page 11.]
```

---
module: 0-1
template: systems
title: Stuff and systems in your community
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '11-12'
fields:
  - key: section-anchor
    label: 'Stuff and systems in your community'
    type: text
matching:
  require_cluster: false
prose_scope:
  start_line: 131
  end_line: 151
subheadings:
  - text: 'Organizing your community: who is here and what are they doing?'
  - text: Mapping your community
  - text: Who is in your community/place?
  - text: What other dynamics are present in your place?
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
  Day-18 KYC half-2 spec — covers the Stuff and systems in your
  community DataTable (tableId: systems) on
  src/pages/modules/knowing-your-community.astro lines 128-147.

  fields[] uses a single placeholder anchor (label = section heading)
  for the same reason as place-characteristics: workbook pages 11-12
  have no explicit column headers and pdftotext drop-cap fragmentation
  lowers per-prompt bestMatchScore. tableId is OMITTED to keep
  keysMatch silent on column-count mismatch.

  Citation page range '11-12' covers the Stuff and systems table that
  starts mid-p11 and continues to p12. matching.require_cluster: false
  applies the documented per-spec opt-out (decision k) — page-range
  citations crossing the workbook page boundary push later prompts
  past the cluster-heuristic 50-line cap.

  Day-18 invented_table_titles_pattern resolution: the DataTable's
  tableName prop was renamed from "Stuff and Systems" (site-invented
  capitalization) to "Stuff and systems in your community" (workbook-
  verbatim). The h3 above was NOT removed (see place-characteristics
  spec for rationale).

  prose_scope narrows proseMatches to the DataTable's JSX line range.

  subheadings[] enumerates the 14 OTHER headings in the file.
---

## Extracted text (first 2000 chars, for review only)

```
​Stuff and systems in your community​
​What emergency supplies are stored in your place, and where?​
​What infrastructure is important to your place? Is it maintained?​
​Are there places to gather? What places do people go to most often?​
​Which systems in your place work well? Which work poorly?​
​What/who are the active community groups, organizations, and town committees?​
​How do people receive and share information (local news, social media, gathering places)?​
​What essential services are available, and which are missing?​

[full extraction in docs/source-specs/_extraction-cache.yaml under
content_hash key for page 11-12.]
```

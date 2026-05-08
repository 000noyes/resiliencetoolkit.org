---
module: 0-1
template: going-deeper
title: 'Going deeper: finding the community work you want to do'
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '16'
fields:
  - key: section-anchor
    label: 'Going deeper: finding the community work you want to do'
    type: text
matching:
  require_cluster: false
prose_scope:
  start_line: 344
  end_line: 363
subheadings:
  - text: 'Organizing your community: who is here and what are they doing?'
  - text: Mapping your community
  - text: Who is in your community/place?
  - text: What other dynamics are present in your place?
  - text: Stuff and systems in your community
  - text: Knowing your ecosystem
  - text: Bringing people together
  - text: Facilitation guides
  - text: 'Get to know the toolkit: interactive activity'
  - text: Conduct a Community Needs Assessment
  - text: 'We started organizing. How do we know it’s working, and when to ask for more help?'
  - text: Pod mapping
  - text: Pods and Pod Mapping Worksheet
  - text: POD
notes: |
  Day-18 KYC half-2 spec — covers the Going deeper DataTable (tableId:
  going-deeper) on src/pages/modules/knowing-your-community.astro lines
  339-357.

  fields[] uses a single placeholder anchor (label = section heading)
  for the same reason as place-characteristics: workbook page 16 has
  no explicit column headers and pdftotext drop-cap fragmentation
  lowers per-prompt bestMatchScore. tableId is OMITTED to keep
  keysMatch silent on column-count mismatch.

  Day-18 invented_table_titles_pattern resolution: the DataTable's
  tableName prop was renamed from "Going Deeper" (site-truncated and
  capitalized) to "Going deeper: finding the community work you want
  to do" (workbook-verbatim). The h2 above was NOT removed despite the
  inventory's `_and_remove_h3_above` clause (the section uses h2 not
  h3 here); removing the h2 would also remove the section header for
  the preceding "There are so many ways to support…" intro paragraph
  AND for the entire roles-to-modules guide-table that follows the
  DataTable. See place-characteristics spec for the full design
  rationale on why the heading slot can't be consumed by the DataTable
  journal variant in verify's source-only inspection.

  prose_scope narrows proseMatches to the DataTable's JSX line range.
  The intro paragraph (line 337) and the post-DataTable roles-list
  paragraph + guide-table (lines 359-418) sit OUTSIDE this prose_scope
  window so the day-17 spec (file-global) catches them.

  subheadings[] enumerates the 14 OTHER headings in the file.
---

## Extracted text (first 2000 chars, for review only)

```
​Going deeper: finding the community work you want to do​
​What special skills do you have? What skills would you like to learn?​
​What activities/work do you find rewarding? Think about things you do that other people find difficult, but that you enjoy.​
​Do you enjoy collaborating with people or working on projects alone?​
​Do you like to spend time inside/outside? Working through a list of tasks, or imagining a new project? Do you enjoy words, numbers, visual art, or another medium?​
​What problems are you most excited about solving?​
​Who in your community inspires you? What do you find inspiring about them?​

[full extraction in docs/source-specs/_extraction-cache.yaml under
content_hash key for page 16.]
```

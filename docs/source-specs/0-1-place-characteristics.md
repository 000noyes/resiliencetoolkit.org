---
module: 0-1
template: place-characteristics
title: Mapping your community
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '10'
fields:
  - key: section-anchor
    label: 'Mapping your community'
    type: text
matching:
  require_cluster: false
prose_scope:
  start_line: 48
  end_line: 65
subheadings:
  - text: 'Organizing your community: who is here and what are they doing?'
  - text: Who is in your community/place?
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
notes: |
  Day-18 KYC half-2 spec — covers the Mapping your community DataTable
  (tableId: place-characteristics) on src/pages/modules/knowing-your-community.astro
  lines 48-64. Pairs with day-17 spec 0-1-knowing-your-community.md (page
  10-23 file-global) and 5 sibling day-18 DataTable specs.

  fields[] uses a single placeholder anchor (label "Mapping your
  community", which is the section heading on workbook page 10) — same
  established pattern as the day-17 spec (0-1-knowing-your-community)
  and 1-1 (1-1-emergency-preparedness-kits). Workbook page 10 contains
  no explicit column headers for this prompt-list table, and the site
  DataTable's "Prompt"/"Your Response" labels are a site-authored
  rendering convention not present in the workbook. The 4 row prompts
  ARE in the workbook verbatim but pdftotext fragments them across
  drop-cap typography lines ("W" + "rite down three important...")
  which lowers bestMatchScore below the 0.85 match threshold — so
  per-prompt fields[] would land in the drift zone (recall < 0.95)
  and yield needs_human_review rather than pass. Verbatim row content
  fidelity is enforced by the inventory audit trail
  (toolkit-inventory.yaml) rather than by spec.fields[].

  tableId is intentionally OMITTED here: the site DataTable has 2
  columns and the spec has 1 placeholder field. keysMatch with tableId
  would emit key_drift on the column-count mismatch (2 vs 1); without
  tableId, keysMatch falls back to column-count matching and silently
  no-ops (no 1-col DataTable on the file). The rename firewall is
  preserved by the day-17 spec's coverage and by this spec's discovery
  citation in the .astro file (`source="docs/source-specs/0-1-place-
  characteristics.md"` on the DataTable opening tag) — if the
  DataTable is removed, the citation is orphaned and verify surfaces
  the missing source via the `missing_citation` taxonomy.

  matching.require_cluster: false — the single-token "your" inside
  "Mapping your community" would otherwise need a cluster of sibling
  spec labels to corroborate, but with 1 placeholder field clustering
  is structurally impossible (decision k per-spec opt-out).

  Day-18 invented_table_titles_pattern resolution (inventory decision
  `rename_each_tableName_to_exact_workbook_heading_and_remove_h3_above`):
  the DataTable's tableName prop was renamed from "Place Characteristics"
  (site-invented) to "Mapping your community" (workbook-verbatim) per
  the user-preference rationale "tables must be self-describing so they
  can be rendered in other contexts (e.g. Drive-linked, exported,
  standalone)". The h3 above the DataTable was NOT removed despite the
  inventory's `_and_remove_h3_above` clause: verify titleMatches
  requires spec.title to appear as an actual <h[1-4]> tag in the .astro
  source, and the DataTable journal variant renders tableName as a
  <span> (not an <h3>) so the heading slot is NOT consumed for verify
  purposes. Removing the h3 would break titleMatches with no compensating
  benefit for the user's stated rationale (export self-description is
  satisfied by the tableName rename alone). Documented for the day-19+
  reader; if a future component change makes DataTable emit an h3 in
  the .astro source, the h3 above can be safely removed.

  prose_scope (decision j) narrows proseMatches to the DataTable's
  JSX line range (no <p>/<li> inside, so proseMatches no-ops). Sibling
  day-17 spec runs file-global proseMatches; the 6 day-18 specs all
  scope to their DataTable bands so paragraph drift doesn't get
  multi-counted.

  subheadings[] enumerates the 14 OTHER headings in the file (the
  day-17 spec.title + 12 other section headings + 2 sub-sub-headings,
  Pods + POD). titleMatches gates against invented headings; spec.title
  "Mapping your community" matches the h3 at line 46 verbatim.
---

## Extracted text (first 2000 chars, for review only)

```
​Mapping your community​
 ​Write down three important things about your place/what life is like here.​
 ​What are the biggest challenges in your place?​
 ​What are the biggest assets in your place?​
 ​Describe thriving conditions for your place. Use your imagination!​

[full extraction available in docs/source-specs/_extraction-cache.yaml
under content_hash key for page 10 of the master PDF.]
```

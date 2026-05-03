---
module: 1-4
template: power-supply
title: Power supply
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '45'
fields:
  - key: section-anchor
    label: Power supply
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Emergency/backup power
  - text: Potential sources of backup power
  - text: Solar emergency response trailer
links:
  - url: https://drive.google.com/drive/folders/1Bl9xBYaeC8ysbQZDP0C01eI_CFwQUlPU
    label: 1.3 Power supply
    page: '45'
  - url: https://docs.google.com/spreadsheets/d/1sJ-inMiVKj5SWsCukg_IimgWcA4oQLVWkbg6lAxcI3E/edit
    label: Power Supply inventory
    page: '45'
notes: |
  1-4 is a guide-table page (not a directory or form). The three sub-section
  labels — Emergency/backup power, Potential sources of backup power, Solar
  emergency response trailer — are rendered as <strong> labels inside HTML
  <table class="guide-table"> cells (the first and third as colspan=2 row
  headers; the second as a Stuff-cell label), so they do not surface as
  <h2>/<h3> headings in extractHeadings; subheadings[] above are documented
  for the audit trail.

  No structural_fidelity assertion: this page renders zero DataTable / PlanForm
  components, and structural_fidelity.table_count has a min(1) constraint in
  the spec schema (counting "no data-bearing components" is not currently
  expressible). Days 8/9's 1-2 and 1-3 specs made the same decision; revisit
  if a future module also needs table_count=0.

  Citation is wired via an HTML comment at the top of
  src/pages/modules/emergency-preparedness/1-4.astro rather than a component
  prop, since no DataTable / PlanForm exists on this page.

  Folder-header label was the workbook's verbatim "1.3 Power supply" (upstream
  workbook contains a typo in this header — section is 1.4, not 1.3; see
  docs/toolkit-inventory.yaml entry for 1-4, workbook_typo_note. Same
  off-by-one pattern as 1-3's "1.4 First aid and medical" typo). Day 30
  (commit 4a9c134 + follow-up commit) removed the inline `<p>Folder with
  resources and templates: ...</p>` line as a duplicate of the ModuleLayout
  "See Additional Resources" button affordance; the workbook folder URL
  (1Bl9xBY...) is now sourced from src/data/downloads.ts via
  `getResourcesUrlForSection(sectionData.number)` and recognized by the
  verifier's layout-aware link check (commit 4a9c134). The workbook-typo
  label "1.3" is no longer rendered to users — only the canonical section
  title ("Power supply") remains, surfaced through ModuleLayout's page
  header. Source-fidelity preserved: the folder URL still passes linksMatch
  via the layout-aware exemption.

  Power Supply inventory link: workbook anchors the phrase "Power Supply
  inventory" to the Templates Directory master sheet at cell-level URL
  (?gid=1882137661&range=A1:C1). Per inventory decision
  1a_restore_sheet_level_url + innovation flag drop_range_use_sheet_level_url,
  the spec stores the sheet-level URL only — the cell-level range is dropped
  for visual equivalence in the browser and to keep linksMatch's normalizeUrl
  scope simpler. Site restoration wraps the phrase in <ExternalLink> with the
  sheet-level URL.

  The InfoCallout ("How this works…" UX meta-instruction) is removed from
  this page in the same commit per the class-c firewall (no source citation;
  user-instruction text not present in the cited workbook range). 1-2/1-3
  done; 1-1 / 1-5 / KYC remain.

  No invented h2 on 1-4 (unlike 1-3's "First aid preparedness"); inventory
  walk confirms section_order_check ok and no class-c headings to remove.

  Apostrophe encoding divergence (workbook curly ’ vs site straight ') is
  accepted as site-wide encoding convention per user decision 2026-04-24,
  not a fidelity issue. Walk-summary observation only; no per-module fix.

  Single placeholder field above is required by the spec schema
  (sourceSpecSchema requires either fields[] or sections[]); 1-4 has no
  data-bearing component to map fields to. Keep this entry as-is until/unless
  a future Phase-2 commit wires inventories on 1-4, at which point the
  placeholder is replaced with real field definitions.
---

## Extracted text (first 2000 chars, for review only)

```
​1.4 Power supply​
​Folder with resources and templates:​       1.3 Power supply
 ​Systems​                                                    ​Stuff​

 ​Emergency/backup power​

         ​ tore backup power sources on a trailer or​
         S                                                    ​Potential sources of backup power:​
         ​mobile platform to move away from disasters​                ​Solar panels​
          ​and towards areas of need.​                                 ​Deep cycle batteries & inverters​
           ​Keep track of your power sources with the​                  ​Filled propane tanks​
            ​Power Supply inventory​​template.​                          ​Gas tanks (non-ethanol with fuel stabilizer​
                                                                          ​additive)​
                                                                           ​Diesel tanks and generators​

 ​Solar emergency response trailer​

         ​ his trailer can serve as a mobile disaster​
         T                                                              ​ ill a movable trailer with emergency​
                                                                        F
         ​response unit, be packed to best serve the​                   ​response supplies (see other entries with​
          ​crisis you’re responding to, and provide​                     ​lists) that is also equipped with a solar panel.​
           ​power for tools, generators, or devices.​
            ​Consider hosting a tool library in a mobile​
             ​trailer, so tools are easy to move to where​
              ​they’re needed.​


​1.5 Warming/cooling/emergency shelter​
​Folder with resources and templates:​       1.5 Warming/cooling/emergency shelter
 ​Systems​                                                    ​Stuff​

            I​dentify accessible day-use sites for people to​ ​For cooling/warming shelters​
             ​congregate for cooling/warming centers or​     
```

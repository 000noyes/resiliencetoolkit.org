---
module: 1-5
template: warming-cooling-emergency-shelter
title: Warming/cooling/emergency shelter
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '45'
fields:
  - key: section-anchor
    label: Warming/cooling/emergency shelter
    type: text
matching:
  require_cluster: false
subheadings:
  - text: For cooling/warming shelters
  - text: Additional supplies for overnight shelters
links:
  - url: https://drive.google.com/drive/folders/1GAq4V6yx2Pn83y-l6rbauGbzQlv46CCF
    label: 1.5 Warming/cooling/emergency shelter
    page: '45'
  - url: /modules/emergency-preparedness/1-2
    label: Identify
    page: '45'
    kind: internal_route
  - url: https://drive.google.com/file/d/1S7LKMy_vRhA5tM5gHWOFE1qtN9iYKi3p/view?usp=drive_link
    label: Create a directory
    page: '45'
  - url: https://drive.google.com/drive/folders/1GAq4V6yx2Pn83y-l6rbauGbzQlv46CCF
    label: Create a system
    page: '45'
notes: |
  1-5 is a guide-table page (not a directory or form). The two Stuff-column
  sub-section labels — "For cooling/warming shelters" and "Additional supplies
  for overnight shelters" — are rendered as <strong> labels inside the Stuff
  <td>, so they do not surface as <h2>/<h3> headings in extractHeadings;
  subheadings[] above are documented for the audit trail. Workbook Systems
  column is a flat list (no sub-section header).

  No structural_fidelity assertion: this page renders zero DataTable / PlanForm
  components, and structural_fidelity.table_count has a min(1) constraint in
  the spec schema (counting "no data-bearing components" is not currently
  expressible). Days 8/9/10's 1-2, 1-3, and 1-4 specs made the same decision;
  revisit if a future module also needs table_count=0.

  Citation is wired via an HTML comment at the top of
  src/pages/modules/emergency-preparedness/1-5.astro rather than a component
  prop, since no DataTable / PlanForm exists on this page.

  Folder-header label is the workbook's verbatim "1.5 Warming/cooling/emergency
  shelter" (no upstream typo, unlike 1-3/1-4). The folder URL is also targeted
  by the Systems column's "Create a system" anchor — both render as
  ExternalLinks pointing to the same Drive folder. The folder-header inline
  rendering pattern is also surfaced via the ModuleLayout "See Additional
  Resources" action-bar button driven by src/data/downloads.ts.moduleDownloads
  []. resourcesUrl; whether inline + page-chrome is redundant or complementary
  is pinned for design review per the inventory walk's folder_header_pattern.
  decision (same as 1-3/1-4).

  Identify → site-internal route: the workbook anchors the in-prose word
  "Identify" (in "Identify local restaurants or people to bring meals to the
  shelter") to an intra-PDF page anchor pointing back to the 1.2 Food and water
  section. Per inventory decision 1a_replace_with_internal_site_link and the
  feedback_internal_anchor_to_site_route memory, this is rendered as a
  site-internal `/modules/emergency-preparedness/1-2` link, NOT as an
  ExternalLink to the 14BP-QH2d Google Doc the site previously substituted.
  spec-link `kind: internal_route` engages linksMatch's prefix-match path so
  the comparison stays site-internal-aware (normalizeUrl is bypassed for
  internal routes per src/lib/verify/runner-checks.ts).

  The InfoCallout ("How this works…" UX meta-instruction) is removed from this
  page in the same commit per the class-c firewall (no source citation;
  user-instruction text not present in the cited workbook range). Sweep status:
  1-2/1-3/1-4 done in days 8-10; 1-5 done here; 1-1 / KYC remain.

  Invented table-row sub-section header removed: the colspan=2 row "Activate,
  staff, and supply local shelters" above the Systems/Stuff content is
  site-invented (workbook has no such heading). Same family as the invented h2
  removal on 1-3 ("First aid preparedness") but inside a table row. Per
  inventory innovation flag invented_table_row_subsection_header, decision
  1a_remove.

  Low-stimulation areas paragraph drift restored: the workbook places "As is
  possible, create low-stimulation areas with minimal sound, soft seating, and
  low light" under the "Additional supplies for overnight shelters"
  sub-section, AFTER "Foldable cots, sleeping mats, and blankets". The site
  previously placed this Todo under "For cooling/warming shelters" (after
  backup-power-available, before the overnight header). Per inventory walk
  paragraph_drift entry decision 1a_restore, the Todo is moved into the
  overnight sub-section in workbook order. The Todo id "low-stimulation-areas"
  is preserved so any IndexedDB checks under that key are retained. The Todo's
  prose is not checked by proseMatches (Todo is a JSX component, not <p>/<li>);
  fix is applied for fidelity, not for the verify check.

  Single placeholder field above is required by the spec schema
  (sourceSpecSchema requires either fields[] or sections[]); 1-5 has no
  data-bearing component to map fields to. Keep this entry as-is until/unless
  a future Phase-2 commit wires inventories or PlanForm on 1-5, at which point
  the placeholder is replaced with real field definitions.
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

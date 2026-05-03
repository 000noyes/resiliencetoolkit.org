---
module: 1-7
template: sanitation-and-hygiene
title: Sanitation and hygiene
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '52'
fields:
  - key: section-anchor
    label: Sanitation and hygiene
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Handwashing, toilets, showers
  - text: Laundry
links:
  - url: https://drive.google.com/file/d/1BvGEOJSKyVwq5ttTQpEdEkIRIpN056DF/view?usp=drive_link
    label: Create a directory of local public buildings
    page: '52'
  - url: https://drive.google.com/file/d/14xHhFJ-GLWtaBJpPCBwpheO-rYCwtHd-/view?usp=drive_link
    label: build them
    page: '52'
  - url: https://drive.google.com/file/d/1zDFvshC71Se1-9a4JiTaGa0IHKqQH4e1/view?usp=drive_link
    label: composting toilet box
    page: '52'
  - url: https://drive.google.com/file/d/1BvGEOJSKyVwq5ttTQpEdEkIRIpN056DF/view?usp=drive_link
    label: Create a directory
    page: '52'
  - url: https://barrecongregational.org/laundry-love
    label: Example here
    page: '52'
  - url: https://www.portablerestroomtrailers.com/products/trailer-types/laundry-trailers.html
    label: Portable laundry trailers
    page: '52'
notes: |
  1-7 is a guide-table page (not a directory or form). The two top-level
  sub-sections — Handwashing, toilets, showers and Laundry — are rendered as
  <strong> labels inside an HTML <table class="guide-table"> as full-width
  row headers (<tr><td colspan="2">), so they do not surface as <h2>/<h3>
  headings in extractHeadings; subheadings[] above are documented for the
  audit trail (same pattern as 1-1/1-2/1-3/1-4/1-5/1-6).

  No structural_fidelity assertion: this page renders zero DataTable /
  PlanForm components, and structural_fidelity.table_count has a min(1)
  constraint. Citation is wired via an HTML comment at the top of
  src/pages/modules/emergency-preparedness/1-7.astro rather than a component
  prop — same pattern as 1-1/1-2/1-6.

  Single section-anchor placeholder field above is required by
  sourceSpecSchema (which demands either fields[] or sections[]); 1-7 has
  no data-bearing component to map fields to. Replace with real field
  definitions if a future Phase-2 commit wires inventories on 1-7.

  links[] enumerates the 6 in-prose workbook page-52 (displayed page 25)
  URLs that are surfaced inline on the site as <ExternalLink> after this
  commit's day-20 restoration:
    - 1BvGEOJSKy (×2 — both bathrooms-directory + laundry-directory share
      the same Drive file per inventory; appears twice in spec.links[]
      because both anchors carry their own ExternalLink wrapper on site)
    - 14xHhFJ — water-containers-spigot DIY guide
    - 1zDFvshC — composting toilet box build guide
    - barrecongregational.org/laundry-love — Barre Congregational Church
      free-laundry example
    - portablerestroomtrailers.com — vendor reference for portable laundry
      trailers
  The 7th workbook anchor on this page — the 1b1h7aUH Drive folder header
  ("Folder with resources and templates: 1.7 Sanitation and hygiene") — is
  intentionally NOT in spec.links[] because the inventory records it as
  `on_site: surface_via_module_layout_button   # pinned (recurring)` — a
  deferred recurring pattern (the folder URL is meant to be surfaced via a
  ModuleLayout button, not inline like 1-1/1-2). Per R-day-19-second-commit
  rule, including it would trigger linksMatch failure since the URL is not
  present in src/pages/modules/emergency-preparedness/1-7.astro.

  The InfoCallout ("How this works…" UX meta-instruction) is removed in this
  same commit per the class-c firewall (decision o; folded into the 1-7 day
  per closeout doc §2 row 20). Same removal completed across 1-1 (day 16),
  1-2/1-3/1-4/1-5 (days 8-11), 1-6 (day 19 second commit), KYC (day 17).
  Site-invented form is preserved in docs/site-inventions-archive.yaml under
  invented_prose (id: archive-1-7-info-callout, identical text to
  archive-1-1-info-callout).

  Walked 2026-04-24 — biggest in-prose link-drop module after KYC: 6
  in-prose links dropped (Todos: public-bathrooms-directory,
  water-containers-spigot, bucket-toilet, laundry-directory,
  free-laundry-services, portable-laundry-trailers). Zero ExternalLinks
  on site pre-day-20 — structurally faithful, link-wise systematically
  under-wired. 23 Todos verbatim-match; 2 row-headers + 3 Stuff sub-heads
  all match workbook page 52 (displayed page 25).
---

## Extracted text (first 2000 chars, for review only)

```
​1.7 Sanitation & Hygiene​
​Folder with resources and templates:​                  1.7 Sanitation and hygiene
 ​Systems​                                                              ​Stuff​

 ​Handwashing, toilets, showers​

 I​dentify places for public access to safe​                             ​DIY handwashing station​
  ​sanitation and hygiene.​                                                       ​Use clean water (from a hose), but not potable​
             ​Create a directory of local public​                                  ​water when possible​
              ​buildings​​with bathrooms, sinks and/or​                             ​Make small holes in the lid of a plastic drink bottle​
               ​showers that could be made available to​                             ​and squeeze the bottle to dispense water.​
                ​disaster survivors and volunteers.​                                  ​Purchase water containers with a side spigot, or​
                 ​Include handwashing plans in all​                                    ​build them​​.​
                  ​volunteer work. Provide soap!​                         ​DIY toilets​
                   ​Include a bathroom / sanitation plans in​                           ​For short-term use, all you need is a bucket with​
                    ​response efforts.​                                                  ​a lid and dry material like sawdust, wood​
                     ​Share models for safe sanitation with​                              ​shavings or wood chips. Or, build a​​composting​
                      ​impacted households, especially those​                              ​toilet box​​.​
                       ​that are more remote and can’t travel to​                           ​Stock with period products and toilet paper​
                        ​public restrooms.​                                D
                                                                           ​ IY showers​
                   
```

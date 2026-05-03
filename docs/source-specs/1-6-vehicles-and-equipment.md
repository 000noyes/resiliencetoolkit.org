---
module: 1-6
template: vehicles-and-equipment
title: Vehicles and equipment
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '49'
fields:
  - key: section-anchor
    label: Vehicles and equipment
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Emergency shuttles
  - text: Shared use vehicles
  - text: Heavy equipment directory
links:
  - url: https://drive.google.com/file/d/1WGTfHGl9tRgEqzmeueS-8hHPSDqcx1Rs/view?usp=drive_link
    label: Create a directory
    page: '49'
  - url: https://foldupkayaks.com/
    label: foldupkayaks.com
    page: '49'
  - url: https://drive.google.com/file/d/1lIdpnkjjrCrk4e1OMb1hsHeX3u4Xs49D/view?usp=drive_link
    label: directory of heavy equipment
    page: '49'
notes: |
  1-6 is a guide-table page (not a directory or form). The three subsections —
  Emergency shuttles, Shared use vehicles, Heavy equipment directory — are
  rendered as <strong> labels inside an HTML <table class="guide-table"> as
  full-width row headers (<tr><td colspan="2">), so they do not surface as
  <h2>/<h3> headings in extractHeadings; subheadings[] above are documented
  for the audit trail (same pattern as 1-1/1-2/1-3/1-4/1-5).

  No structural_fidelity assertion: this page renders zero DataTable / PlanForm
  components, and structural_fidelity.table_count has a min(1) constraint.
  Citation is wired via an HTML comment at the top of
  src/pages/modules/emergency-preparedness/1-6.astro rather than a component
  prop — same pattern as 1-1/1-2.

  Single section-anchor placeholder field above is required by sourceSpecSchema
  (which demands either fields[] or sections[]); 1-6 has no data-bearing
  component to map fields to. Replace with real field definitions if a future
  Phase-2 commit wires inventories on 1-6.

  links[] enumerates the 3 workbook page-49 (displayed page 24) URLs that
  are surfaced inline on the site as <ExternalLink>: the 1WGTfHGl shared-
  vehicles directory template, the 1lIdpn heavy-equipment directory template,
  and the foldupkayaks.com vendor reference. The 4th workbook anchor on this
  page — the 1KYOLws Drive folder header — is intentionally NOT in spec.links[]
  because the inventory records it as
  `on_site: surface_via_module_layout_button   # pinned (recurring)` — a
  deferred recurring pattern (the folder URL is meant to be surfaced via a
  ModuleLayout button, not inline like 1-1/1-2). Including it in spec.links[]
  would trigger linksMatch failure since the URL is not present in
  src/pages/modules/emergency-preparedness/1-6.astro.

  The InfoCallout ("How this works…" UX meta-instruction) is removed in this
  same commit per the class-c firewall (decision o; folded into the 1-6 day
  per closeout doc §2 row 19). Same removal completed across 1-1 (day 16),
  1-2/1-3/1-4/1-5 (days 8-11), KYC (day 17). Site-invented form is preserved
  in docs/site-inventions-archive.yaml under invented_prose.

  Walked 2026-04-24 — inventory marks this the cleanest module so far: no
  paragraph drift, no invented content, no internal-anchor substitutions,
  no placement drift. 16 Todos + 3 ExternalLinks + 3 sub-section row-headers
  all verbatim-match workbook page 49.
---

## Extracted text (first 2000 chars, for review only)

```
​1.6 Vehicles and equipment​
​Folder with resources and templates:​    1.6 Vehicles and equipment
 ​Systems​                                                 ​Stuff​

 ​Emergency shuttles​

        ​ reate a directory​​of people and equipment​
        C                                                    ​Water transport​
        ​available for emergency shuttling to shelters,​             ​Consider purchasing kayaks and life vests​
         ​if personal cars are compromised.​                          ​and storing on high ground for use during​
          ​Connect with town fire/EMTs about if they​                  ​flooding (​​https://foldupkayaks.com/​​).​
           ​have equipment designated for emergency​
            ​evacuation/transportation, and add that to the​
             ​directory.​

 ​Shared use vehicles​

        ​ reate a directory​​of shared use vehicles,​
        C                                                  ​Useful vehicles to have for shared use​
        ​including who owns and insures vehicles.​                 ​4x4 Truck with a hitch and ample tow​
         ​Create a system for access and use. Ideally,​             ​capacity​
          ​vehicles are owned by a community entity​                 ​Dump trailer (handy for moving flood debris,​
           ​that has commercial insurance, or the vehicle​            ​building materials, four wheelers, etc)​
            ​itself has multiple owners. Or, just toss​                ​Tool trailer, enclosed​
             ​someone your keys and ask them to return​
              ​the vehicle when they’re done!​

 ​Heavy equipment directory​

        ​ reate a​​directory of heavy equipment​​that​
        C                                               ​Useful equipment​
        ​can be mobilized for emergency use.​                   ​Plow Trucks (with salt & sand spreaders)​
         ​Connect with municipality to understand what​          ​Grader​
          ​kind of heavy equipment they have, and what​
       
```

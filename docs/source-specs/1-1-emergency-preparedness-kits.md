---
module: 1-1
template: emergency-preparedness-kits
title: Emergency preparedness kits
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '30'
fields:
  - key: section-anchor
    label: Emergency preparedness kits
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Household emergency supplies
  - text: Individual emergency supplies
links:
  - url: https://drive.google.com/drive/folders/13eSjal-yx4cU18VV8aK78w6oqy5GKz8F
    label: 1.1 Emergency preparedness kits
    page: '30'
  - url: https://docs.google.com/document/d/154qilah2wzsRzEhys1_dNwsS8wJkSqOCe3-miSqnUto/edit?tab=t.0
    label: emergency plans
    page: '30'
  - url: https://drive.google.com/drive/folders/13eSjal-yx4cU18VV8aK78w6oqy5GKz8F
    label: emergency kits
    page: '30'
  - url: https://docs.google.com/spreadsheets/d/1RaYyavdAbn43b3EH9zMzQir6G6gxnQE0XxMBxMH5iTQ/edit?usp=drive_link
    label: storing backup food
    page: '30'
  - url: https://drive.google.com/file/d/1Ea1zc8wSbvVoMqcLqNz19sNJTsuThQIM/view?usp=drive_link
    label: go bags
    page: '30'
notes: |
  1-1 is a guide-table page (not a directory or form). The two subsections —
  Household emergency supplies and Individual emergency supplies — are rendered
  as <strong> labels inside an HTML <table class="guide-table">, so they do not
  surface as <h2>/<h3> headings in extractHeadings; subheadings[] above are
  documented for the audit trail (same pattern as 1-2/1-3/1-4/1-5).

  No structural_fidelity assertion: this page renders zero DataTable / PlanForm
  components, and structural_fidelity.table_count has a min(1) constraint.
  Citation is wired via an HTML comment at the top of
  src/pages/modules/emergency-preparedness/1-1.astro rather than a component
  prop — same pattern as 1-2 et al.

  Single placeholder field above is required by sourceSpecSchema (which demands
  either fields[] or sections[]); 1-1 has no data-bearing component to map
  fields to. Replace with real field definitions if a future Phase-2 commit
  wires inventories on 1-1.

  links[] enumerates the 5 workbook page-30 anchor occurrences (4 unique URLs;
  the 13eSjal Drive folder is shared by the folder header and the inline
  "emergency kits" anchor). Day-16 wiring restored all 5 — the folder header
  is surfaced as a leading "Folder with resources and templates:" line; the
  4 inline href="#" anchors are upgraded to <ExternalLink>. Verify via
  linksMatch.

  The InfoCallout ("How this works…" UX meta-instruction) was removed in the
  same commit per the class-c firewall (decision o; folded into the 1-1 day
  per closeout doc). Three minor paragraph drifts (period add, curly-quote
  drop on "go bags,", Oxford-comma add on "garbage bags and plastic ties")
  were restored to workbook verbatim. Site-invented forms are preserved in
  docs/site-inventions-archive.yaml under invented_prose.

  Workbook appendix templates p31 (Street Medic First Aid Kit) + p32 (Go Bag
  Gear List) remain deferred to Step 2 per inventory; they are linked from
  the 1-1 Drive folder but not surfaced as on-site components in Step 1.
---

## Extracted text (first 2000 chars, for review only)

```
​Emergency Preparedness and Response​
​ mergency systems often spring into existence when disaster strikes and not a moment sooner. Prepare your​
E
​community by doing emergency planning work when the sun is shining. Equipping your neighborhood, town,​
 ​and region to be ready in emergencies also builds baseline resilience.​

​1.1 Emergency preparedness kits​
​Folder with resources and templates:​      1.1 Emergency preparedness kits
 ​Systems​                ​Stuff​

 ​Household emergency supplies​

 ​ ouseholds can​
 H                         ​Emergency Kit​​: keep this in your home​
 ​prepare​​emergency​             ​Several days of water and non-perishable food, can opener​
  ​plans​​and​​emergency​
                                   ​Extra cell phone battery or charger​
   ​kits​​, as well as​
    ​storing backup food​           ​Battery-powered or hand crank radio with NOAA weather tone alerts​
     ​and water supplies.​           ​Flashlight and extra batteries​
                                    ​ irst aid kit​
                                    F
 ​ ood and water will​
 F
 ​need to be refreshed​             ​Whistle to signal for help​
  ​on a regular basis​               ​Dust mask, to help filter contaminated air and plastic​
                                      ​Sheeting and duct tape to shelter-in-place​
                                       ​Personal sanitation supplies (incl. moist towelettes, garbage bags and​
                                        ​plastic ties)​
                                         ​Non-sparking wrench or pliers to turn off utilities​
                                          ​Local paper maps​

 ​Individual emergency supplies​

 I​ndividuals in a​            ​Go Bag​​: Choose a sturdy and easy to carry bag.​
  ​household can​                     ​Medications​
   ​prepare ‘​​go bags​​,’​
                                       ​3 days of non-perishable food and cutlery​
    ​which are easy to​
     ​grab in case you​       
```

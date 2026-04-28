---
module: 1-2
template: food-and-water
title: Food and water
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: 35-36
fields:
  - key: section-anchor
    label: Food and water
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Backup food supply
  - text: Community food infrastructure
  - text: Water supply and storage
  - text: Community meals
links:
  - url: https://drive.google.com/drive/folders/1HZSXmTaX1jc3IlZps-4PayHkrrwDEIRu
    label: 1.2 Food and water
    page: '35'
  - url: https://drive.google.com/drive/folders/1HZSXmTaX1jc3IlZps-4PayHkrrwDEIRu
    label: community backup stores
    page: '35'
  - url: https://drive.google.com/drive/folders/1HZSXmTaX1jc3IlZps-4PayHkrrwDEIRu
    label: community-scale equipment and infrastructure
    page: '35'
  - url: https://drive.google.com/file/d/1VO1V7xknP-Ygvz7m_JL9m1kL7paFtuFP/view
    label: Create a directory
    page: '35'
  - url: https://drive.google.com/drive/folders/1HZSXmTaX1jc3IlZps-4PayHkrrwDEIRu
    label: set up kitchens
    page: '35'
  - url: https://drive.google.com/file/d/1at2VF06qMMKi3olVD4uNecniZZFnjKz0/view
    label: Create a directory of cooks
    page: '35'
  - url: https://drive.google.com/file/d/1C5a0Sf1NWRU0XnMkHayw_vjwpuzqVZzJ/view
    label: safe food handling
    page: '35'
  - url: https://drive.google.com/drive/folders/1HZSXmTaX1jc3IlZps-4PayHkrrwDEIRu
    label: Create a directory of food access points
    page: '35'
  - url: http://tinyurl.com/freefoodbtv
    label: google map
    page: '35'
  - url: https://cdn.flowcode.com/prodassets/NEKCA_FoodAccess_Summer.24.2.pdf
    label: other format
    page: '35'
  - url: https://www.albertahealthservices.ca/assets/info/nutrition/if-nfs-collective-kitchen-sample-kitchen-equipment-list.pdf
    label: supplies
    page: '36'
notes: |
  1-2 is a guide-table page (not a directory or form). The four subsections — Backup food
  supply, Community food infrastructure, Water supply and storage, Community meals — are
  rendered as <strong> labels inside an HTML <table class="guide-table">, so they do not
  surface as <h2>/<h3> headings in extractHeadings; subheadings[] above are documented for
  the audit trail.

  No structural_fidelity assertion: this page renders zero DataTable / PlanForm
  components, and structural_fidelity.table_count has a min(1) constraint in the spec
  schema (counting "no data-bearing components" is not currently expressible). Day 8
  intentionally omits the assertion rather than weaken the schema; revisit if a future
  module also needs table_count=0.

  Citation is wired via an HTML comment at the top of src/pages/modules/emergency-preparedness/1-2.astro
  rather than a component prop, since no DataTable / PlanForm exists on this page.

  Day 19 (2026-04-28) closes the two prose-link drops the day-8 commit deferred:
  "community backup stores" (Backup food supply, Systems col Todo) and
  "community-scale equipment and infrastructure" (Community food infrastructure,
  Systems col plain text). Both anchors now wrap with ExternalLink → 1HZSXmTaX
  Drive folder, matching the workbook page-35 inline links. The
  ExternalLink-inside-Todo composition concern that motivated the day-8 deferral
  is moot in practice: this page already ships four ExternalLink-inside-Todo
  occurrences (kitchen-directory, cooks-directory, safe-food-handling,
  food-access-directory) which have been live since day-8 with no
  click-toggle interference observed. The class-(c) inventory.dropped_inline_prose_links
  innovation is now closed.

  The InfoCallout ("How this works…" UX meta-instruction) was removed from this page in
  the day-8 commit per the class-c firewall (no source citation; user-instruction text
  not present in the cited workbook range). Same removal completed across 1-1 (day-16)
  and KYC (days 17-18); pending only on 1-3 (day-20) and remaining EP modules.

  Single placeholder field above is required by the spec schema (sourceSpecSchema requires
  either fields[] or sections[]); 1-2 has no data-bearing component to map fields to.
  Keep this entry as-is until/unless a future Phase-2 commit wires inventories on 1-2,
  at which point the placeholder is replaced with real field definitions.
---

## Extracted text (first 2000 chars, for review only)

```
​1.2 Food and water​
​Folder with resources and templates:​             1.2 Food and water
 ​Systems​                                                      ​Stuff​

 ​Backup food supply​

           ​ reate household and​​community​
           C                                              ​Backup foods to store:​
           ​backup stores​​of food.​                            ​Ready-to-eat canned meats, fruits, vegetables​
            ​Rotate stock, perhaps in collaboration​             ​and a can opener​
             ​with a store or food shelf.​                        ​Protein/fruit bars​
              ​Use critter and humidity safe containers.​
                                                                   ​Dry cereal/granola​
 ​Consider sourcing and storing food that can be​                   ​Peanut butter​
  ​prepared and distributed at community scale,​                     ​Dried fruit​
   ​especially in the 1-2 days during / after disaster.​              ​Canned juices​
                                                                       ​Non-perishable pasteurized milk​
                                                                        ​High-energy foods​
                                                                         ​Food for infants​
                                                                          ​Comfort/stress foods​

 ​Community food infrastructure​

 I​dentify​​community-scale equipment and​                                ​ alk in cooler or freezer space​
                                                                          W
  ​infrastructure​​for food security.​                                    ​Root cellar​
                                                                           ​Storage or warehouse space for non-perishables​
                                                                            ​and related supplies​
                                                                             ​Kitchen/c
```

---
module: 1-12
template: mutual-aid-n2n
title: Mutual Aid/Neighbor to Neighbor (N2N)
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '78'
fields:
  - key: section-anchor
    label: Mutual Aid/Neighbor to Neighbor (N2N)
    type: text
matching:
  require_cluster: false
subheadings: []
links: []
notes: |
  1-12 is a single-page narrative + two-column tenets/checklist module.
  Workbook page 78 (displayed page 39) holds the "1.12 Mutual Aid/Neighbor
  to Neighbor (N2N)" section, which is shared with the 1.13 Financial
  Resources section that starts mid-page after the 1.12 Mutual Aid
  Tenets/Checklist table.

  Day-24 catastrophic content restoration (closeout doc §2 row 24):
  the largest single-module class-c archive load of the Step 1 closeout
  sprint. Pre-day-24 the page held a wholesale-replacement of both the
  Mutual Aid Tenets column and Mutual Aid Checklist column with movement-
  canon material (6 Dean-Spade tenets + 8 different checklist items + 2
  ExternalLinks pointing at Mutual Aid Disaster Relief and Big Door
  Brigade) plus an invented "Mutual Aid Tenets & Checklist" colspan="2"
  row-header and the recurring InfoCallout. Day-24 restores the workbook
  5-tenet narrative (Get people together / Build relationships / Make
  decisions based on consensus / Share rather than hoard / Recognize the
  value in all kinds of support) + the 10-item checklist (Find a buddy /
  Build a pod map / Who could help me? / Connect with those folks /
  Identify who and where / My building, my block, my co-workers? / Start
  small / Establish communication channels / Get the conversation
  started / Offer help). All site-invented content archived to
  docs/site-inventions-archive.yaml under invented_tenets (×6),
  invented_checklist_items (×8 — item 8 embeds the 2 ExternalLinks),
  invented_h2_headers (×1 row-header), invented_prose (×1 InfoCallout),
  and invented_items (×2 ExternalLinks called out separately for
  movement-canon supplement candidate registration).

  links[] is empty: workbook page 78 has only one anchor for 1.12 — the
  "Folder with resources and templates: 1.12 Mutual Aid" header pointing
  at Drive folder 1lgAo_M6Jq3i4AR9xbtpxDpFLv5MAAVyg. That folder header
  is pinned for the ModuleLayout button surface (recurring decision per
  R-day-19-second-commit; same as 1-10 / 1-11 folder header handling).
  No in-prose workbook URLs on page 39 for 1.12 content (workbook_anchor_count: 1
  per inventory line 2263).

  subheadings[] is empty: the workbook 1.12 section has no sub-section
  structure beyond the section title — just the intro paragraph and the
  two-column Tenets/Checklist table.

  Single section-anchor placeholder field is required by sourceSpecSchema
  (which demands either fields[] or sections[]); 1-12 has no data-bearing
  component to map fields to (Todo items are self-contained, not field-
  bound). Same idiom as 1-1/1-2/1-6/1-7/1-10/1-11/1-13 — single section-
  anchor placeholder per the guide-table / prose-page recurring R10 idiom.

  Citation is wired via an HTML comment at the top of
  src/pages/modules/emergency-preparedness/1-12.astro
  (`<!-- source: docs/source-specs/1-12-mutual-aid-n2n.md page: 78 -->`)
  rather than a component prop — same pattern as 1-1/1-2/1-6/1-7/1-10/
  1-11/1-13.

  No structural_fidelity assertion: this page renders zero DataTable /
  PlanForm components, and structural_fidelity.table_count has a min(1)
  constraint. The on-page guide-table is a static <table class="guide-table">
  (presentational), not a DataTable component.
---

## Extracted text (first 2000 chars, for review only)

```
​1.12 Mutual Aid/Neighbor to Neighbor (N2N)​
​ older with resources and templates:​ 1.12 Mutual Aid
F
​Mutual Aid/N2N groups spring up after disasters like COVID lockdown and flooding to direct resources and​
 ​help. These community efforts are informal (not housed inside of an organization or part of a State agency),​
  ​which means they keep barriers to accessing help very low. Groups led by people in impacted communities are​
   ​often the first to show up and help when disaster strikes, because they are showing up for their own​
    ​community, and also often know where help is needed most. Identifying who you are already in relationship​
     ​with and proximity to, and acknowledging that we all have something to offer and all have something we need,​
      ​is crucial. Around the world, mutual aid groups have saved lives and improved material conditions for people​
       ​when official systems of aid have moved too slowly or failed. Mutual aid and N2N work can happen in​
        ​countless ways. The most important things are that these groups are formed by and for the community, that​
         ​they promote solidarity not charity, practice cooperation not competition and recognize that our dignity and​
          ​survival are bound up together.​


 ​Mutual Aid Tenets​                                   ​Mutual Aid Checklist​
        ​Get people together in your​                         ​Find a buddy to work with.​
         ​community to provide material​                       ​Build a​​pod map​​(see Organizing your community section)​
          ​support to each other​                                             ​Who could help me?​
           ​Build relationships with your​                      ​Connect with those folks. Ask if they can help!​
            ​neighbors based on trust and​                       ​Identify who and where you can get and give support​
             ​common interests​
                                                                     
```

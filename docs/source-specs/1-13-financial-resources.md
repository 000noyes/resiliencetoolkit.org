---
module: 1-13
template: financial-resources
title: Financial resources
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '78'
fields:
  - key: section-anchor
    label: Financial resources
    type: text
matching:
  require_cluster: false
subheadings: []
links:
  - url: https://drive.google.com/drive/folders/1fAFOW-sh7Rls6bckXHub4gN9PX_1je9N
    label: 1.13 Financial resources
    page: '78'
  - url: https://drive.google.com/drive/folders/1fAFOW-sh7Rls6bckXHub4gN9PX_1je9N
    label: Create a directory
    page: '78'
notes: |
  1-13 is a short prose-list page: workbook page 78 (displayed page 39) holds
  4 verbatim bullets directly under the "1.13 Financial resources" section
  title, with no nested data-bearing components. Renders on-site as a single
  <ul> of 4 <li> bullets plus 1 ExternalLink wrapping the leading "Create a
  directory" anchor. Workbook page 78 is shared with 1.12 (Mutual Aid /
  Neighbor to Neighbor) — the 1.13 section starts mid-page after 1.12's
  Mutual Aid Tenets / Checklist table.

  No structural_fidelity assertion: this page renders zero DataTable / PlanForm
  components, and structural_fidelity.table_count has a min(1) constraint.
  Citation is wired via an HTML comment at the top of
  src/pages/modules/emergency-preparedness/1-13.astro rather than a component
  prop — same pattern as 1-1/1-2/1-6.

  Single section-anchor placeholder field above is required by sourceSpecSchema
  (which demands either fields[] or sections[]); 1-13 has no data-bearing
  component to map fields to. subheadings[] is empty because the workbook
  has no sub-section structure — just the title plus 4 prose bullets.

  links[] enumerates the 2 workbook page-78 anchor occurrences for the 1.13
  section (both share the same Drive folder URL): the section folder header
  and the inline "Create a directory" anchor wrapping the lead bullet. Same
  URL is reused for both anchors in the workbook. Site wires the inline
  "Create a directory" as ExternalLink; the folder header is the recurring
  "surface via module layout button" pattern (deferred per inventory).

  The invented <h2>"Financial support directory"</h2> at the top of the
  module page is removed in this same commit per the class-c firewall
  (workbook section title is "1.13 Financial resources", which the
  ModuleLayout already renders via sectionData.title — the additional h2
  was site-invented). Site-invented form is preserved in
  docs/site-inventions-archive.yaml under invented_h2_headers.

  Walked 2026-04-24 — only 1 class-c item: the invented h2. All 4 bullets
  verbatim-match workbook; the lone ExternalLink href matches workbook URL.
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

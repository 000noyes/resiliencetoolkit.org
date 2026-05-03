---
module: 1-8
template: populations-with-specific-needs
title: Children, childcare, and youth engagement with disaster
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '54-59'
fields:
  - key: section-anchor
    label: Populations with specific needs
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Senior citizens; people with mobility challenges and other disabilities
  - text: (Im)migrant populations with Limited English Proficiency (LEP)
  - text: Farm animals and livestock
links:
  - url: https://www.vtassociationofcommunityhealthworkers.com/
    label: Community Health Worker
    page: '54'
  - url: https://bistatepca.org/centers/
    label: Community Health Center
    page: '54'
  - url: https://vtfreeclinics.org/find-a-clinic/
    label: Free Clinic
    page: '54'
  - url: https://dcf.vermont.gov/doc/contacts/partners/aaa
    label: https://dcf.vermont.gov/doc/contacts/partners/aaa
    page: '55'
  - url: https://drive.google.com/drive/folders/1if3D-wTHEf1hYUKyJk9w0EeX5ZSUi3Q-?usp=drive_link
    label: Limited English Proficiency Documents
    page: '56'
  - url: https://docs.google.com/document/d/1Is0po3dbNMNl56RA0zm1ARid5JoWtv-ZUnPgr__oGOM/edit?usp=sharing
    label: organizations and groups
    page: '56'
  - url: https://drive.google.com/file/d/1NWSRoDXt7IR8wDNnoC1lyebI9vkCJZ4R/view?usp=drive_link
    label: list of organizations and people
    page: '56'
  - url: https://docs.google.com/document/d/1JwdvySyIuOi1SlBlFE7KF3Eh09IAmzPp289-Zlqu-O0/edit?usp=sharing
    label: list of resources
    page: '56'
  - url: https://www.aalv-vt.org/interpreter
    label: AALV
    page: '56'
  - url: https://www.languageline.com/
    label: LanguageLine
    page: '56'
  - url: https://www.whatsapp.com/
    label: WhatsApp
    page: '56'
  - url: https://docs.google.com/document/d/135iBbFYDUUojTu9_irbQbnm_s5woAnX5TniHpGRedsY/edit?usp=sharing
    label: procedure
    page: '57'
  - url: https://translate.google.com/
    label: Google Translate
    page: '57'
  - url: https://dcf.vermont.gov/contacts/partners/pcc
    label: Parent Child Centers
    page: '57'
  - url: https://www.vtfoodbank.org/access-food/find-a-food-shelf/
    label: food shelves
    page: '57'
  - url: https://www.vtassociationofcommunityhealthworkers.com/
    label: Community Health Worker
    page: '57'
  - url: https://bistatepca.org/centers/
    label: Community Health Center
    page: '57'
  - url: https://vtfreeclinics.org/find-a-clinic/
    label: Free Clinic
    page: '57'
  - url: https://www.usda.gov/sites/default/files/documents/usda-livestock-preparedness-fact-sheet.pdf
    label: Create a Plan
    page: '58'
  - url: https://www.prep4agthreats.org/Assets/Factsheets/livestock-emergency-preparedness-plan.pdf
    label: Another Plan Template
    page: '58'
  - url: https://www.farmers.gov/
    label: FSA & NRCS Offices
    page: '58'
notes: |
  1-8 is a guide-table page (no DataTable/PlanForm/EditableTable
  components) covering 4 distinct populations across PDF pp54-59
  (workbook displayed pp26-31): Children, the combined
  Senior+Disabilities section, LEP, and Farm animals. The four
  population sub-sections are rendered as <h3> headings; each carries
  its own <table class="guide-table"> with workbook Systems/Stuff
  columns. Citation page '54-59' covers the multi-page span.

  No structural_fidelity assertion: this page renders zero DataTable /
  PlanForm components, so structural_fidelity.table_count cannot be
  asserted (its min(1) constraint applies only to data-bearing
  templates). Citation is wired via an HTML comment at the top of
  src/pages/modules/emergency-preparedness/1-8.astro rather than a
  component prop — same pattern as 1-1/1-2/1-6/1-7.

  Single section-anchor placeholder field above is required by
  sourceSpecSchema (which demands either fields[] or sections[]); 1-8
  has no data-bearing component to map fields to. Replace with real
  field definitions if a future Phase-2 commit wires inventories on
  1-8.

  matching.require_cluster: false because the citation spans 6 PDF
  pages and prose content is column-fragmented across pp55-57 (R10
  drop-cap typography lowers per-prompt bestMatchScore on long
  workbook labels — same justification as 1-7).

  links[] enumerates the 21 ExternalLinks on the page after day-21b
  (10 from day-21 + 11 new):
    - 3 at children-pediatrician (CHW/CHC/Free Clinic)
    - 1 at senior-partners (dcf-aaa)
    - 1 inline on LEP h3 leading <p> (Limited English Proficiency
      Documents folder header — restored as inline link day-21b
      per user choice 2026-04-29; only the 1.8 top-level folder is
      pinned via ModuleLayout button)
    - 1 at lep-partner-orgs (organizations and groups, day-21b)
    - 1 at lep-directory-orgs (list of organizations and people,
      day-21b)
    - 1 at lep-compile-resources (list of resources, day-21b)
    - 1 at lep-interpreter-money (AALV, day-21b)
    - 1 at lep-interpreter-money (LanguageLine, kept verbatim)
    - 1 at lep-whatsapp (whatsapp.com, accept_as_query_param_drift
      per inventory — workbook ?lang=en omitted on site, accepted)
    - 1 at lep-during-train (procedure, day-21b)
    - 1 at lep-translation-tools (translate.google.com, accept query
      param drift)
    - 2 at lep-parent-child-centers (Parent Child Centers + food
      shelves, day-21b — 2 anchors share 1 Todo per workbook prose)
    - 3 at lep-community-health-worker (CHW/CHC/Free Clinic)
    - 2 at farm-plan (Create a Plan + Another Plan Template, day-21b
      — 2 anchors share 1 Todo per workbook bracketed prose)
    - 1 at farm-fsa-nrcs (FSA & NRCS Offices, day-21b)

  Day-21 scope (commit "feat(1-8) part 1") closed:
    - Section split unmerge: site's two h3 sections "Senior citizens
      and elders" + "People with mobility challenges and other
      disabilities" reunified into one workbook-titled h3 (PDF pp55-56);
      moduleKey "seniors-and-disabilities" introduced (canonical-set
      bumped 21→22 in data-preservation.test.ts; old keys
      "senior-citizens" + "people-with-disabilities" remain read-only
      until day-22 IndexedDB migration ships).
    - Invented meta-note paragraph "Note: Much of the guidance for
      seniors..." removed (archive-1-8-disabilities-section-meta-note).
    - Invented service-animals Todo (id="disability-service-animals",
      "Plan for service animals, sight and hearing accommodations")
      removed (archive-1-8-service-animals).
    - 3 URL substitutions corrected at 2 locations each:
      vtassociationofcommunityhealthworkers.com (was healthvermont.gov),
      bistatepca.org/centers/ (was vt211.org/...), vtfreeclinics.org/
      find-a-clinic/ (was vtfreeclinics.org/) — restored on both
      Children pediatrician and LEP After-Disaster sentences. Site URLs
      archived as alt_urls (archive-1-8-{chw,chc,free-clinic}-url-
      substitution).
    - 3 narrative drifts restored verbatim from PDF:
        senior-glasses (drop ", etc."),
        farm-prioritize-safety (drop "/handling" + "possible";
          rejoin "Prioritize Safety." with sentence period not hyphen),
        senior-partners (restore second sentence + dcf-aaa URL —
          archive-1-8-senior-partners-aaa-sentence-drop).
    - InfoCallout removed at top of <ModuleLayout> per decision o
      (archive-1-8-info-callout).

  Day-21b scope (commit "feat(1-8) part 1b: 14 residual class-c
  restorations") closed (path A — user decision 2026-04-29):
    - 3 dropped Seniors Communication items restored as <Todo>
      elements in the merged seniors-and-disabilities Communication
      and Coordination col 1 with new Todo ids `senior-asl`,
      `senior-visual-aids`, `senior-vcil` (workbook PDF p55 verbatim).
      Composite keys verified non-colliding.
    - LEP folder header URL restored as inline ExternalLink wrapping
      "Limited English Proficiency Documents" in the existing <p>
      (per user choice — inline over ModuleLayout button; workbook
      itself renders the LEP folder as in-prose anchor, only the 1.8
      top-level folder is pinned).
    - 7 LEP in-prose anchor drops restored as ExternalLinks within
      existing <Todo> elements: organizations and groups, list of
      organizations and people, list of resources, AALV, procedure,
      Parent Child Centers, food shelves. (Parent Child Centers +
      food shelves share one Todo per workbook prose; 6 distinct
      Todos affected.)
    - 3 Farm in-prose anchor drops restored as ExternalLinks within
      existing <Todo> elements: Create a Plan, Another Plan Template,
      FSA & NRCS Offices. (Create a Plan + Another Plan Template
      share one Todo per workbook bracketed form; 2 distinct Todos
      affected.)
    - LEP item-merging split: `lep-after-access` Todo previously
      merged 2 workbook items into 1 sentence. Split back into 2
      separate <Todo> elements:
        - `lep-after-access` (kept) → "Ensure individuals have access
          to appropriate needs."
        - `lep-after-healthcare` (NEW) → "Do individuals have
          healthcare needs?"
      Existing user check-state on composite key
      `lep-populations-lep-after-access` is preserved (the prompt
      bound to the existing id keeps its semantic meaning).
    Archive entries: 15 appended to docs/site-inventions-archive.yaml
    (3 in dropped_workbook_items_flagged_for_restore; 11 in
    dropped_workbook_links; 1 in invented_prose for the merged form).
    1-8 class_c_count: 14 → 0.

  Day-22 will land the IndexedDB migration that copies user data
  from "senior-citizens" + "people-with-disabilities" into
  "seniors-and-disabilities" (no class-c work in that commit).
---

## Extracted text (first 2000 chars, for review only)

```
1.8 Populations with specific needs
Folder with resources and templates: 1.8 Populations with specific needs

Children, childcare, and youth engagement with disaster
Consider engaging older youth in recovery work—which can build a sense of belonging and connectedness with community in what can be an isolating time. See Section 1.10 on Volunteer Management for more.

Systems / Stuff

Communication and planning
- Make a plan of where to go/who to call if separated...
- Once old enough, have your child memorize their caregiver's phone number
- Create a backpack/go bag that is easy to travel with for the age/size of the kid
- Have conversations about different kinds of disasters...

Essential Items for Go Bags
- Contact/emergency phone numbers...
- Snacks and water
- Infants - formula and diapers
- Comfort item - stuffed animal, etc.
- Entertainment - game, drawing paper/pens
- Two changes of clothes
- Medications
- List of child allergies, if applicable

Community Care and Well-Being
- Locate or create a directory of local childcare providers
- Make time and space to talk with young people...
- If a child has a pediatrician, it is important to connect them...
  reach out to a Community Health Worker to connect them with
  the nearest Community Health Center or Free Clinic
```

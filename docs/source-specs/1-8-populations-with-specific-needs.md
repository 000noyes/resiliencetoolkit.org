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
  - url: https://www.languageline.com/
    label: LanguageLine
    page: '56'
  - url: https://www.whatsapp.com/
    label: WhatsApp
    page: '56'
  - url: https://translate.google.com/
    label: Google Translate
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

  links[] enumerates the 10 ExternalLinks on the page after day-21:
    - 3 at children-pediatrician (CHW/CHC/Free Clinic, restored to
      workbook URLs from prior site-substituted endpoints)
    - 1 at senior-partners (dcf-aaa, restored after sentence_drop
      drift; see archive-1-8-senior-partners-aaa-sentence-drop)
    - 1 at lep-interpreter-money (LanguageLine, kept verbatim)
    - 1 at lep-whatsapp (whatsapp.com, accept_as_query_param_drift
      per inventory — workbook ?lang=en omitted on site, accepted)
    - 1 at lep-translation-tools (translate.google.com, accept query
      param drift)
    - 3 at lep-community-health-worker (CHW/CHC/Free Clinic restored)

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

  Day-21 deferred (still class-c, not closed in this commit):
    - 3 dropped Seniors Communication and Coordination items
      ("Have first responders learn basics of American Sign Language",
       "Include visual aids on important informational resources",
       "Consult with the Vermont Center for Independent Living when
        creating emergency plans") — workbook PDF p55, dropped from
      site, decision 1a_restore_as_Todos.
    - LEP folder header URL (Limited English Proficiency Documents,
      site renders as plain <p>) — decision
      1a_restore_as_inline_link_or_layout_button.
    - 8 LEP in-prose link drops (organizations and groups; list of
      organizations and people; list of resources; AALV; procedure;
      Parent Child Centers; food shelves) — decision
      1a_restore_as_Todo_plus_ExternalLink.
    - 3 Farm in-prose link drops (Create a Plan; Another Plan
      Template; FSA & NRCS Offices) — decision
      1a_restore_as_Todo_plus_ExternalLink.
    - LEP item-merging (lep-after-access merges 2 workbook items into
      1 site Todo) — decision 1a_split_back_into_2_Todos.
    Need a follow-up "feat(1-8) part 1b" commit (or expanded part 2)
    before 1-8 class_c_count reaches 0. Pending user direction —
    closeout doc row-21 description was narrower than the residual
    1-8 fidelity work; closeout doc row-22 is migration-only.

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

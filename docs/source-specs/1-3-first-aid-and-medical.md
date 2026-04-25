---
module: 1-3
template: first-aid-and-medical
title: First aid and medical
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '42'
fields:
  - key: section-anchor
    label: First aid and medical
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Information to collect
  - text: First Aid Supplies
  - text: Medications
  - text: Equipment
links:
  - url: https://drive.google.com/drive/folders/1HI-sf3QQdYHHr7g3w4OCi1zFTQ6HBMkH
    label: 1.4 First aid and medical
    page: '42'
  - url: https://drive.google.com/file/d/1xVIJEWpkQT6K5mp-9DUn-mR3T5GWQ2bt/view?usp=drive_link
    label: Create (and circulate!) a list
    page: '42'
  - url: https://www.aedgrant.com/
    label: https://www.aedgrant.com/
    page: '42'
notes: |
  1-3 is a guide-table page (not a directory or form). The four subsections —
  Information to collect (Systems col), First Aid Supplies, Medications, and
  Equipment (Stuff col) — are rendered as <strong> labels inside <p> or directly
  in <td>, so they do not surface as <h2>/<h3> headings in extractHeadings;
  subheadings[] above are documented for the audit trail.

  No structural_fidelity assertion: this page renders zero DataTable / PlanForm
  components, and structural_fidelity.table_count has a min(1) constraint in the
  spec schema (counting "no data-bearing components" is not currently
  expressible). Day-8's 1-2 spec made the same decision; revisit if a future
  module also needs table_count=0.

  Citation is wired via an HTML comment at the top of
  src/pages/modules/emergency-preparedness/1-3.astro rather than a component
  prop, since no DataTable / PlanForm exists on this page.

  Folder-header label is the workbook's verbatim "1.4 First aid and medical".
  Upstream workbook contains a typo in this header (section is 1.3, not 1.4);
  see docs/toolkit-inventory.yaml entry for 1-3, workbook_typo_note. Site
  fidelity preserves the workbook label as-is rather than silently fixing the
  typo. The folder-header inline rendering pattern is also surfaced via the
  ModuleLayout "See Additional Resources" action-bar button driven by
  src/data/downloads.ts.moduleDownloads[].resourcesUrl; whether inline +
  page-chrome is redundant or complementary is pinned for design review per
  the inventory walk's folder_header_pattern.decision.

  The InfoCallout ("How this works…" UX meta-instruction) is removed from this
  page in the same commit per the class-c firewall (no source citation;
  user-instruction text not present in the cited workbook range). Same removal
  pending across 1-1 / 1-5 / KYC in a follow-up 1a sweep (1-2 done day-8).

  The site-invented h2 "First aid preparedness" is also removed in the same
  commit per inventory walk decision 1a_remove (workbook has no such
  sub-heading; ModuleLayout already renders the section title).

  Plural restoration: site Todo "rescue squad" → "rescue squads" per workbook
  verbatim (inventory walk paragraph_drift entry, drift_type plural_drop,
  decision 1a_restore_verbatim). The Todo's prose is not checked by
  proseMatches (Todo is a JSX component, not <p>/<li>); fix is applied for
  fidelity, not for the verify check.

  Single placeholder field above is required by the spec schema
  (sourceSpecSchema requires either fields[] or sections[]); 1-3 has no
  data-bearing component to map fields to. Keep this entry as-is until/unless
  a future Phase-2 commit wires inventories on 1-3, at which point the
  placeholder is replaced with real field definitions.
---

## Extracted text (first 2000 chars, for review only)

```
​1.3 First aid and medical​
​Folder with resources and templates:​                                1.4 First aid and medical
 ​Systems​                                                            ​Stuff​

        ​ onnect with First​
        C                                                             ​ uild and store first aid kits, AEDs across the community.​
                                                                      B
        ​Responders and/or rescue​                                    ​First Aid Supplies:​
         ​squads that serve your area.​                                        ​Adhesive and elastic bandages (multiple sizes)​
          ​Types of services: fire​                                             ​Emergency bandages, sterile gauze and adhesive tape​
           ​departments, first responders​                                       ​Antiseptic wipes and solution​
            ​(EMTs, back country rescue,​                                         ​(Povidone-Iodine/chlorhexidine)​
             ​etc), ambulance transport​                                           ​Antibiotic ointment (Neosporin)​
              ​Create (and circulate!) a list​​of​                                  ​A&D Burn ointment​
               ​local emergency response​
                                                                                     ​Tweezers & blunt scissors​
                ​numbers for acute crises and​
                                                                                      ​CPR face shield​
                 ​if 911 services are down -​
                  ​identify local paid and​                                            ​Latex gloves (many pairs/sizes)​
                   ​volunteer first​                                                    ​Alcohol pads & cotton swabs​
                    ​responders/agencies.​                                               ​Tourniquet(s)​
                     ​Information to collect​                    
```

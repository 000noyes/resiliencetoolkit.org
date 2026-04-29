---
module: 1-11
template: flood-recovery-supplies-and-work
title: Managing flood site and survivor information
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '73-77'
fields:
  - key: section-anchor
    label: Flood recovery supplies and work
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Managing flood recovery supplies
links:
  - url: https://docs.google.com/spreadsheets/d/1sJ-inMiVKj5SWsCukg_IimgWcA4oQLVWkbg6lAxcI3E/edit?gid=825618087#gid=825618087&range=A14:D14
    label: flood survivor/site sheet or tracking system
    page: '73'
  - url: https://www.healthvermont.gov/lab/forms
    label: healthvermont.gov/lab/forms
    page: '73'
  - url: https://drive.google.com/file/d/1EYIHSzBZjEisON-7tjwueVQ1OS1EcCqs/view?usp=drive_link
    label: House Gutting
    page: '74'
notes: |
  1-11 is a 2-h3 prose page (Managing flood site and survivor information,
  Managing flood recovery supplies) followed by a large guide-table with 4
  full-width row-headers (Pumping, Mucking, Gutting, Mold remediation) and
  72 verbatim Todos across 9 stuff sub-headings. The h3s are the structural
  anchors picked up by extractHeadings; the guide-table row-headers are
  rendered as <strong> labels inside <tr><td colspan="2"> — they do NOT
  surface as h2/h3 and so are NOT in subheadings[] (same pattern as 1-1 / 1-2
  / 1-6 / 1-7 guide-table modules).

  Per R15 (titleMatches: spec.title MUST be one of the h-tag values when h-tags
  exist on the page), spec.title is "Managing flood site and survivor
  information" — the first h3 on the page. The second h3 ("Managing flood
  recovery supplies") is in subheadings[].

  links[] enumerates the 3 in-prose workbook URLs surfaced inline on the site
  as <ExternalLink> after this commit's day-23 restoration:
    - flood survivor/site sheet (cell-level Google Sheet link with gid+range
      preserved on site)
    - healthvermont.gov/lab/forms (water testing kits — the URL text IS the
      anchor)
    - House Gutting (Drive file, restored day-23 — wraps the bold subsection
      label "House Gutting" within the Gutting subsection definition paragraph;
      distinct from the section folder URL)

  Four other workbook anchors on this page are intentionally NOT in spec.links[]:
    - 1vszckj Drive folder header ("Folder with resources and templates: 1.11
      Flood recovery supplies and work") — `on_site:
      surface_via_module_layout_button   # pinned (recurring)`, the deferred
      folder-header pattern.
    - Pumping subsection re-link to folder — `on_site: false`,
      `decision: pin_with_folder_header` (3 of 4 subsection re-links share
      the folder URL, pinned for design-review under the folder-header group).
    - Mucking subsection re-link to folder — same as Pumping.
    - Mold remediation subsection re-link to folder — same as Pumping.
  Including any of these in spec.links[] would trigger linksMatch failure since
  the URLs are not present in src/pages/modules/emergency-preparedness/1-11.astro
  (the Pumping/Mucking/Mold remediation row-headers are <strong> labels, not
  ExternalLinks).

  No structural_fidelity assertion: this page renders zero DataTable / PlanForm
  components, and structural_fidelity.table_count has a min(1) constraint.
  Citation is wired via the spec file's citation block; the page itself has
  no spec_id prop.

  The InfoCallout ("How this works…" UX meta-instruction) is removed in this
  same commit per the class-c firewall (decision o; folded into the 1-11 day
  per closeout doc §2 row 23). Same removal completed across 1-1 (day 16),
  1-2/1-3/1-4/1-5 (days 8-11), 1-6 (day 19 second commit), 1-7 (day 20),
  1-8 (day 21), and KYC (day 17). Site-invented form is preserved in
  docs/site-inventions-archive.yaml under invented_prose
  (id: archive-1-11-info-callout, identical text to archive-1-1-info-callout).

  Walked 2026-04-24. SECOND-CLEANEST module after 1-6. 2 class-c items closed
  in this commit (day-23): InfoCallout removal + House Gutting subsection-label
  link restored. 72 Todos verbatim-match. 4 row-headers + 9 Stuff sub-headings
  all match workbook. 2 of 2 wired ExternalLinks (pre-day-23) match workbook
  URLs; the 3rd is added day-23 (House Gutting).
---

## Extracted text (first 2000 chars, for review only)

```
​1.11 Flood recovery supplies and work​
​ older with resources and templates:​ 1.11 Flood recovery supplies and work
F
​This section is focused on flood recovery for homes and other buildings, but can be useful for other disasters.​
 ​These instructions were compiled by NEK Organizing, which has mucked and gutted hundreds of homes in the​
  ​Kingdom.​
   ​Managing flood site and survivor information​
          ​Vermont will tell people to call 211 to report flood damage. While this is helpful and important to have​
           ​state data, relief organizations then have to comb through all 211 calls to find flood survivor data. This​
            ​can be incredibly time consuming, and is a good place for volunteers that cannot do physical labor.​
             ​Create a​​flood survivor/site sheet or tracking system​​that includes information about the site, the​
              ​contact information for the survivors, and any other important information going forward into the​
               ​recovery phase (damage to water, sewer, foundation, etc).​
    ​Managing flood recovery supplies​
                ​Store supplies—for relief, response, recovery—in a place that is dry, flood safe, and accessible by​
                 ​many people. If possible, utilize a lock with a code if possible and have more than one location per​
                  ​town.​
                   ​A cache of pumps, safety equipment, and demolition tools stocked and pre-packed so they’re ready for​
                    ​the four types of work that immediately follow flooding: pumping, mucking, gutting, and mold​
                     ​remediation.​
 ​Systems​                                 ​Stuff​

 ​ umping​
 P
 ​Pumping​​is the process of removing water from the home via sump, trash, and transfer pumps.​
```

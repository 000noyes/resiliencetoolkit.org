---
module: 1-10
template: volunteer-management
title: Recruiting volunteers
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '69-70'
fields:
  - key: section-anchor
    label: Volunteer management
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Setting up volunteer shifts
  - text: Potential volunteer tasks for flood recovery
  - text: Managing volunteers
links:
  - url: https://humanservices.vermont.gov/about-us/field-services
    label: AHS / VDH regional field Directors can be a conduit to local organizations
    page: '69'
  - url: https://www.signupgenius.com/nonprofit-volunteer-management
    label: SignUp Genius
    page: '69'
  - url: https://docs.google.com/spreadsheets/d/1sJ-inMiVKj5SWsCukg_IimgWcA4oQLVWkbg6lAxcI3E/edit?gid=1323271388#gid=1323271388&range=A9
    label: shareable spreadsheet
    page: '69'
  - url: https://drive.google.com/file/d/1-96IRuEPNE7Sb6WrVZpcyvFvCJRIjo8h/view?usp=drive_open
    label: Youth engagement in flood recovery
    page: '70'
  - url: http://crisiscleanup.org/
    label: Crisis Cleanup
    page: '70'
  - url: https://docs.google.com/document/d/1TNQQW3tC_uiBaEp6ndfhjITBqmlt39CU/edit?usp=drive_link&ouid=106837070816865731479&rtpof=true&sd=true
    label: sign a waiver
    page: '70'
notes: |
  1-10 is a 4-h3 prose page (Recruiting volunteers, Setting up volunteer shifts,
  Potential volunteer tasks for flood recovery, Managing volunteers) with no
  guide-table and no InfoCallout (the workbook page itself has no UX
  meta-instruction; site-1.10 also has none, joining 1-9 as the only
  Emergency Preparedness modules whose pre-day-23 site state already lacked
  the recurring "How this works…" callout).

  Per R15 (titleMatches: spec.title MUST be one of the h-tag values when h-tags
  exist on the page), spec.title is "Recruiting volunteers" — the first h3 on
  the page. The remaining three h3s are listed in subheadings[].

  links[] enumerates the 6 in-prose workbook page-69+70 (displayed pp34-35) URLs
  surfaced inline on the site as <ExternalLink> after this commit's day-23
  restoration:
    - humanservices.vermont.gov AHS/VDH (URL substitution corrected day-23 from
      site's healthvermont.gov contact-us — second member of the 1-8
      topic_branch_vt_resource cluster; archived under alt_urls)
    - SignUp Genius
    - shareable spreadsheet (cell-level sheet link with gid+range preserved)
    - Youth engagement in flood recovery (Drive file, restored day-23)
    - Crisis Cleanup (workbook URL has trailing slash; site has no trailing
      slash; treated as functionally equivalent and not flagged class-c)
    - sign a waiver (waiver template Doc)

  The 7th workbook anchor on this page — the 1QGrMJ Drive folder header
  ("Folder with resources and templates: 1.10 Volunteer Management") — is
  intentionally NOT in spec.links[] because the inventory records it as
  `on_site: surface_via_module_layout_button   # pinned (recurring)` — a
  deferred recurring pattern (the folder URL is meant to be surfaced via a
  ModuleLayout button, not inline like 1-1/1-2). Per R-day-19-second-commit
  rule, including it would trigger linksMatch failure since the URL is not
  present in src/pages/modules/emergency-preparedness/1-10.astro.

  Walked 2026-04-24. 4 class-c items closed in this commit (day-23):
    - AHS/VDH URL substitution restored to workbook URL (alt_url archived)
    - "Youth organizations" sub-list item restored at workbook position
      (between Schools and American Legion)
    - "See Youth engagement in flood recovery for more information…"
      tail sentence + ExternalLink restored on Managing volunteers row 1
    - "Count volunteer hours…" bullet restored at workbook position
      (between Organize-into-work-crews and Feed-volunteers)
  No paragraph-level rewrites on kept content; all drift was missing-item
  structural. 6 ExternalLinks wired on site post-day-23 (all match workbook).
---

## Extracted text (first 2000 chars, for review only)

```
​1.10 Volunteer management​
​Folder with resources and templates:​       1.10 Volunteer Management

​Recruiting volunteers​
       ​Post about volunteer opportunities on Front Porch Forum, social media, and in your local paper.​
        ​See if a local restaurant can provide meals to volunteers.​
         ​Make lists of organizations and individuals in the community who are willing to volunteer and/or willing​
          ​to coordinate volunteers during disaster:​
                  ​Mutual aid and neighbor-to-neighbor networks​
                   ​Local companies that can offer employee volunteer hours​
                    ​Faith communities​
                     ​Schools​
                      ​Youth organizations​
                       ​American Legion​
                        ​Elks Club​
                         ​Rotary Club​
                          ​AHS / VDH regional field Directors can be a conduit to local organizations​

​Setting up volunteer shifts​
        ​SignUp Genius​​is free and helpful for creating volunteer shifts. The paid version allows multiple​
         ​volunteer coordinators to log in; you can cancel payment as soon as you’re done using it. Download​
          ​your data regularly to maintain a contact list. You can also use a​​shareable spreadsheet​​on Google or​
           ​Cryptpad.​
            ​Create specific time slots and tasks for people to help with.​
             ​Be clear on what physical abilities people need to be safe and also helpful.​
              ​Have a diversity of tasks to make space for everyone to engage.​
                     ​Assess if projects are within your team’s “scope” or ability to help.—the home might be gone, it​
                      ​may be structurally unsound or dangerous, you may be unable to get permission from a landlord​
                       ​or homeowner to do work, etc.​

​Potential volunteer tasks for flood recovery​
        ​Holding down the supply/volunteer dispatch hub​
```

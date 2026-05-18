---
module: 0-1
template: knowing-your-community
title: 'Organizing your community: who is here and what are they doing?'
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: 10-23
fields:
  - key: section-anchor
    label: 'Organizing your community'
    type: text
matching:
  require_cluster: false
prose_scope:
  start_line: 1
  end_line: 452
subheadings:
  - text: Mapping your community
  - text: Who is in your community/place?
  - text: What other dynamics are present in your place?
  - text: Stuff and systems in your community
  - text: Knowing your ecosystem
  - text: Bringing people together
  - text: Facilitation guides
  - text: 'Get to know the toolkit: interactive activity'
  - text: Conduct a Community Needs Assessment
  - text: 'We started organizing. How do we know it’s working, and when to ask for more help?'
  - text: 'Going deeper: finding the community work you want to do'
  - text: Pod mapping
links:
  - url: https://drive.google.com/drive/folders/161QG8b0iAJ4yv6O3uGmVyzWMaGrkqkI8?usp=drive_link
    label: 0. Organizing your community
    page: '10'
  - url: http://legislature.vermont.gov/people/
    label: legislature.vermont.gov/people/
    page: '10'
  - url: https://anrmaps.vermont.gov/websites/anra5/
    label: https://anrmaps.vermont.gov/websites/anra5/
    page: '12'
  - url: https://drive.google.com/drive/folders/161QG8b0iAJ4yv6O3uGmVyzWMaGrkqkI8
    label: page of prompts
    page: '14'
  - url: https://drive.google.com/drive/folders/161QG8b0iAJ4yv6O3uGmVyzWMaGrkqkI8
    label: Community Needs Assessment
    page: '14'
  - url: https://drive.google.com/file/d/1G9M25w6kMOXArXlmXuIjOfd0o78tOrTV/view
    label: this zine
    page: '16'
  - url: https://drive.google.com/file/d/1RevfSVj8K8dc4xzxGmdMbIBw3peImK71/view
    label: this list
    page: '16'
  - url: https://drive.google.com/file/d/1H6acuvhgEZG4NDZJ1oIk426me3PmuYZX/view?usp=drive_link
    label: Bay Area Transformative Justice Center
    page: '17'
notes: |
  KYC half-1 spec (day 17 of Step 1 closeout). Covers workbook prose pp10-17.
  The module file src/pages/modules/knowing-your-community.astro is at
  top-level (not under a category subfolder); preserves moduleKeys
  "knowing-community" and "bringing-people-together" verbatim — these
  MUST NOT be renamed (data-preservation invariant).

  Page-range citation pattern: covers Section 0.1 prose pp10-17.
  matching.require_cluster: false applies the documented per-spec opt-out
  (decision k) — page-range citations spanning multiple workbook pages
  cannot satisfy the 50-line cluster heuristic.

  Pods appendix (workbook pp19-23) is NOT rendered inline on the site as of
  v0.0.11.1. The standalone "Pods & Pod Mapping Worksheet" PDF linked from
  the Pod Mapping Worksheet callout contains the full Mia Mingus essay,
  the BATJC POD MAPPING WORKSHEET section, and the graphical worksheet
  diagrams (the prose + diagram are designed to be read together). Inline
  duplication was retired; the appendix is reachable via download. See
  docs/site-inventions-archive.yaml `archive-kyc-pods-appendix-inline-removed`.

  subheadings[] enumerates every workbook heading (h2/h3/h4) the day-17
  restored astro file emits in workbook order. titleMatches gates against
  site-invented headings; the 6 DataTable tableName props ("Place
  Characteristics", "Community Roles", "Community Dynamics", "Stuff and
  Systems", "Knowing Your Ecosystem", "Going Deeper") are still on the
  site as of this spec — they are the half-2 (day-18) target — and are
  NOT in subheadings[] because day 18 will rename each tableName to its
  workbook heading and remove the h3 above.

  Site-chrome callouts (Vermont Town Directory editorial supplement, Pod
  Mapping Worksheet UX chrome) are intentionally NOT in subheadings[] —
  they render as <div> elements with heading-class styling rather than
  <h2>/<h3> so titleMatches never sees them. extractParagraphs is
  similarly bypassed by using <div> inside the callouts so proseMatches
  never sees the editorial copy. Per inventory site_added_links decision
  `promote_as_editorial_supplement` and current_site_state.components_wired
  decision `retain_as_ux_chrome_but_embed_workbook_content_inline`.

  links[] enumerates 8 workbook anchor occurrences across pp10-17 (6 unique
  URLs — the 161QG8b folder is shared by 3 anchors: folder header, "page
  of prompts", and "Community Needs Assessment"). Day-17 wiring restores
  all 8: folder header surfaced as a leading <p>Folder with resources here:
  <ExternalLink>...</ExternalLink></p> line; legislators link wraps the
  URL text in <ExternalLink>; ANR atlas was already wired (kept); page-of-
  prompts + Community Needs Assessment land inside the new Facilitation
  guides section; zine + roles-list anchors gain <ExternalLink> wrappers
  in the Going deeper intro paragraphs; BATJC anchor href is changed from
  https://batjc.org/ (site substitution) to the workbook Pod Mapping
  Worksheet file URL per inventory `decision: 1a_restore_workbook_link`.

  Day 30 (commit a556954) removed the inline "Folder with resources here:"
  `<p>` line as a duplicate of the ModuleLayout "See Additional Resources"
  button affordance. The 161QG8b folder URL is sourced from
  `src/data/downloads.ts` via `getResourcesUrlForSection(sectionData.number)`
  and recognized by the verifier's layout-aware link check (commit 4a9c134).
  The "page of prompts" and "Community Needs Assessment" anchors inside
  the Facilitation guides section continue to wrap the same 161QG8b folder
  URL, so the folder remains reachable via three independent surfaces
  (layout button + two inline anchors).

  prose_scope is set file-wide (start_line: 1, end_line: 452 after the
  v0.0.11.1 Pods-appendix removal) per decision j symmetric-scoping
  retrofit on day 18. The day-18 commit
  added 6 sibling DataTable specs (place-characteristics,
  community-roles, community-dynamics, systems, ecosystem,
  going-deeper) each with a narrow prose_scope window covering only
  its DataTable JSX line range (no <p>/<li> inside, so proseMatches
  no-ops on the day-18 specs). The day-17 (this) spec keeps the
  file-global window so proseMatches still runs across all the
  surrounding workbook prose. Symmetric in the sense that every spec
  on this file now declares an explicit prose_scope, making the
  scoping pattern self-documenting.

  Day-17 commit folds the InfoCallout removal (decision o, half 2) on the
  Mapping your community DataTable's `showInfoCallout={true}` prop. Pairs
  with day-16's 1-1 InfoCallout removal.

  Pod Mapping Worksheet callout is preserved as the canonical surface for
  the Pods appendix. The inline embedding of the Pods appendix narrative
  (previously documented under
  `retain_as_ux_chrome_but_embed_workbook_content_inline`) was retired in
  v0.0.11.1 after verification that the linked download contains the full
  prose + worksheet diagrams together. The callout download link is now
  the load-bearing path; inline prose is intentionally absent.
---

## Extracted text (first 2000 chars, for review only)

```
Organizing your community: who is here and what are they doing?
Folder with resources here: 0. Organizing your community
The first step of organizing your community is thinking about who is in in
it, and the place where you live. You can do this activity alone, but best
to do it with a few other people—friends, colleagues, neighbors.

[…full extraction available in docs/source-specs/_extraction-cache.yaml
under content_hash key for page 10-23 of the master PDF.]
```

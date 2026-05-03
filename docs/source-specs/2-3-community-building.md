---
module: 2-3
template: community-building
title: Business directory
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: 88-90
fields:
  - key: section-anchor
    label: Business directory
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Local and regional governance and coordination
  - text: Institutional allies
  - text: Tradesfolk directory
  - text: Community spokespeople
  - text: De-escalators and conflict facilitators
  - text: Third spaces
  - text: Skill building workshops
  - text: Fun activities that build community
links:
  - url: https://www.vapda.org/
    label: Regional Planning Commissions
    page: '88'
  - url: https://www.vacd.org/conservation-districts/
    label: natural resource conservation districts
    page: '88'
  - url: https://drive.google.com/drive/folders/106ukXkOgMqpIDDVS_mAim3n0QWYJx4_4
    label: Create a directory
    page: '88'
  - url: https://drive.google.com/file/d/184_orTxxvgIbKMqtFFHWhipCtqwyZzGs/view?usp=drive_link
    label: Create a directory of this information.
    page: '88'
  - url: https://drive.google.com/file/d/1ruSfU-WUZ0mi-Hr2yzSRR7QQhtkUTu5u/view?usp=drive_link
    label: Create a directory
    page: '88'
  - url: https://drive.google.com/file/d/1a8iZejQbOW4QDwxzgJtWeyEqztupJgkY/view?usp=drive_link
    label: Develop a media list
    page: '89'
  - url: https://www.ruralvermont.org/activist-toolkit-1
    label: Rural VT Activist Toolkit
    page: '89'
  - url: https://www.vlct.org/resource/effective-testimony-guide-municipal-officials
    label: Vermont League of Cities and Towns
    page: '89'
  - url: https://drive.google.com/drive/folders/106ukXkOgMqpIDDVS_mAim3n0QWYJx4_4
    label: how to intervene in escalating situations.
    page: '89'
  - url: https://drive.google.com/file/d/1U0VtVuH8hfQIf9zjGJyAVPPdSvfHoYpy/view?usp=drive_link
    label: practice conflict management and transformation.
    page: '89'
  - url: https://libraries.vermont.gov/sites/libraries/files/documents/PublicLibraryDirectory.pdf
    label: libraries
    page: '89'
  - url: http://www.vtstategrange.org/vermont-granges.html
    label: grange halls
    page: '89'
  - url: https://www.floodsmart.gov/prepare/minimize-damage
    label: Flood Preparation
    page: '89'
  - url: https://www.redcross.org/take-a-class/train-my-employees
    label: General First Aid and Basic Life Support
    page: '89'
  - url: https://mutualaiddisasterreliefsite.wordpress.com/wp-content/uploads/2017/04/basic_rescue_skills_2003.pdf
    label: Basic Rescue
    page: '89'
  - url: https://trainnek.com/about-us/
    label: Train NEK
    page: '90'
  - url: https://www.nols.edu/en/courses/
    label: NOLS courses
    page: '90'
  - url: https://cms.bleedingcontrol.org/Class/Search
    label: Stop the bleed
    page: '90'
  - url: https://vtcares.org/how-to-use-narcan/
    label: Narcan
    page: '90'
  - url: https://www.are.na/local-directory/radical-mental-health-first-aid
    label: Mental health first aid
    page: '90'
  - url: https://attachments.are.na/27186484/03bcff689a69c106cd91a68bebc381df.pdf?1711408036
    label: Radical Mental Health First Aide (RMHFA) Action Plan
    page: '90'
  - url: https://mutualaiddisasterrelief.org/safety-diy-cleanup/
    label: Examples from Mutual Aid Disaster Relief
    page: '90'
  - url: https://www.vtchamber.com/servsafe/
    label: Safe Food Prep
    page: '90'
  - url: https://openstreetmap.us/get-involved/start-mapping/
    label: Open Street Maps
    page: '90'
  - url: https://drive.google.com/file/d/1jvwkbqaxuct6_xQxSgT1p-WfNcod2d5I/view?usp=drive_link
    label: Conflict de-escalation
    page: '90'
  - url: https://drive.google.com/file/d/1U0VtVuH8hfQIf9zjGJyAVPPdSvfHoYpy/view?usp=drive_link
    label: Conflict management
    page: '90'
  - url: https://drive.google.com/file/d/1nUkRdNmMf4eisAdmVFbGJKiCiEiea6Cv/view
    label: how to host a public assembly
    page: '90'
  - url: https://www.thecivicstandard.org/
    label: Civic Standard
    page: '90'
  - url: https://nekorganizing.org/
    label: NEK Organizing
    page: '90'
  - url: https://hartland.govoffice.com/index.asp?SEC=F4B6B828-2DC9-4153-9BAF-212AAF3965D5&DE=E3079F17-2186-4D40-A9F5-82F8DE844030
    label: Hartland Community Breakfasts
    page: '90'
notes: |
  2-3 is a 9-h2 prose page on workbook PDF pages 88-90 (displayed pages
  43-45) — the LARGEST module in the toolkit by workbook anchor count
  (33 anchors / 32 unique URLs per inventory). 9 h2 sections: Local and
  regional governance and coordination, Institutional allies, Business
  directory, Tradesfolk directory, Community spokespeople, De-escalators
  and conflict facilitators, Third spaces, Skill building workshops, Fun
  activities that build community. The Skill building workshops section
  uses a 2x2+Other guide-table (Flood and disaster response / Recovery
  and Coordination 2-col + Other row colspan="2") following the same
  static-table idiom as 2-2 / 1-6 / 1-7 / 1-11 (presentational
  <table class="guide-table">, NOT a DataTable).

  Per R15 (titleMatches: spec.title MUST be one of the h-tag values when
  h-tags exist on the page), spec.title is "Business directory" — one of
  the 9 h2s on the page. "Business directory" is chosen over the first h2
  ("Local and regional governance and coordination") because the first
  h2 starts with a workbook drop-cap "L" that pdftotext fragments onto a
  separate line ("L" + " ocal and regional governance..."), which drops
  bestMatchScore below 0.85 (R10 — pdftotext drop-cap fragmentation).
  "Business directory" appears contiguously in workbook PDF p88 and
  scores cleanly. The other 8 h2s ("Local and regional governance and
  coordination", "Institutional allies", "Tradesfolk directory",
  "Community spokespeople", "De-escalators and conflict facilitators",
  "Third spaces", "Skill building workshops", "Fun activities that build
  community") are in subheadings[].

  links[] enumerates the 29 in-prose workbook URLs surfaced inline on the
  site as <ExternalLink>, including 2 newly restored anchors in this
  commit (day-25): the Business directory specific-file URL (restored
  from parent-folder URL substitution) and the Tradesfolk directory link
  (restored from plain-text drop). Three workbook anchors are intentionally
  NOT in spec.links[]: the 2.3 Community Building folder header anchor
  (pinned for ModuleLayout button surface — recurring R-day-19 idiom);
  duplicate folder URLs are deduplicated via inline anchor text. The
  business-directory + tradesfolk-directory restorations close 2 of the 3
  class-c items in this module — the third (InfoCallout) is removed in
  this same commit.

  Day-25 paired-light Step-2 namespace restoration (closeout doc §2 row 25):
  removed the recurring InfoCallout (decision o; identical text to the
  archive-1-1 / 1-6 / 1-7 / 1-8 / 1-11 / 1-12 / 2-2 / KYC InfoCallouts);
  restored the Business directory specific-file URL per inventory
  `decision: 1a_restore_workbook_url_strict` (workbook
  https://drive.google.com/file/d/184_orTxxvgIbKMqtFFHWhipCtqwyZzGs/view
  vs site parent folder); restored the Tradesfolk directory link wrap
  per inventory `decision: 1a_restore_as_ExternalLink` (workbook
  https://drive.google.com/file/d/1ruSfU-WUZ0mi-Hr2yzSRR7QQhtkUTu5u/view
  was dropped, rendered as plain text on site). All site-invented
  content archived to docs/site-inventions-archive.yaml under
  invented_prose (archive-2-3-info-callout), alt_urls
  (archive-2-3-business-directory-url-substitution), and
  dropped_workbook_links (archive-2-3-tradesfolk-directory-link-drop).

  No structural_fidelity assertion: this page renders zero DataTable /
  PlanForm components, and structural_fidelity.table_count has a min(1)
  constraint. The on-page Skill building workshops 2x2+Other guide-table
  is a static <table class="guide-table"> (presentational), not a DataTable.

  Citation is wired via an HTML comment at the top of
  src/pages/modules/baseline-resilience/2-3.astro
  (`// source: docs/source-specs/2-3-community-building.md page: 88`) —
  same pattern as 1-1/1-2/1-6/1-7/1-10/1-11/1-12/1-13/2-2.

  Walked 2026-04-24. After day-25 restoration: 0 class-c. LARGEST module
  by URL count, yet very clean fidelity. Running total 131 → 128 across 17
  modules (− 3 closed by 2-3: InfoCallout + business-dir URL sub +
  tradesfolk-dir link drop).
---

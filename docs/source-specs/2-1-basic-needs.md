---
module: 2-1
template: basic-needs
title: Community meals and food distribution
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: 80-81
fields:
  - key: section-anchor
    label: Community meals and food distribution
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Community food production
  - text: Directory of local farmers and producers
  - text: 'Hygiene: Public Showers'
  - text: Ridesharing and carpooling
  - text: Network of community physical and mental health workers
  - text: Network of herbal support
links:
  - url: https://drive.google.com/drive/folders/1ANzQP2YD_PgkS69TxgaUwnUYX-AOsy8I
    label: Create a directory
    page: '80'
  - url: https://www.vtfarmtoplate.com/food-system-map
    label: local producers
    page: '80'
  - url: https://www.vermontgleaningcollective.org/
    label: gleaning networks
    page: '80'
  - url: https://capstonevt.org/find-a-ride
    label: https://capstonevt.org/find-a-ride
    page: '81'
  - url: https://www.driftdusters.com/
    label: Drift Dusters in Derby, VT
    page: '81'
  - url: https://drive.google.com/file/d/1czwqFxN1cCi9HiFqd_Gky2pBd7AUEMEW/view?usp=drive_link
    label: Create a directory
    page: '81'
  - url: https://nekprosper.org/get-involved/flood-recovery-resources/
    label: KURRVE mental health
    page: '81'
  - url: https://vermontcarepartners.org/intake-and-crisis-lines/
    label: Vermont Care Partners
    page: '81'
  - url: https://mentalhealth.vermont.gov/flood
    label: SAMHSA Disaster Distress Helpline
    page: '81'
  - url: https://www.vtassociationofcommunityhealthworkers.com/
    label: Community Health Worker
    page: '81'
  - url: https://vtfreeclinics.org/find-a-clinic/
    label: Free Clinics
    page: '81'
  - url: https://bistatepca.org/centers/
    label: Community Health Centers
    page: '81'
  - url: https://info.healthconnect.vermont.gov/find-local-help/find
    label: Vermont Health Connect Assister
    page: '81'
  - url: https://www.rosecorecollective.org/
    label: Rose Core Collective
    page: '81'
structural_flatten:
  variant: bullet_flatten
  resolution: restored
  archive_id: 2-1-carpooling-initiatives-flatten
structural_fidelity:
  table_count: 0
  description: 'Todo-only page; restored bullet_flatten lives as parent + 3 ml-6 child Todos under todoId carpooling-initiatives (workbook p81 sub-bullets)'
notes: |
  2-1 is a 7-h2 prose page covering community food production, local-producer
  directory, community meals + food distribution, public-shower hygiene,
  ridesharing and carpooling, the community physical + mental health workers
  network, and the herbal-support network — all on workbook PDF pages 80-81
  (displayed pages 40-41). All sections are short narrative + Todo lists; no
  guide-table on this page.

  Per R15 (titleMatches: spec.title MUST be one of the h-tag values when
  h-tags exist on the page), spec.title is "Community meals and food
  distribution" — chosen over the first h2 "Community food production"
  because the latter starts with workbook drop-cap "C" that pdftotext
  fragments below the 0.85 bestMatchScore threshold (R-day-25 mitigation,
  same shape as 2-3 spec.title selection on day-25). "Community meals and
  food distribution" is one of 7 h2s on the page, appears contiguously in
  PDF text and scores cleanly. The other 6 h2s (Community food production,
  Directory of local farmers and producers, Hygiene: Public Showers,
  Ridesharing and carpooling, Network of community physical and mental
  health workers, Network of herbal support) are in subheadings[]. Three
  of those 6 (Community food production, Directory of local farmers and
  producers, Ridesharing and carpooling) are drop-cap-fragmented in
  pdftotext output but verify-against-source titleMatches treats them as
  matching (proseMatches has token-recall fallback for drop-cap
  fragmentation; subheadings[] is matched via that path).

  Day-26 restorations on 2-1.astro:
    - InfoCallout removed (recurring sweep, decision o)
    - Mental Health section title restored from "Network of mental health
      workers" to workbook canonical "Network of community physical and
      mental health workers"
    - 4 dropped Mental Health items restored as new Todos with workbook
      ExternalLinks (CHW, Free Clinics + Community Health Centers, Vermont
      Health Connect Assister, primary-care-provider) — additive moduleKey
      composites, no fixture impact
    - community-clinic Todo partial sentence restored: ", and partner with
      your local Department of Health office" (9 words appended)
    - 2 "Can" prefix drifts removed; "Take note if they can:" parent prefix
      restored (appended to mental-health-directory Todo); 4 Mental Health
      children Todos indented under ml-6 wrapper (parent + ml-6 children
      same shape as 2-2 day-25 tool-library un-flatten)
    - 3 URL substitutions restored to workbook canonical:
        - SAMHSA Disaster Distress Helpline (mentalhealth.vermont.gov/flood,
          anchor restored from "VTSOS - VT Starting over Strong"; topic-branch
          candidate archived for forward-compat alongside other VT-specific
          alt-URLs)
        - Drift Dusters .com TLD (host restored from .org)
        - Vermont Care Partners /intake-and-crisis-lines/ path (path
          restored — site dropped to homepage)

  Folder-header link mode: surface_via_module_layout_button (pinned via
  ModuleLayout — the same 1ANzQP2YD Drive folder URL that 4 in-prose
  "Create a directory" anchors reuse). Per R-day-19-second-commit, folder
  header link mode is per-module — 2-1 surfaces via ModuleLayout button
  only (excluded from spec.links[]). The 4 in-prose anchor instances
  remain in spec.links[] under the directory URL with label "Create a
  directory" (one canonical entry covers the recurring anchor pattern).

  Total 14 link entries cover the ~18 ExternalLink instances on the page
  (4 "Create a directory" instances at the folder URL collapse to one
  entry; the rest are unique URL+label pairs).
---

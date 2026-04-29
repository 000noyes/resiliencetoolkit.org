---
module: 2-2
template: shared-tools
title: Tool lending library
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '86'
fields:
  - key: section-anchor
    label: Tool lending library
    type: text
matching:
  require_cluster: false
subheadings:
  - text: Tech lending library
  - text: Internet and phone access
links:
  - url: https://www.shareable.net/library-of-things-toolkit/#anchor_Section%2011:%20Workshops%20and%20classes
    label: Library of Things toolkit from Shareable
    page: '86'
  - url: https://myturn.com/
    label: myTurn
    page: '86'
  - url: https://www.toollibraryalliance.org/
    label: Tool Library Alliance
    page: '86'
  - url: https://drive.google.com/drive/folders/1vd2qaanne9Wq_zeYnVMbqWXNONe2vG0C
    label: Create a directory of available items.
    page: '86'
  - url: https://libraries.vermont.gov/sites/libraries/files/documents/PublicLibraryDirectory.pdf
    label: libraries
    page: '86'
  - url: https://docs.engnroom.org/digital-resilience-hub/meaningful-connectivity/alternative-tech-tools-for-knowledge-sharing/mesh-and-community-networks
    label: Mesh Networks
    page: '86'
  - url: https://fognet.me/
    label: Fognet
    page: '86'
  - url: https://meshtastic.org/docs/introduction/
    label: Meshtastic
    page: '86'
  - url: https://www.youtube.com/watch?v=BpSkjRKGxyc
    label: DIY Cellular Signal Booster
    page: '86'
  - url: https://docs.engnroom.org/digital-resilience-hub
    label: More Information on digital resilience here.
    page: '86'
notes: |
  2-2 is a 3-h2 prose page (Tool lending library, Tech lending library,
  Internet and phone access) on workbook PDF page 86 (displayed page 42).
  All 3 sections are short narrative + Todo lists; the Tech lending library
  section uses a 2-column guide-table (Systems / Stuff) following the same
  static-table idiom as 1-1 / 1-2 / 1-6 / 1-7 / 1-11 (i.e. presentational
  <table class="guide-table">, NOT a DataTable component).

  Per R15 (titleMatches: spec.title MUST be one of the h-tag values when
  h-tags exist on the page), spec.title is "Tool lending library" — the
  first h2 on the page. The other two h2s ("Tech lending library",
  "Internet and phone access") are in subheadings[].

  links[] enumerates the 10 in-prose workbook URLs surfaced inline on the
  site as <ExternalLink>. These match workbook anchors 2-11 in
  inventory.workbook_anchor_urls (the folder header anchor 1 is pinned for
  ModuleLayout button surface per R-day-19-second-commit; same as
  1-10/1-11/1-12/1-13).

  Day-25 paired-light Step-2 namespace restoration (closeout doc §2 row 25):
  removed the recurring InfoCallout (decision o; identical text to the
  archive-1-1 / 1-6 / 1-7 / 1-8 / 1-11 / 1-12 / 2-3 / KYC InfoCallouts) and
  un-flattened the Tool lending library "Read up on best practices..."
  parent + 4 sub-bullets that the site had merged into a single Todo with
  editorial glue ("See also:" and "for lots of resources"). All editorial
  drift archived to docs/site-inventions-archive.yaml under invented_prose
  (archive-2-2-info-callout, archive-2-2-tool-library-research-flatten).
  Sub-bullets are restored as 4 separate Todos at <div class="ml-6"> indent
  beneath the parent Todo, preserving the workbook's parent/child structure.

  No structural_fidelity assertion: this page renders zero DataTable /
  PlanForm components, and structural_fidelity.table_count has a min(1)
  constraint. The on-page guide-table (Tech lending library Systems/Stuff)
  is a static <table class="guide-table"> (presentational), not a DataTable.

  Citation is wired via an HTML comment at the top of
  src/pages/modules/baseline-resilience/2-2.astro
  (`// source: docs/source-specs/2-2-shared-tools.md page: 86`) — same
  pattern as 1-1/1-2/1-6/1-7/1-10/1-11/1-12/1-13.

  Walked 2026-04-24. After day-25 restoration: 0 class-c. Tied with 1-6 and
  1-11 as cleanest module after closure. Running total 134 → 131 across 17
  modules (− 3 closed by 2-2: InfoCallout + tool-library-research flatten +
  editorial-additions-merged-into-flatten).
---

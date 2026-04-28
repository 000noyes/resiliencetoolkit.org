# Source specs — author's guide

A source spec is a YAML-front-matter Markdown file in `docs/source-specs/`
that asserts: "the wired component for module X, template Y MUST render
exactly the workbook content cited at this page (or page range), and
nothing else." The verify runner (`pnpm verify`) reads each spec, parses
the cited PDF region, walks the wired Astro/React component, and emits
one report entry per drift it finds.

This file documents the spec format itself and the matching opt-outs
authors will need when their citation pattern doesn't fit the default.

## Minimum spec

```yaml
---
module: 1-2
template: food-and-water
title: Food and water
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '35-36'
fields:
  - key: section-anchor
    label: Food and water
    type: text
notes: |
  Plain-prose explanation of what this spec covers and any author decisions
  the runner cannot infer from the schema alone.
---

## Extracted text (first 2000 chars, for review only)
```

`module` matches the section number on the workbook (e.g. `1-2`,
`1-9`). `template` is a kebab-case slug for the wired component on that
module page (`food-and-water`, `leader-directory`). `citation.page` is
either a single page (`'35'`) or a hyphenated range (`'62-66'`). Either
`fields` (a flat list) or `sections` (grouped) is required, never both.

## Multi-table-per-file: `tableId`

When a single module page renders multiple `<DataTable>` components with
the same column count (e.g. `1-9.astro` carries a 4-column Leader
directory and a 4-column Neighbor directory), the runner cannot match a
spec to a specific table by column count alone. Set `tableId` on the
spec to the value of the `tableId` prop on the wired DataTable:

```yaml
module: 1-9
template: leader-directory
tableId: leader-directory
```

Match is case-sensitive and exact. When `tableId` is set, a missing or
renamed table emits `key_drift` rather than passing silently — that's the
intended firewall against accidental table removal. Specs that target a
single-table file (1-2, 1-3, 1-4, 1-5) do not need to declare `tableId`.

## Page-range citations: `matching: { require_cluster: false }`

The runner uses a short-label cluster heuristic to detect column header
rows ("Name", "Phone", "Email") in extracted PDF text. By default it scans
the first 50 candidate lines of the cited page. When a citation covers a
range of pages that includes both prose pages and a template page (e.g.
`62-66` covering Section 1.9 prose pp. 62-63 plus the Leader template
page 66), the short labels fall past the 50-line cap and the cluster
heuristic false-fails.

Per-spec opt-out:

```yaml
matching:
  require_cluster: false
notes: |
  page range covers Section 1.9 prose pp. 62-63 + Leader template p. 66 —
  short column labels fall past extractCandidateLines cap, cluster check
  bypassed for this spec.
```

The `notes` one-liner is required when `require_cluster: false` is set.
It documents the citation pattern for the next reader and prevents the
opt-out from drifting into a permanent escape valve. Do not raise the
global `extractCandidateLines` cap as a workaround — that inflates verify
runtime and masks real bugs in other specs.

## Multi-citation-per-file: `prose_scope`

Files that render multiple specs against the same component file (1-9
again — Leader, Neighbor, First Responder) used to triple-count any
drifted paragraph because `proseMatches` ran file-global per spec. Set
`prose_scope` to a 1-indexed line range in the wired component file so
each spec only flags drift in its own window:

```yaml
prose_scope:
  start_line: 30
  end_line: 60
```

Either bound is independently optional — `start_line` only opens the
window from a known head, `end_line` only closes it at a known tail. When
absent (default), `proseMatches` runs file-global. Specs that own a
single-citation file do not need `prose_scope`.

## Scaffolding new specs

```bash
pnpm scaffold-spec --pdf <path-to-pdf> --page <range> --module <N-N> --template <slug>
```

writes a stub spec to `docs/source-specs/<module>-<template>.md` with the
extracted text pre-populated. Hand-edit the stub to fill real field
labels, subheadings, and any of the opt-outs above. Run `pnpm verify`
locally to confirm the spec passes before committing.

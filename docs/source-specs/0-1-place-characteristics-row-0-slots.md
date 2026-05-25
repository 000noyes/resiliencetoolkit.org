---
module: 0-1
template: place-characteristics-row-0-slots
title: Mapping your community
citation:
  source: public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf
  page: '10'
fields:
  - key: section-anchor
    label: Mapping your community
    type: text
matching:
  require_cluster: false
prose_scope:
  # Provisional ranges — recomputed and pinned in phase (iv) after the
  # knowing-your-community.astro edit lands. These placeholders intentionally
  # cover the expected post-edit SlotCollection band so phase (ii) commits
  # in a non-verify-failing state; phase (iv) re-pins the exact values from
  # the actual diff.
  start_line: 46
  end_line: 55
structural_flatten:
  variant: slot_flatten
  resolution: restored
  archive_id: 0-1-place-characteristics-row-0-flatten
  expected_component_count: 3
structural_fidelity:
  table_count: 1
  scope_id: place-characteristics-row-0-slots
  description: 'SlotCollection restoring 3-slot structure under scope_id place-characteristics-row-0-slots (workbook p10 "1: 2: 3:" enumeration). Scoped via structural_fidelity.scope_id rather than top-level spec.tableId so keysMatch stays silent against the missing DataTable with that identity.'
notes: |
  Substrate restore spec for the place-characteristics row-0 3-slot
  enumeration. Pairs with 0-1-place-characteristics.md which covers the
  remaining 3 DataTable rows (challenges/assets/thriving) under the
  sibling DataTable tableId "place-characteristics".

  structural_fidelity is scoped via `scope_id: place-characteristics-row-0-slots`
  rather than a top-level `tableId:` field. Reason: the wired component is
  a SlotCollection, not a DataTable. Setting spec-level tableId would trip
  keysMatch into emitting `key_drift` ("spec.tableId 'X' has no matching
  DataTable in <file>"; runner-checks.ts:346-358) because
  extractDataTables only ingests DataTable nodes. PR 0's scope_id field
  (schemas.ts:130-148) was introduced for exactly this case — to scope
  structural_fidelity to a SlotCollection or PlanForm identity without
  triggering keysMatch.

  expected_component_count: 3 is asserted in this spec; runtime enforcement
  is deferred to PR C. The SlotCollection emits data-slot-count={count}
  on its root <fieldset> as the future-PR-C verifier hook.

  Slot label enumeration is workbook-verbatim "1:" "2:" "3:" with colons
  (NOT periods). Workbook p10 renders the 3-slot prompt as a counted
  enumeration with colon glyphs; the SlotCollection component renders
  <label> children matching the workbook glyphs. Source-fidelity HARD
  INVARIANT — design decision D1 in
  .gstack-persistent/projects/000noyes-resiliencetoolkit.org/design-decisions-pr-b-slot-collection-2026-05-25.md.

  matching.require_cluster: false — same single-token cluster rationale as
  the sibling 0-1-place-characteristics.md (single placeholder anchor;
  clustering is structurally impossible with 1 field).
---

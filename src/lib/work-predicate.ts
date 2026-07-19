/**
 * The saved-work predicate.
 *
 * A DataTable row bundles the template question (a `readonly` column defined in
 * the module `.astro`) with the person's answer (an input column). So a blank
 * scaffold row — the template question present, the answer empty — is NOT saved
 * work, even though it holds a non-empty cell. Counting "any non-empty value in
 * `data`" over-counts these rows (restoring the 2026-07-04 legacy backup shows
 * 39 empty scaffold rows as saved work while progress reads 0).
 *
 * `rowHasWork` is the single predicate every counting surface shares, so the
 * meter, the progress views, and (on the backup branch) the cue/snapshot all
 * agree on what a saved row is. It looks only at the input columns.
 *
 * `TABLE_INPUT_COLUMNS` names the input (non-readonly) columns for every
 * template-bearing table. Tables with no template column (PlanForm `{value}`
 * rows, directories with no readonly column) are absent by design: they fall
 * through to "any non-blank cell counts", which is correct for them and only
 * ever over-counts, never under-counts. The exact-coverage test in
 * `work-predicate.test.ts` pins the map to the rendered `.astro` columns so a
 * template table can never be silently omitted (which would over-count) or
 * given the wrong keys (which would under-count real work).
 *
 * Keyed `${moduleKey}-${tableId}`, matching the composite IDs storage already
 * uses (`${moduleKey}-${tableId}-${rowId}`). moduleKeys never rename, so these
 * keys are stable.
 */

/** The minimal row shape the predicate reads; `TableRow` satisfies it. */
export interface WorkRow {
  moduleKey: string;
  tableId: string;
  data: Record<string, string>;
}

/**
 * Input (non-readonly) column keys per template-bearing table. ONLY tables that
 * ship a `readonly` template column belong here. Derived from the DataTable
 * definitions in `src/pages/modules/**` and enforced exact by the coverage
 * test — update both together.
 */
export const TABLE_INPUT_COLUMNS: Record<string, string[]> = {
  // knowing-your-community.astro (moduleKey "knowing-community")
  'knowing-community-place-characteristics': ['Your Response'],
  'knowing-community-community-roles': ['Name(s)'],
  'knowing-community-community-dynamics': ['Your Response'],
  'knowing-community-systems': ['Your Response'],
  'knowing-community-ecosystem': ['Your Response'],
  'knowing-community-going-deeper': ['Your Response'],
  // emergency-preparedness/1-9.astro (moduleKey "community-emergency-response")
  'community-emergency-response-leader-directory': ['name', 'phone', 'email'],
};

/**
 * True when the row holds saved work: at least one input column has a non-blank
 * (trimmed) value. For a template-bearing table the input columns come from the
 * map; otherwise every column counts (fall-through).
 */
export function rowHasWork(row: WorkRow): boolean {
  const inputKeys = TABLE_INPUT_COLUMNS[`${row.moduleKey}-${row.tableId}`];
  const keys = inputKeys ?? Object.keys(row.data);
  return keys.some((k) => (row.data[k] ?? '').trim().length > 0);
}

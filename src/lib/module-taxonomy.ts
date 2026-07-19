/**
 * The module taxonomy: which leaf modules roll up under which of the three
 * top-level modules, and in what order. One shared source so the dashboard's
 * two work surfaces cannot drift: "Your progress" (navigation) and the safety
 * card's "Work on this device" meter (the backup ledger) both group and order
 * the same way. Keep this in sync with the moduleKeys the app writes; it is a
 * display grouping only and never touches stored data.
 */

/** The three top-level modules, in the fixed order both surfaces present. */
export const PARENT_ORDER: readonly string[] = [
  'knowing-your-community',
  'emergency-preparedness',
  'baseline-resilience',
];

/** Display name for each top-level module key. */
export const PARENT_NAMES: Record<string, string> = {
  'knowing-your-community': 'Knowing Your Community',
  'emergency-preparedness': 'Emergency Preparedness',
  'baseline-resilience': 'Baseline Resilience',
};

const EMERGENCY = new Set([
  'emergency-preparedness-kits', 'food-and-water', 'first-aid-medical', 'power-supply',
  'warming-cooling-shelter', 'vehicles-equipment', 'sanitation-hygiene', 'children-disaster',
  'senior-citizens', 'people-with-disabilities', 'lep-populations', 'farm-animals',
  'flood-recovery', 'mutual-aid',
]);
const BASELINE = new Set(['basic-needs', 'shared-tools', 'community-building']);
const KNOWING = new Set(['knowing-community', 'bringing-people-together']);

/**
 * The top-level module a leaf moduleKey belongs to. A key that is itself a
 * top-level module, or one not in any set (an unknown or test key), maps to
 * itself so it forms its own single-member group rather than vanishing.
 */
export function parentOf(k: string): string {
  if (k === 'emergency-preparedness' || EMERGENCY.has(k)) return 'emergency-preparedness';
  if (k === 'baseline-resilience' || BASELINE.has(k)) return 'baseline-resilience';
  if (k === 'knowing-your-community' || KNOWING.has(k)) return 'knowing-your-community';
  return k;
}

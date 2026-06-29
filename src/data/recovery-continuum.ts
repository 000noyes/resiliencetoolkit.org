/**
 * Recovery Continuum data — the five-phase FEMA Disaster Recovery Continuum,
 * recreated as toolkit wayfinding.
 *
 * Structure (NOT activity prose) is recreated from the FEMA National Disaster
 * Recovery Framework, Recovery Continuum (Figure 1): five phases on one curve,
 * Disaster as the pivot between Preparedness and recovery. The three recovery
 * columns carry flood-relevant, generic NDRF activities, each attributed via its
 * `source` and cross-walked to a toolkit module only where one genuinely matches.
 * This is recreated EXTERNAL reference content, never the pg164 contamination text.
 *
 * Color is decided in RecoveryContinuum.astro from `nodeStyle` + position, so this
 * file carries NO Tailwind class strings and imports NEITHER the modules.ts
 * `phaseColors` map (older Before=blue mapping, inverts the brand) NOR ModuleLayout.
 */

/** A single attributed recovery activity sitting in one of the three recovery columns. */
export interface RecoveryActivity {
  /** Flood-relevant, generic activity recreated from NDRF Figure 1. */
  text: string;
  /** Non-empty attribution — every activity traces to a named source. */
  source: string;
  /** Optional cross-walk to a real toolkit module route, only where one genuinely matches. */
  moduleHref?: string;
}

/** Visual role of a phase's node on the curve. Color is derived from this, never passed as a class. */
export type NodeStyle = 'filled' | 'mix' | 'midpoint' | 'open' | 'pivot';

export interface RecoveryPhase {
  /** Stable id (also the per-phase anchor on the mobile stack). */
  id: string;
  /** Phase name (the loud line + the table's Phase column). */
  label: string;
  /** FEMA-derived timeframe (the quiet line + the table's When column). */
  timeframe: string;
  /** Plain-language destination for the parallel table's "Where it takes you" column. */
  where: string;
  /** Node appearance; drives node color/shape internally. */
  nodeStyle: NodeStyle;
  /** Internal /workflows route OR external LTRG destination. Omitted for the Disaster pivot. */
  href?: string;
  /** True for the Long-term LTRG destination (off the /workflows wayfinding). */
  external?: boolean;
  /** True for the Disaster pivot: a neutral tick, not a link, not a node. */
  pivot?: boolean;
  /** Long-term only — drives the open ring + the "help shape this path" affordance. */
  incomplete?: boolean;
  /** Optional accent tag under the node (e.g. "Start here"). */
  lead?: string;
  /** Unique, meaningful accessible link name (never the bare label). */
  linkLabel?: string;
  /** Recovery activities for the three recovery columns (Short-term / Intermediate / Long-term). */
  activities?: RecoveryActivity[];
}

/** Single attribution for every recreated activity (the NDRF Figure 1 source). */
const NDRF = 'FEMA National Disaster Recovery Framework, Recovery Continuum (Figure 1)';

export const recoveryPhases: RecoveryPhase[] = [
  {
    id: 'preparedness',
    label: 'Preparedness',
    timeframe: 'Ongoing',
    where: 'Before a flood workflows',
    nodeStyle: 'filled',
    href: '/workflows/before',
    lead: 'Start here',
    linkLabel: 'Preparedness, ongoing: start with the before a flood workflows',
  },
  {
    id: 'disaster',
    label: 'Disaster',
    timeframe: 'The event',
    where: 'The pivot point, not a destination',
    nodeStyle: 'pivot',
    pivot: true,
  },
  {
    id: 'short-term',
    label: 'Short-term',
    timeframe: 'Days',
    where: 'Responding workflows',
    nodeStyle: 'mix',
    href: '/workflows/response',
    linkLabel: 'Short-term recovery, days: go to the responding workflows',
    activities: [
      { text: 'Mass care and emergency sheltering', source: NDRF, moduleHref: '/modules/emergency-preparedness' },
      { text: 'Clearing primary routes and removing debris', source: NDRF },
      { text: 'Emergency medical care', source: NDRF, moduleHref: '/modules/emergency-preparedness' },
      { text: 'Rapid damage and risk assessment', source: NDRF },
    ],
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    timeframe: 'Weeks to months',
    where: 'Recovering workflows',
    nodeStyle: 'midpoint',
    href: '/workflows/recover',
    linkLabel: 'Intermediate recovery, weeks to months: go to the recovering workflows',
    activities: [
      { text: 'Interim housing', source: NDRF },
      { text: 'Debris removal and infrastructure repair planning', source: NDRF },
      { text: 'Reopening businesses and essential services', source: NDRF },
      { text: 'Build back stronger information and guidance', source: NDRF, moduleHref: '/modules/baseline-resilience' },
    ],
  },
  {
    id: 'long-term',
    label: 'Long-term',
    timeframe: 'Months to years',
    where: 'Long Term Recovery Groups',
    nodeStyle: 'open',
    // The open ring leaves the /workflows wayfinding for the toolkit's town
    // directory map, which finds the Long Term Recovery Group for a town. Marked
    // `external` to the continuum (not a /workflows phase page); rewire to
    // beta.resiliencetoolkit.org when Spawned Initiative #5 builds.
    href: '/map',
    external: true,
    incomplete: true,
    lead: 'Help shape this path',
    linkLabel: 'Long-term recovery, months to years: find your Long Term Recovery Group',
    activities: [
      { text: 'Permanent housing', source: NDRF },
      { text: 'Rebuilding infrastructure for future needs', source: NDRF },
      { text: 'Economic revitalization', source: NDRF },
      { text: 'Comprehensive hazard mitigation', source: NDRF, moduleHref: '/modules/baseline-resilience' },
    ],
  },
];

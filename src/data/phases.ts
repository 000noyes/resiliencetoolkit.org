/**
 * Phases data — the before / during / after "phases of a flood" continuum.
 *
 * Wayfinding only: phases + human-state labels + FEMA-derived timeframes + the
 * internal route for each stop. Carries NO destination Drive/Docs URLs (those
 * live on the phase pages, so the chooser stays migration-proof) and NO Tailwind
 * class strings (color is decided in PhaseSlider by `phase`, so a second caller
 * cannot drift and Tailwind cannot purge a dynamic class).
 *
 * Reuses the canonical Phase type. Do NOT reuse modules.ts `phaseColors` /
 * `phaseDotColors`: those encode the older Before=blue / During=orange / After=green
 * mapping (the homepage-pill semantic), which inverts the brand. PhaseSlider derives
 * its own brand-correct color (orange=Before, green=After) from `phase` internally.
 */
import type { Phase } from '@/data/modules'; // 'Before' | 'During' | 'After'

export interface PhaseStop {
  phase: Phase; // drives node color + position in the component
  marker: string; // short before/during/after eyebrow (the FEMA-continuum read)
  href: string; // internal /workflows route only — no Drive/Docs URLs
  name: string; // human-state lead label (the loud line)
  description?: string; // one-sentence phase description — rendered only when a caller opts in via PhaseSlider's showDescriptions
  time: string; // FEMA-derived timeframe sub-label (the quiet line)
  lead?: string; // optional accent tag under the node (e.g. "Start here")
  incomplete?: boolean; // After only — drives the open-ring + sr-only in-progress affordance
}

export const phaseStops: PhaseStop[] = [
  {
    phase: 'Before',
    marker: 'Before',
    href: '/workflows/before',
    name: 'Preparedness',
    description: 'Map assets, build networks, prepare supplies, and train volunteers before disaster strikes.',
    time: 'Ongoing',
    lead: 'Start here',
  },
  {
    phase: 'During',
    marker: 'During',
    href: '/workflows/response',
    name: 'Response',
    description: 'Coordinate response, track needs, manage volunteers, and communicate with your community.',
    time: 'Day 1 to 2-3 weeks',
    lead: 'If you are in it now',
  },
  {
    phase: 'After',
    marker: 'After',
    href: '/workflows/recover',
    name: 'Recovery',
    description: 'Track recovery progress, support rebuilding, and strengthen long-term community resilience.',
    time: 'Weeks to years',
    lead: 'In progress',
    incomplete: true,
  },
];

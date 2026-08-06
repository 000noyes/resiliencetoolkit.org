/**
 * Landmark-fraction pin resolution (E4).
 *
 * A pin's anchor is {target_id, fx, fy}: a fraction of an authored
 * data-annot landmark region. The island renders each resolved pin INSIDE
 * its landmark at percentage offsets, so pins ride reflow, resize, and even
 * fixed-position landmarks without any coordinate math here. This module
 * decides only (a) which pins can render at all — their landmark exists and
 * the anchor is whole — and (b) a deterministic stack offset for pins placed
 * nearly on top of each other. A thread that cannot resolve degrades to the
 * notes list, never a mispositioned dot.
 */

export interface ThreadAnchor {
  pin_no: number;
  target_id: string | null;
  fx: number | null;
  fy: number | null;
}

export interface PlacedPin {
  pin_no: number;
  target_id: string;
  fx: number;
  fy: number;
  /** How many earlier pins sit within the overlap radius; drives a fixed pixel nudge. */
  stackIndex: number;
}

export interface PinPlacement {
  placed: PlacedPin[];
  unplaced: number[];
}

/** Fraction-space distance below which two pins in one landmark stack. */
const OVERLAP_RADIUS = 0.05;

export function placePins(
  threads: ThreadAnchor[],
  hasLandmark: (targetId: string) => boolean
): PinPlacement {
  const placed: PlacedPin[] = [];
  const unplaced: number[] = [];

  // Pin order makes stacking stable as threads grow: a new pin never
  // reshuffles the offsets of the pins already on the page.
  const ordered = [...threads].sort((a, b) => a.pin_no - b.pin_no);

  for (const thread of ordered) {
    const { pin_no, target_id, fx, fy } = thread;
    if (target_id === null || fx === null || fy === null || !hasLandmark(target_id)) {
      unplaced.push(pin_no);
      continue;
    }
    const stackIndex = placed.filter(
      (p) => p.target_id === target_id && Math.hypot(p.fx - fx, p.fy - fy) < OVERLAP_RADIUS
    ).length;
    placed.push({ pin_no, target_id, fx, fy, stackIndex });
  }

  return { placed, unplaced };
}

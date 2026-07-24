/**
 * Landmark-fraction pin resolution (E4): a pin belongs to an authored
 * data-annot landmark and re-renders at the same fraction of it wherever the
 * landmark reflows, because the island positions pins INSIDE the landmark by
 * percentage. This module only resolves which pins can render (their
 * landmark exists and the anchor is whole) and assigns deterministic stack
 * offsets to near-coincident pins; a missing landmark degrades the thread to
 * the list, never a mispositioned dot.
 */
import { describe, it, expect } from 'vitest';
import { placePins, type ThreadAnchor } from './anchors';

const LANDMARKS = new Set(['hero', 'find-your-path', 'corner-panel']);
const hasLandmark = (id: string) => LANDMARKS.has(id);

function thread(
  pin_no: number,
  target_id: string | null,
  fx: number | null,
  fy: number | null
): ThreadAnchor {
  return { pin_no, target_id, fx, fy };
}

describe('placePins', () => {
  it('resolves a pin to its landmark with the anchor fractions intact', () => {
    const { placed, unplaced } = placePins([thread(1, 'hero', 0.5, 0.25)], hasLandmark);
    expect(unplaced).toHaveLength(0);
    expect(placed).toEqual([{ pin_no: 1, target_id: 'hero', fx: 0.5, fy: 0.25, stackIndex: 0 }]);
  });

  it('an unknown landmark degrades to the thread list, never a guessed position', () => {
    const { placed, unplaced } = placePins(
      [thread(1, 'gone-section', 0.5, 0.5), thread(2, 'hero', 0.1, 0.1)],
      hasLandmark
    );
    expect(placed.map((p) => p.pin_no)).toEqual([2]);
    expect(unplaced).toEqual([1]);
  });

  it('anchors with missing fractions degrade too', () => {
    const { placed, unplaced } = placePins([thread(1, 'hero', null, null)], hasLandmark);
    expect(placed).toHaveLength(0);
    expect(unplaced).toEqual([1]);
  });

  it('near-coincident pins in one landmark stack deterministically', () => {
    const threads = [
      thread(1, 'hero', 0.5, 0.5),
      thread(2, 'hero', 0.51, 0.5),
      thread(3, 'hero', 0.505, 0.495),
    ];
    const first = placePins(threads, hasLandmark);
    const second = placePins(threads, hasLandmark);
    expect(first.placed).toEqual(second.placed);
    expect(first.placed.map((p) => p.stackIndex)).toEqual([0, 1, 2]);
  });

  it('far-apart pins and pins in different landmarks never stack', () => {
    const { placed } = placePins(
      [thread(1, 'hero', 0.1, 0.1), thread(2, 'hero', 0.9, 0.9), thread(3, 'corner-panel', 0.1, 0.1)],
      hasLandmark
    );
    expect(placed.map((p) => p.stackIndex)).toEqual([0, 0, 0]);
  });

  it('stacking is keyed to pin order, so it is stable as threads grow', () => {
    const grown = placePins(
      [thread(1, 'hero', 0.5, 0.5), thread(2, 'hero', 0.5, 0.5), thread(9, 'hero', 0.5, 0.5)],
      hasLandmark
    );
    expect(grown.placed.map((p) => [p.pin_no, p.stackIndex])).toEqual([
      [1, 0],
      [2, 1],
      [9, 2],
    ]);
  });
});

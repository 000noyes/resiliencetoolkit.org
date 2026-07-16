/**
 * useNoticeClaim — the shared claim/release/subscribe/isWinner hook the three
 * React banners consume. Mounted with react-dom/client (no @testing-library
 * dependency) so we can assert the DOM claim keys and the winner subscription.
 *
 * Run: pnpm vitest run src/lib/useNoticeClaim.test.tsx
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { useNoticeClaim } from './useNoticeClaim';
import { claimDatasetKey, DAMPED_FLOOR_DATASET_KEY, type NoticeId } from './notices';

// react-dom needs this flag to run act() without warnings-as-errors.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ALL_IDS: NoticeId[] = ['storageAcute', 'status', 'update', 'storageSoft', 'contact'];
const winners: Record<string, boolean> = {};

function Probe({ id, wants }: { id: NoticeId; wants: boolean }) {
  winners[id] = useNoticeClaim(id, wants);
  return null;
}

interface Harness {
  rerender: (ui: ReactNode) => void;
  unmount: () => void;
  container: HTMLElement;
}

function mount(ui: ReactNode): Harness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root!: Root;
  act(() => {
    root = createRoot(container);
    root.render(ui);
  });
  return {
    container,
    rerender: (next) => act(() => root.render(next)),
    unmount: () => act(() => root.unmount()),
  };
}

beforeEach(() => {
  const ds = document.documentElement.dataset;
  for (const id of ALL_IDS) delete ds[claimDatasetKey(id)];
  delete ds[DAMPED_FLOOR_DATASET_KEY];
  for (const k of Object.keys(winners)) delete winners[k];
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('useNoticeClaim', () => {
  it('claims the slot while wants is true and reports isWinner', () => {
    const h = mount(createElement(Probe, { id: 'update', wants: true }));
    expect(claimDatasetKey('update') in document.documentElement.dataset).toBe(true);
    expect(winners.update).toBe(true);
    h.unmount();
  });

  it('releases the claim on unmount', () => {
    const h = mount(createElement(Probe, { id: 'update', wants: true }));
    expect(claimDatasetKey('update') in document.documentElement.dataset).toBe(true);
    h.unmount();
    expect(claimDatasetKey('update') in document.documentElement.dataset).toBe(false);
  });

  it('releases the claim when wants flips to false', () => {
    const h = mount(createElement(Probe, { id: 'update', wants: true }));
    h.rerender(createElement(Probe, { id: 'update', wants: false }));
    expect(claimDatasetKey('update') in document.documentElement.dataset).toBe(false);
    expect(winners.update).toBe(false);
    h.unmount();
  });

  it('subscribes: a lower strip is not the winner until the higher one releases', () => {
    const tree = (updateWants: boolean) =>
      createElement(
        'div',
        null,
        createElement(Probe, { id: 'contact', wants: true }),
        createElement(Probe, { id: 'update', wants: updateWants }),
      );
    const h = mount(tree(true));
    // update(30) outranks contact(10): update wins, contact yields.
    expect(winners.update).toBe(true);
    expect(winners.contact).toBe(false);

    // update releases; contact's live subscription flips it to the winner.
    h.rerender(tree(false));
    expect(claimDatasetKey('update') in document.documentElement.dataset).toBe(false);
    expect(winners.contact).toBe(true);
    h.unmount();
  });
});

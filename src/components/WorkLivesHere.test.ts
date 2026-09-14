/**
 * WorkLivesHere render tests — the honest "where your work lives" + backup
 * affordance shown on every module page.
 *
 * No RTL in this repo; we assert the static markup via react-dom/server (same
 * approach as SlotCollection.test.ts).
 *
 * Run: pnpm vitest run src/components/WorkLivesHere.test.ts
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkLivesHere, { WorkLivesHereCard, deviceHoldsWork } from './WorkLivesHere';

const cardProps = { backupLine: '', status: 'idle' as const, onBackup: () => {} };

describe('WorkLivesHere', () => {
  it('renders nothing before the device is read: no card and no claim for a reader with no work', () => {
    expect(renderToStaticMarkup(createElement(WorkLivesHere))).toBe('');
  });

  it('counts work the way the dashboard card does: todos, tables, or notes', () => {
    const empty = { todos: [], tables: [], metadata: {} } as unknown as Parameters<typeof deviceHoldsWork>[0];
    expect(deviceHoldsWork(empty)).toBe(false);
    expect(deviceHoldsWork({ ...empty, todos: [{ id: 't' }] } as never)).toBe(true);
    expect(deviceHoldsWork({ ...empty, tables: [{ id: 'x' }] } as never)).toBe(true);
    expect(deviceHoldsWork({ ...empty, metadata: { personalNotes: 'a note' } } as never)).toBe(true);
    expect(deviceHoldsWork({ ...empty, metadata: { personalNotes: '' } } as never)).toBe(false);
  });

  it('states the work lives on this device and keeps the privacy promise', () => {
    const html = renderToStaticMarkup(createElement(WorkLivesHereCard, cardProps));
    expect(html).toMatch(/saved on this device/i);
    expect(html).toMatch(/private/i);
    // Names the durability caveat: nothing goes to the cloud.
    expect(html).toMatch(/goes to the cloud/i);
  });

  it('offers a one-tap backup with no state claim before the cue resolves', () => {
    const html = renderToStaticMarkup(createElement(WorkLivesHereCard, cardProps));
    expect(html).toMatch(/Back up my work/i);
    // The backup line renders from the shared work-based cue after mount;
    // the server shell claims no state it cannot know (and never a
    // time-based nudge).
    expect(html).not.toMatch(/Time for a fresh backup/i);
  });
});

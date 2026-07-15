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

import WorkLivesHere from './WorkLivesHere';

describe('WorkLivesHere', () => {
  it('states the work lives on this device and keeps the privacy promise', () => {
    const html = renderToStaticMarkup(createElement(WorkLivesHere));
    expect(html).toMatch(/saved on this device/i);
    expect(html).toMatch(/private/i);
    // Names the durability caveat: not the cloud / not Google Drive.
    expect(html).toMatch(/cloud or to Google Drive/i);
  });

  it('offers a one-tap backup and a last-backup line', () => {
    const html = renderToStaticMarkup(createElement(WorkLivesHere));
    expect(html).toMatch(/Back up my work/i);
    // Server render has no localStorage read yet, so it shows the not-yet state.
    expect(html).toMatch(/not backed up yet/i);
  });
});

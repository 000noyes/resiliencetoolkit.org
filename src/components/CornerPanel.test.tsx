// @vitest-environment node
/**
 * Corner panel render contract (the pill's successor).
 *
 * Static-render assertions: the closed state is the icon-only plus button
 * (the old text pill is gone), the open state holds exactly the two doors
 * that really open — Questions, then Fund this work with the sprout accent —
 * and each door's modal carries its working destination (the mailto path;
 * the donate link plus the mail-a-check line). The inert round-page mode
 * renders the open panel with no modals.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';

import CornerPanel, { QuestionsModal, FundModal } from './CornerPanel';

describe('CornerPanel — closed state (production default)', () => {
  const html = renderToString(<CornerPanel />);

  it('renders the icon-only corner button, not the retired text pill', () => {
    expect(html).toContain('aria-haspopup');
    expect(html).not.toContain('Have Questions?');
  });

  it('keeps the panel and both modals closed', () => {
    expect(html).not.toContain('Fund this work');
    expect(html).not.toContain('Your message');
  });

  it('meets the 44px target floor on the corner button (h-12 w-12)', () => {
    expect(html).toMatch(/h-12/);
    expect(html).toMatch(/w-12/);
  });
});

describe('CornerPanel — static open (the round page proposal, inert)', () => {
  const html = renderToString(<CornerPanel staticOpen />);

  it('renders exactly the two doors, fund last', () => {
    const questionsAt = html.indexOf('Questions');
    const fundAt = html.indexOf('Fund this work');
    expect(questionsAt).toBeGreaterThan(-1);
    expect(fundAt).toBeGreaterThan(questionsAt);
    expect(html).not.toContain('Notes on this page');
  });

  it('carries each door sub-line', () => {
    expect(html).toContain('Write to the people who tend this toolkit.');
    expect(html).toContain('Help keep the hubs and this toolkit going.');
  });

  it('gives the fund door the green sprout accent', () => {
    expect(html).toContain('text-table-accent');
  });

  it('renders no modal content on the frozen surface', () => {
    expect(html).not.toContain('Your message');
    expect(html).not.toContain('Donate online');
  });
});

describe('QuestionsModal — the mailto door destination', () => {
  const html = renderToString(<QuestionsModal onClose={() => {}} />);

  it('keeps the compose form the pill always led to (mailto fires on submit)', () => {
    expect(html).toContain('Have Questions?');
    expect(html).toContain('Your message');
    expect(html).toContain('>Send<');
  });
});

describe('FundModal — the fund door destination', () => {
  const html = renderToString(<FundModal onClose={() => {}} />);

  it('links the donate page and carries the mail-a-check path with the memo line', () => {
    expect(html).toContain('https://www.paypal.com/donate/?hosted_button_id=THSYSAQ43SVBS');
    expect(html).toContain('Donate online');
    expect(html).toContain('Community Resilience Organizations, P.O. Box 1002, Montpelier, VT 05602');
    expect(html).toContain('Put Toolkit in the memo.');
  });

  it('opens the donate link in a new tab with rel protection', () => {
    expect(html).toMatch(/target="_blank"[^>]*rel="noopener noreferrer"|rel="noopener noreferrer"[^>]*target="_blank"/);
  });
});

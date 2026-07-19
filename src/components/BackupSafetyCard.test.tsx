/**
 * The JS-dead server shell (DR8): the safety card's server render must show
 * honest generic words and the pinned backup button, and must never imply a
 * calm state it cannot know. This is the unit-level half of the shell gate;
 * the e2e journey suite covers the no-JS page render.
 *
 * Run: pnpm vitest run src/components/BackupSafetyCard.test.tsx
 */
import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import React from 'react';
import { renderToString } from 'react-dom/server';
import BackupSafetyCard from './BackupSafetyCard';

describe('BackupSafetyCard server shell', () => {
  const html = renderToString(<BackupSafetyCard />);

  it('renders the honest generic words and the pinned button', () => {
    expect(html).toContain('Your work is saved on this device, and only here.');
    expect(html).toContain('Back up my work');
    expect(html).toContain('data-testid="rt-backup-button"');
  });

  it('never implies calm or a state it cannot know', () => {
    expect(html).not.toContain('Everything you have is backed up');
    expect(html).not.toContain('ready to back up');
    expect(html).not.toContain('missing');
  });

  it('carries no em or en dashes', () => {
    expect(html).not.toMatch(/[–—]/);
  });
});

// @vitest-environment jsdom
/**
 * Corner panel open-state contract, exercised through the real interaction
 * path (the closed panel opens on a trigger tap): exactly the two doors that
 * really open, Questions first and Fund this work last with the sprout
 * accent, and the Questions door really opens its modal. Round pages mount
 * this same hydrated panel, so this suite is also the unit proof behind
 * "The Questions door in the corner always works."
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import CornerPanel from './CornerPanel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('CornerPanel — open state through the real trigger', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<CornerPanel />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const trigger = () =>
    document.querySelector<HTMLButtonElement>('button[aria-label="Questions and support"]')!;

  const openPanel = () => {
    act(() => {
      trigger().click();
    });
  };

  it('opens on tap: exactly the two doors, fund last with the sprout accent', () => {
    expect(document.body.textContent).not.toContain('Fund this work');
    openPanel();
    const html = container.innerHTML;
    const questionsAt = html.indexOf('Questions');
    const fundAt = html.indexOf('Fund this work');
    expect(questionsAt).toBeGreaterThan(-1);
    expect(fundAt).toBeGreaterThan(questionsAt);
    expect(html).toContain('Write to the people who tend this toolkit.');
    expect(html).toContain('Help keep the hubs and this toolkit going.');
    expect(html).toContain('text-table-accent');
    expect(html).not.toContain('Notes on this page');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('the Questions door really opens its modal', () => {
    openPanel();
    const door = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Write to the people who tend this toolkit.')
    )!;
    act(() => {
      door.click();
    });
    expect(document.body.textContent).toContain('Have Questions?');
    expect(document.body.textContent).toContain('Your message');
  });

  it('Esc closes the open panel', () => {
    openPanel();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.body.textContent).not.toContain('Fund this work');
  });
});

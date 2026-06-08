import { test, expect } from '@playwright/test';

/**
 * Network purity — the product's second headline promise ("nothing leaves the
 * device", "no tracking") enforced as a real-browser test.
 *
 * The built site must issue ZERO cross-origin requests. Any request to a
 * different origin (analytics, fonts, embeds, a future dependency) is a
 * third-party contact the privacy promise forbids. This turns "no tracking"
 * from an asserted claim into an enforced gate, the same "enforce, not assert"
 * discipline as the offline test and Source Fidelity — so a dependency can't
 * silently re-add a tracker.
 *
 * Runs against the built artifact via astro preview (see
 * playwright.offline.config.ts), same as the offline test.
 */

// A spread of pages so a tracker injected on any layout/route is caught.
const ROUTES = [
  '/',
  '/modules/baseline-resilience/2-2/',
  '/downloads-and-templates/',
  '/map/',
];

const SITE_ORIGIN = 'http://rt.localhost:4321';

test('the built site makes zero cross-origin network requests', async ({ page }) => {
  const crossOrigin = new Set<string>();
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('http')) return; // ignore data:, blob:, about:
    const origin = new URL(url).origin;
    if (origin !== SITE_ORIGIN) crossOrigin.add(`${origin}  (${req.resourceType()})`);
  });

  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' });
  }

  expect(
    [...crossOrigin],
    `cross-origin requests detected — the site must keep everything on-device:\n${[...crossOrigin].join('\n')}`,
  ).toEqual([]);
});

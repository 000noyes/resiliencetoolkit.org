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

test('the built site makes zero cross-origin network requests', async ({ page, baseURL }) => {
  // Derive the origin from the running config's baseURL (single source of
  // truth) so the purity gate holds no matter which port the suite runs on.
  const siteOrigin = new URL(baseURL!).origin;
  const crossOrigin = new Set<string>();
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('http')) return; // ignore data:, blob:, about:
    const origin = new URL(url).origin;
    if (origin !== siteOrigin) crossOrigin.add(`${origin}  (${req.resourceType()})`);
  });

  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' });
  }

  expect(
    [...crossOrigin],
    `cross-origin requests detected — the site must keep everything on-device:\n${[...crossOrigin].join('\n')}`,
  ).toEqual([]);
});

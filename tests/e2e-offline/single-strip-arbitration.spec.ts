import { test, expect, type Page } from '@playwright/test';

/**
 * Single-slot notice arbitration — at most one top-of-page strip ever shows,
 * by priority (storageAcute > status > update > storageSoft > contact), and
 * the slot hands over correctly as signals change.
 *
 * This drives the real hydrated banner islands on the built artifact and
 * changes their SIGNALS (at-risk storage via an init script, update-ready and
 * offline via the app's own events). It is a presentation-layer test of the
 * registry, so it uses the signal events rather than a true dead-server
 * offline (that pattern exists to test service-worker navigation, which is not
 * what is under test here).
 */

// Force a non-durable origin so the soft storage reminder is a live claimant.
// The strip is work-aware now (reconciliation R1): it also needs the has-work
// canary set, and an absent counter reads as unknown, which claims.
async function forceAtRisk(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persist: async () => false,
        persisted: async () => false,
        estimate: async () => ({ usage: 0, quota: 0 }),
      },
    });
    localStorage.setItem(
      'rt-has-work',
      JSON.stringify({ modules: { 'e2e-arbitration': true }, updatedAt: new Date().toISOString() }),
    );
  });
}

const softStrip = (page: Page) => page.getByText(/keep a backup copy/i);
const updateStrip = (page: Page) => page.getByText(/A newer version of this site is ready/i);
const contactRegion = (page: Page) => page.getByRole('region', { name: 'Site notice' });
const statusBanner = (page: Page) => page.locator('#status-banner');

async function goUpdateReady(page: Page) {
  await page.evaluate(() => {
    document.documentElement.dataset.rtSwUpdateReady = 'v-single-strip-test';
    document.dispatchEvent(
      new CustomEvent('rt:sw-update-ready', { detail: { version: 'v-single-strip-test' } }),
    );
  });
}

async function setOnline(page: Page, online: boolean) {
  await page.evaluate(
    (o) => document.dispatchEvent(new CustomEvent('network-status-change', { detail: { online: o } })),
    online,
  );
}

test('shows exactly one strip across stacking signals, and hands over on reconnect', async ({
  page,
}) => {
  await forceAtRisk(page);
  await page.goto('/', { waitUntil: 'load' });

  // Initial: only the soft storage reminder claims (contact is outranked).
  await expect(softStrip(page)).toBeVisible({ timeout: 20_000 });
  await expect(contactRegion(page)).toHaveCount(0);
  await expect(statusBanner(page)).toBeHidden();

  // An update arrives (30) and outranks the soft reminder (20).
  await goUpdateReady(page);
  await expect(updateStrip(page)).toBeVisible();
  await expect(softStrip(page)).toHaveCount(0);
  await expect(statusBanner(page)).toBeHidden();

  // Offline (40) outranks the update. Exactly the offline strip shows; the
  // update and soft strips leave the DOM entirely (they render only as winner).
  await setOnline(page, false);
  await expect(statusBanner(page)).toBeVisible();
  await expect(statusBanner(page)).toContainText('working offline');
  await expect(updateStrip(page)).toHaveCount(0);
  await expect(softStrip(page)).toHaveCount(0);
  await expect(contactRegion(page)).toHaveCount(0);

  // Reconnect: a brief "back online" flash (status still holds the slot),
  // then it releases and the masked update strip takes over.
  await setOnline(page, true);
  await expect(statusBanner(page)).toContainText('back online');
  await expect(updateStrip(page)).toBeVisible({ timeout: 6_000 });
  await expect(statusBanner(page)).toBeHidden();
  await expect(softStrip(page)).toHaveCount(0);
});

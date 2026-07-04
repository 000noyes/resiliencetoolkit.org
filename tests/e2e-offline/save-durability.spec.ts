import { test, expect, type Page } from '@playwright/test';

/**
 * Durability floor — the product's other headline promise ("never lose your
 * work") enforced as a real-browser test. This is the exact loss a real user
 * reported: type into a field, close the page WITHOUT blurring, and the edit
 * was gone because the save only ran on blur.
 *
 * These run against the built artifact via playwright.offline.config.ts (real
 * generated sw.js on rt.localhost), same as the offline suite.
 *
 * A journal-variant textarea is the highest-risk surface (longform reflection),
 * so it is the one the spec drives.
 */

// A module page with a journal-variant DataTable (id-prefixed `dt-journal-`).
const JOURNAL_ROUTE = '/modules/knowing-your-community/';
const JOURNAL_TEXTAREA = 'textarea[id^="dt-journal-"]';

// Wait for the client:idle island to hydrate and expose an editable textarea.
async function firstJournalTextarea(page: Page) {
  const ta = page.locator(JOURNAL_TEXTAREA).first();
  await expect(ta).toBeVisible({ timeout: 20_000 });
  await expect(ta).toBeEnabled({ timeout: 20_000 });
  return ta;
}

test('type-then-close WITHOUT blur survives a reload', async ({ page }) => {
  await page.goto(JOURNAL_ROUTE, { waitUntil: 'load' });
  const ta = await firstJournalTextarea(page);

  const marker = `flood-durability-${Date.now()}`;
  await ta.fill(marker);
  // The controlled value sticking proves React's onChange fired (save-on-change
  // + synchronous journal both run there). Before this floor, onChange only
  // updated state and nothing persisted until blur.
  await expect(ta).toHaveValue(marker);

  // Simulate closing the tab WITHOUT blurring the textarea: fire pagehide.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));

  await page.reload({ waitUntil: 'load' });
  const taAfter = await firstJournalTextarea(page);
  await expect(taAfter).toHaveValue(marker);
});

test('mobile-background (visibilitychange hidden) without blur survives a reload', async ({ page }) => {
  await page.goto(JOURNAL_ROUTE, { waitUntil: 'load' });
  const ta = await firstJournalTextarea(page);

  const marker = `flood-background-${Date.now()}`;
  await ta.fill(marker);
  await expect(ta).toHaveValue(marker);

  // Simulate the OS backgrounding/freezing the tab: visibilitychange -> hidden.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await page.reload({ waitUntil: 'load' });
  const taAfter = await firstJournalTextarea(page);
  await expect(taAfter).toHaveValue(marker);
});

test('non-durable context (persist denied) shows the storage-health warning', async ({ page }) => {
  // Force the origin to look non-persistent (private mode / eviction-prone).
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persist: async () => false,
        persisted: async () => false,
        estimate: async () => ({ usage: 0, quota: 0 }),
      },
    });
  });
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.getByText(/back it up with Export/i)).toBeVisible({ timeout: 20_000 });
});

test('persisted origin shows NO storage-health warning', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 0, quota: 1e9 }),
      },
    });
  });
  await page.goto('/', { waitUntil: 'load' });
  // Give the client:idle banner island time to hydrate and check health.
  await page.waitForTimeout(3000);
  await expect(page.getByText(/back it up with Export/i)).toHaveCount(0);
});

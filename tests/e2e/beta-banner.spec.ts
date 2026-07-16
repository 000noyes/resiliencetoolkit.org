/**
 * Contact banner E2E — first-visit display, dismiss persistence across reload,
 * and the single-slot yield (it steps aside for any higher-priority notice).
 *
 * Run: npx playwright test beta-banner
 * Requires dev server on localhost:4321 (started automatically per playwright.config).
 */
import { test, expect } from '@playwright/test';

const CONTACT_TEXT = 'Contact us for support';

test.describe('Contact banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
  });

  test('renders on first visit, persists dismiss across reload', async ({ page }) => {
    await page.reload();

    const banner = page.getByRole('region', { name: 'Site notice' });
    await expect(banner).toBeVisible();
    await expect(banner.getByText(CONTACT_TEXT)).toBeVisible();

    const mailto = banner.getByRole('link', { name: 'resiliencetoolkit@gocros.org' });
    await expect(mailto).toHaveAttribute('href', 'mailto:resiliencetoolkit@gocros.org');

    await banner.getByRole('button', { name: 'Dismiss site notice' }).click();
    await expect(banner).not.toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(() => window.localStorage.getItem('betaBanner.dismissed.v1'))
      )
      .toBe('1');

    await page.reload();
    await expect(page.getByRole('region', { name: 'Site notice' })).toHaveCount(0);
  });

  test('yields the single slot to a higher-priority notice claim', async ({ page }) => {
    await page.reload();
    const banner = page.getByRole('region', { name: 'Site notice' });
    await expect(banner).toBeVisible();

    // A higher-priority strip (update) claims the single slot: contact yields.
    await page.evaluate(() => {
      document.documentElement.dataset.rtNoticeClaimUpdate = '';
      document.dispatchEvent(new Event('rt:notice-changed'));
    });
    await expect(banner).toHaveCount(0);

    // It releases; contact returns (the shipped handover).
    await page.evaluate(() => {
      delete document.documentElement.dataset.rtNoticeClaimUpdate;
      document.dispatchEvent(new Event('rt:notice-changed'));
    });
    await expect(banner).toBeVisible();
  });
});

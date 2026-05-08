/**
 * BetaBanner E2E — first-visit display, dismiss persistence across reload.
 *
 * Run: npx playwright test beta-banner
 * Requires dev server on localhost:4321 (started automatically per playwright.config).
 */
import { test, expect } from '@playwright/test';

const BANNER_TEXT = 'Your feedback shapes this site';

test.describe('BetaBanner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
  });

  test('renders on first visit, persists dismiss across reload', async ({ page }) => {
    await page.reload();

    const banner = page.getByRole('region', { name: 'Site notice' });
    await expect(banner).toBeVisible();
    await expect(banner.getByText(BANNER_TEXT)).toBeVisible();

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
});

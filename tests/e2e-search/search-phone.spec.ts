import { test, expect } from '@playwright/test';

/**
 * Phones: the header lens left of the burger opens the search sheet in
 * the ratified sheet grammar (SE2, SR8, SR11): input pinned at the top,
 * 44px targets, typed text preserved on dismissal, exactly one history
 * entry so back closes it (ES6), picks are plain navigations, and the
 * lens and the burger close each other. Search never joins the bar.
 */

const CHAPTER = '/modules/emergency-preparedness/1-2';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('the lens opens the sheet; back closes it; an outside tap keeps the typed text', async ({ page }) => {
  await page.goto(CHAPTER);
  const lens = page.locator('#mobile-search-lens');
  const burger = page.locator('#mobile-menu-button');
  await expect(lens).toBeVisible();
  await expect(burger).toBeVisible();
  await expect(page.locator('#header-search-input')).toBeHidden();
  const lensBox = (await lens.boundingBox())!;
  const burgerBox = (await burger.boundingBox())!;
  expect(lensBox.x).toBeLessThan(burgerBox.x);
  expect(burgerBox.x - (lensBox.x + lensBox.width)).toBeLessThan(24);
  // Search never joins the docked bar
  await expect(page.locator('.reading-bar')).not.toContainText(/search/i);

  await lens.tap();
  const sheet = page.getByRole('dialog', { name: 'Search the toolkit' });
  await expect(sheet).toBeVisible();
  const input = page.locator('#sheet-search-input');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('placeholder', "Try 'mutual aid' or 'go bag'");
  expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await sheet.locator('.search-sheet__close').boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await input.pressSequentially('go bag', { delay: 30 });
  const rows = page.locator('#search-sheet [role="option"]');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  expect((await rows.first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // The input stays pinned above the results
  expect((await input.boundingBox())!.y).toBeLessThan((await rows.first().boundingBox())!.y);

  await page.locator('#search-sheet .search-sheet__backdrop').tap({ position: { x: 20, y: 20 } });
  await expect(sheet).toBeHidden();
  await lens.tap();
  await expect(sheet).toBeVisible();
  await expect(input).toHaveValue('go bag');

  // Exactly one history entry: back closes the sheet and stays on the page
  await page.goBack();
  await expect(sheet).toBeHidden();
  expect(new URL(page.url()).pathname).toBe(CHAPTER);
});

test('a pick from the sheet is a plain navigation: back returns to the page, not the sheet', async ({ page }) => {
  await page.goto(CHAPTER);
  await page.locator('#mobile-search-lens').tap();
  const input = page.locator('#sheet-search-input');
  await input.pressSequentially('mutual aid', { delay: 30 });
  const rows = page.locator('#search-sheet [role="option"]');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const href = (await rows.first().getAttribute('href'))!;
  const dest = new URL(href, 'http://x');
  await rows.first().tap();
  await page.waitForURL((url) => url.pathname === dest.pathname && url.hash === dest.hash, { timeout: 15_000 });
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe(CHAPTER);
  await expect(page.getByRole('dialog', { name: 'Search the toolkit' })).toBeHidden();
});

test('the lens and the burger close each other; the contents sheet keeps its search link', async ({ page }) => {
  await page.goto(CHAPTER);
  const sheet = page.getByRole('dialog', { name: 'Search the toolkit' });
  const menu = page.locator('#mobile-menu');
  await page.locator('#mobile-menu-button').tap();
  await expect(menu).toBeVisible();
  await page.locator('#mobile-search-lens').tap();
  await expect(menu).toBeHidden();
  await expect(sheet).toBeVisible();
  // The sheet's scrim covers the header: Close returns to the page, and
  // the burger opens its menu with the sheet gone
  await page.locator('#search-sheet .search-sheet__close').tap();
  await expect(sheet).toBeHidden();
  await page.locator('#mobile-menu-button').tap();
  await expect(menu).toBeVisible();
  await expect(sheet).toBeHidden();
  await page.locator('#mobile-menu-button').tap();
  await expect(menu).toBeHidden();

  await page.locator('[data-sheet-open="contents"]').tap();
  const contents = page.getByRole('dialog', { name: 'Toolkit Contents' });
  await expect(contents).toBeVisible();
  await expect(contents.getByRole('link', { name: /Search the toolkit/ })).toHaveAttribute('href', '/search');
});

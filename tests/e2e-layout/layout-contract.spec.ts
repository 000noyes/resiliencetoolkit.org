import { test, expect } from '@playwright/test';

/**
 * The 3C layout contract (DR3, DR5, ER7, ER8).
 *
 * The reading surface holds its grammar at the 1200px floor and on
 * phones: no horizontal page scroll, the tree fixed at or above 1200,
 * closed tenants in the reserved gutter, the docked bar reserving height,
 * and print dropping every piece of reading chrome.
 */

const CHAPTER = '/modules/emergency-preparedness/1-2';

test('the 1200px floor: no horizontal scroll, tree fixed, rail closes to the gutter', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(CHAPTER);

  // (a) The page body never scrolls horizontally
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(1200);

  // (b) The tree never collapses at or above 1200
  await expect(page.locator('.contents-tree').first()).toBeVisible();

  // (c) On this page rests open in the rail
  const panel = page.locator('.reading-rail__panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByText('On this page')).toBeVisible();

  // (d) Closing the tenant returns the measure: the panel leaves, the
  // labeled edge button appears in the reserved 48px gutter
  const contentBefore = await page.locator('.reading-content').boundingBox();
  await page.click('[data-rail-close]');
  await expect(panel).toBeHidden();
  const edgeBtn = page.locator('.reading-rail__edge-btn');
  await expect(edgeBtn).toBeVisible();
  await expect(edgeBtn).toHaveText('On this page');
  const gutter = await page.locator('.reading-rail__gutter').boundingBox();
  expect(gutter!.width).toBeLessThanOrEqual(48);
  const contentAfter = await page.locator('.reading-content').boundingBox();
  expect(contentAfter!.width).toBeGreaterThan(contentBefore!.width);

  // (e) Reopening restores the panel
  await edgeBtn.click();
  await expect(panel).toBeVisible();

  // (f) No floating chrome: the mobile bar and sheet do not exist at
  // desktop widths, and the retired drawer is gone everywhere
  await expect(page.locator('.reading-bar')).toBeHidden();
  await expect(page.locator('.toc-mobile-trigger')).toHaveCount(0);
  await ctx.close();
});

test('phone grammar: contents in flow at top, bar reserves height, sheet is modal', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(CHAPTER);

  // No horizontal scroll on phones either
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);

  // On this page renders in flow at the top of the chapter, above the h1
  const tocBox = await page.locator('.reading-rail__panel').boundingBox();
  const h1Box = await page.locator('article h1').boundingBox();
  expect(tocBox!.y).toBeLessThan(h1Box!.y);

  // The tree column is hidden; the bar is visible, docked, and the page
  // reserves its height (layout, not overlay)
  await expect(page.locator('.contents-tree--rail')).toBeHidden();
  const bar = page.locator('.reading-bar');
  await expect(bar).toBeVisible();
  const barBox = await bar.boundingBox();
  expect(barBox!.y + barBox!.height).toBeGreaterThanOrEqual(843);
  const reserved = await page.evaluate(() => {
    const grid = document.querySelector('.reading-grid')!;
    return parseFloat(getComputedStyle(grid).paddingBottom);
  });
  expect(reserved).toBeGreaterThanOrEqual(56);

  // The corner door anchors above the reserved bar (ER8)
  const corner = await page.locator("div[data-annot='corner-panel']").boundingBox();
  expect(corner!.y + corner!.height).toBeLessThanOrEqual(barBox!.y + 1);

  // The Toolkit Contents door opens a modal sheet with a drag handle;
  // outside tap dismisses it
  await page.click('[data-sheet-open="contents"]');
  const sheet = page.locator('.reading-sheet__body');
  await expect(sheet).toBeVisible();
  await expect(page.locator('.reading-sheet__handle')).toBeVisible();
  await expect(sheet.getByRole('link', { name: /Food and water/ })).toBeVisible();
  await page.locator('.reading-sheet__backdrop').click({ position: { x: 20, y: 20 } });
  await expect(sheet).toBeHidden();
  await ctx.close();
});

test('the tree renders the one model: front matter first, Resource Library last, search as a link', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(CHAPTER);

  const labels = await page
    .locator('.contents-tree--rail .contents-tree__label')
    .allTextContents();
  expect(labels[0]).toBe('Introduction');
  expect(labels[labels.length - 1]).toBe('Resource Library');
  expect(labels).not.toContain('Map');
  expect(labels).not.toContain('About');
  expect(labels).not.toContain('Changes');

  // The active chapter carries the current state
  await expect(
    page.locator('.contents-tree--rail [aria-current="page"] .contents-tree__label')
  ).toHaveText('Food and water');

  // The search jump is a plain link, never an input-shaped box (DR7)
  const search = page.locator('.contents-tree--rail .contents-tree__search');
  await expect(search).toHaveText(/Search the toolkit/);
  expect(await search.evaluate((el) => el.tagName)).toBe('A');
  await ctx.close();
});

test('print drops the reading chrome and returns to one column (ER7)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(CHAPTER);
  await page.emulateMedia({ media: 'print' });

  for (const sel of ['.contents-tree--rail', '.reading-rail', '.reading-bar']) {
    const visible = await page
      .locator(sel)
      .first()
      .isVisible()
      .catch(() => false);
    expect(visible, `${sel} must not print`).toBe(false);
  }
  const display = await page.evaluate(
    () => getComputedStyle(document.querySelector('.reading-grid')!).display
  );
  expect(display).toBe('block');

  // The global rule hides any annotation chrome by attribute
  const annotHidden = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-annot-ui]')).every(
      (el) => getComputedStyle(el).display === 'none'
    )
  );
  expect(annotHidden).toBe(true);
  await ctx.close();
});

import { test, expect } from '@playwright/test';

/**
 * The 3C layout contract (DR3, DR5, ER7, ER8).
 *
 * The reading surface holds its grammar at the 1200px floor and on
 * phones: no horizontal page scroll, the tree open by default at or above
 * 1200 and closing to its edge button,
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
  const panel = page.locator('#rail-panel-on-this-page');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.toc-title')).toHaveText('On this page');

  // (d) Closing the tenant holds the measure: the panel leaves, the
  // labeled edge button appears in the reserved 48px gutter, the
  // article does not reflow
  const contentBefore = await page.locator('.reading-content').boundingBox();
  const gutterBefore = await page.locator('.reading-rail__gutter').boundingBox();
  await page.click('[data-rail-close="on-this-page"]');
  await expect(panel).toBeHidden();
  const edgeBtn = page.locator('[data-rail-btn="on-this-page"]');
  await expect(edgeBtn).toBeVisible();
  await expect(edgeBtn.locator('.reading-rail__edge-open')).toBeVisible();
  const gutter = await page.locator('.reading-rail__gutter').boundingBox();
  expect(gutter!.width).toBeLessThanOrEqual(48);
  // The edge buttons keep their place at the right edge; only the panel leaves
  expect(gutter!.x).toBe(gutterBefore!.x);
  const contentAfter = await page.locator('.reading-content').boundingBox();
  expect(contentAfter!.width).toBe(contentBefore!.width);

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
  const tocBox = await page.locator('#rail-panel-on-this-page').boundingBox();
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
  const sheet = page.getByRole('dialog', { name: 'Toolkit Contents' });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.reading-sheet__handle')).toBeVisible();
  await expect(sheet.getByRole('link', { name: /Food and water/ })).toBeVisible();
  await page.locator('[data-sheet="contents"] .reading-sheet__backdrop').click({ position: { x: 20, y: 20 } });
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

test('tenant swap: Footnotes swaps the panel, closing returns On this page (test-plan state machine)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(CHAPTER);

  const onThisPage = page.locator('#rail-panel-on-this-page');
  const footnotes = page.locator('#rail-panel-footnotes');
  await expect(onThisPage).toBeVisible();
  await expect(footnotes).toBeHidden();

  // Opening Footnotes swaps, never stacks
  await page.click('[data-rail-btn="footnotes"]');
  await expect(footnotes).toBeVisible();
  await expect(onThisPage).toBeHidden();

  // Closing Footnotes returns On this page
  await page.click('[data-rail-close="footnotes"]');
  await expect(onThisPage).toBeVisible();
  await expect(footnotes).toBeHidden();

  // Closing On this page collapses everything to the gutter
  await page.click('[data-rail-close="on-this-page"]');
  await expect(onThisPage).toBeHidden();
  await expect(footnotes).toBeHidden();
  const gutter = await page.locator('.reading-rail__gutter').boundingBox();
  expect(gutter!.width).toBeLessThanOrEqual(48);
  await ctx.close();
});

test('the Footnotes tenant shows the honest empty state until citations confirm', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  // 1.3's printed range is held until it is confirmed against the printed copy
  await page.goto('/modules/emergency-preparedness/1-3');
  await page.click('[data-rail-btn="footnotes"]');
  await expect(page.locator('#rail-panel-footnotes')).toContainText('No notes on this page.');
  // A confirmed chapter presents its citation in the tenant (DR17/ER7)
  await page.goto(CHAPTER);
  await page.click('[data-rail-btn="footnotes"]');
  await expect(page.locator('#rail-panel-footnotes')).toContainText('Printed toolkit, 2025 edition, pages 20 to 21.');
  await expect(page.locator('#rail-panel-footnotes')).not.toContainText('No notes on this page.');
  await ctx.close();
});

test('the tree closes to its edge button, the measure holds, and the choice persists across reload (BR8)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(CHAPTER);
  const tree = page.locator('.contents-tree--rail');
  await expect(tree).toBeVisible();
  const before = await page.locator('.reading-content').boundingBox();

  // Close: the tree leaves, the labeled edge button sits in a 48px gutter,
  // the article neither widens nor moves
  await page.click('[data-tree-close]');
  await expect(tree).toBeHidden();
  const edge = page.locator('[data-tree-btn]');
  await expect(edge).toBeVisible();
  await expect(edge).toHaveText('Toolkit Contents');
  await expect(edge).toHaveAttribute('aria-expanded', 'false');
  const gutter = await page.locator('.reading-tree__gutter').boundingBox();
  expect(gutter!.width).toBeLessThanOrEqual(48);
  const after = await page.locator('.reading-content').boundingBox();
  expect(after!.width).toBe(before!.width);
  expect(after!.x).toBe(before!.x);

  // The choice persists, and reopening persists too
  await page.reload();
  await expect(page.locator('.contents-tree--rail')).toBeHidden();
  await expect(page.locator('[data-tree-btn]')).toBeVisible();
  await page.click('[data-tree-btn]');
  await expect(page.locator('.contents-tree--rail')).toBeVisible();
  await page.reload();
  await expect(page.locator('.contents-tree--rail')).toBeVisible();
  await ctx.close();
});

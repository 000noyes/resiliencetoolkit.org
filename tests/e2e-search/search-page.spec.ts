import { test, expect } from '@playwright/test';

/**
 * /search: the full result surface, deep-link home, and no-JS floor
 * (SR1, SR9, SR11 three states), and its unlisted place in the chrome.
 */

test.use({ viewport: { width: 1360, height: 900 } });

test('three states: empty query shows the contents, a query replaces them with counted results, no results keeps them', async ({
  page,
}) => {
  await page.goto('/search');
  const input = page.locator('#page-search-input');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('');
  await expect(page.locator('[data-search-count]')).toBeHidden();
  await expect(page.locator('[data-search-contents]')).toBeVisible();
  await expect(page.locator('[data-search-contents]')).toContainText('Resource Library');
  // The cover's newcomer exit lines belong to the cover, not to /search
  await expect(page.locator('[data-search-contents] .cover-contents__exits')).toHaveCount(0);

  await page.goto('/search?q=mutual%20aid');
  await expect(input).toHaveValue('mutual aid');
  const rows = page.locator('[data-search-page] [role="option"]');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-search-count]')).toHaveText(/^\d+ results in \d+ modules$/);
  await expect(page.locator('[data-search-contents]')).toBeHidden();
  // Two-line snippets here, one line in the panel (SR9)
  const clamp = await page
    .locator('[data-search-page] .search-results__row-excerpt')
    .first()
    .evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-line-clamp'));
  expect(clamp).toBe('2');
  // The count line sits under the box, above the results
  const countBox = await page.locator('[data-search-count]').boundingBox();
  const firstRow = await rows.first().boundingBox();
  expect(countBox!.y).toBeLessThan(firstRow!.y);

  await page.goto('/search?q=zzqqxxyy');
  await expect(page.locator('[data-search-page] [data-search-status]')).toHaveText(
    'No results for zzqqxxyy. Try another word, or open the contents.',
    { timeout: 15_000 }
  );
  await expect(page.locator('[data-search-contents]')).toBeVisible();
});

test('/search is unlisted chrome: no nav item, no tree row; reached by the box and the contents-render links', async ({
  page,
}) => {
  await page.goto('/modules/emergency-preparedness/1-2');
  const navHrefs = await page.locator('header nav a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(navHrefs).not.toContain('/search');
  const treeHrefs = await page
    .locator('.contents-tree--rail .contents-tree__link')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(treeHrefs).not.toContain('/search');
  await expect(page.locator('.contents-tree--rail .contents-tree__search')).toHaveAttribute('href', '/search');
  await expect(page.locator('.contents-tree--rail .contents-tree__search')).toHaveText(/Search the toolkit/);
});

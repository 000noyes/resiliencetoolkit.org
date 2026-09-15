import { test, expect } from '@playwright/test';

/**
 * MANDATORY REGRESSION (ER12): the progress counters survive the On this
 * page re-house. Checking a todo updates the section counter and the
 * overall counter in the rail panel; unchecking restores them.
 */

const CHAPTER = '/modules/emergency-preparedness/1-2';

test('checking a todo updates the re-housed On this page counters', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(CHAPTER);

  const overall = page.locator('.reading-rail__panel .toc-overall-progress .toc-progress-text');
  // The counter is on the page from the build (the total is read from the
  // body); the todo islands hydrate after, so wait for every one of them
  // before reading the baseline
  await expect(overall).toBeVisible({ timeout: 15_000 });
  const todoCount = await page.locator('astro-island[component-url*="Todo"]').count();
  await expect(page.locator('input.todo-checkbox')).toHaveCount(todoCount, { timeout: 15_000 });
  await expect(overall).toHaveText(new RegExp(`/${todoCount}$`), { timeout: 15_000 });
  const before = await overall.textContent();
  const [beforeDone, total] = before!.split('/').map((n) => parseInt(n, 10));

  // The todo checkbox is a controlled input over async storage: click and
  // let the counter settle rather than asserting the property mid-flight
  const firstTodo = page.locator('input.todo-checkbox').first();
  await firstTodo.click();
  await expect(overall).toHaveText(`${beforeDone + 1}/${total}`);

  await firstTodo.click();
  await expect(overall).toHaveText(`${beforeDone}/${total}`);
  await ctx.close();
});

test('at 375 the h2 rows carry their children rolled up and sum to the header (D2 A)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(CHAPTER);

  const overall = page.locator('#rail-panel-on-this-page .toc-overall-progress .toc-progress-text');
  await expect(overall).toBeVisible({ timeout: 15_000 });
  const todoCount = await page.locator('astro-island[component-url*="Todo"]').count();
  await expect(page.locator('input.todo-checkbox')).toHaveCount(todoCount, { timeout: 15_000 });
  await expect(overall).toHaveText(new RegExp(`/${todoCount}$`), { timeout: 15_000 });

  // The visible rows (h2 rows with their children rolled up, or the band
  // rows on a chapter without h2s) sum to the header
  const top = await page.locator('#rail-panel-on-this-page').getAttribute('data-toc-top');
  if (top === 'h2') {
    await expect(page.locator('#rail-panel-on-this-page .toc-item-meta--own:visible')).toHaveCount(0);
  }
  const visible = await page
    .locator('#rail-panel-on-this-page .toc-list .toc-progress:visible')
    .allTextContents();
  const total = visible.reduce((sum, t) => sum + parseInt(t.split('/')[1], 10), 0);
  expect(total).toBe(todoCount);

  // Checking a todo moves the header and its row's roll-up
  const before = await overall.textContent();
  const [beforeDone] = before!.split('/').map((n) => parseInt(n, 10));
  await page.locator('input.todo-checkbox').first().click();
  await expect(overall).toHaveText(`${beforeDone + 1}/${todoCount}`);
  await page.locator('input.todo-checkbox').first().click();
  await expect(overall).toHaveText(`${beforeDone}/${todoCount}`);
  await ctx.close();
});

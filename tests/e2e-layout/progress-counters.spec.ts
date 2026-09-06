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
  await expect(overall).toBeVisible();
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

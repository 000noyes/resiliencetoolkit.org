import { test, expect, type Page } from '@playwright/test';

/**
 * The one search box in the site header (the search end-state appendix):
 * placement and bands (SR8, ES4), the suggestion-first panel (SR2, SR9,
 * SR10, SR11), the APG combobox walk, the Enter rule, the native no-JS
 * form (SR4), query recall (ES5), and the state lines (SR2, ES2).
 */

const CHAPTER = '/modules/emergency-preparedness/1-2';

const headerInput = (page: Page) => page.locator('#header-search-input');
const panel = (page: Page) => page.locator('#header-search [data-search-panel]');
const options = (page: Page) => page.locator('#header-search [role="option"]');
const status = (page: Page) => page.locator('#header-search [data-search-status]');

async function typeInHeader(page: Page, text: string) {
  const input = headerInput(page);
  await input.click();
  await input.pressSequentially(text, { delay: 30 });
  return input;
}

test.describe('desktop 1360', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('the box rides the header after the nav and before the theme toggle, on chapters and the cover', async ({
    page,
  }) => {
    await page.goto(CHAPTER);
    const input = headerInput(page);
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', "Try 'mutual aid' or 'go bag'");
    await expect(input).toHaveAttribute('aria-label', 'Search the toolkit');
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(page.locator('#header-search-lens')).toBeHidden();
    const order = await page.evaluate(() => {
      const nav = document.querySelector('header nav')!;
      const box = document.getElementById('header-search')!;
      const toggle = document.getElementById('theme-toggle')!;
      const after = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return after(nav, box) && after(box, toggle);
    });
    expect(order).toBe(true);
    const width = await input.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThanOrEqual(230);

    // The cover carries the same header box and no row of its own (SE3)
    await page.goto('/');
    await expect(headerInput(page)).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Search by keyword');
    expect(await page.locator('input[type="search"]').count()).toBe(2); // the header box and the sheet's, nothing else
  });

  test('the panel opens at the second character: grouped by chapter, term marked, capped rows', async ({
    page,
  }) => {
    await page.goto(CHAPTER);
    const input = await typeInHeader(page, 'm');
    await page.waitForTimeout(700);
    await expect(panel(page)).toBeHidden();
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    await input.pressSequentially('u');
    await expect(options(page).first()).toBeVisible({ timeout: 15_000 });
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(await options(page).count()).toBeLessThanOrEqual(6);
    const groups = page.locator('#header-search .search-results__group');
    expect(await groups.count()).toBeGreaterThanOrEqual(1);
    expect(await groups.count()).toBeLessThanOrEqual(3);
    for (const label of await page.locator('#header-search .search-results__group-label').allTextContents()) {
      expect(label).toMatch(/^(\d+\.\d+ |Introduction|Emergency Preparedness|Baseline Resilience)/);
    }
    await expect(page.locator('#header-search mark.search-mark').first()).toBeVisible();
    await expect(page.locator('#header-search [data-search-see-all]')).toHaveAttribute('href', /^\/search\?q=mu$/);
    // Rows are anchors into the toolkit, never tab stops (APG)
    await expect(options(page).first()).toHaveAttribute('tabindex', '-1');
    // Each result is a place in the one contents model
    for (const href of await options(page).evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
      expect(href).toMatch(/^\/(introduction|modules\/)/);
    }
  });

  test('combobox walk: arrows highlight, Escape closes and keeps focus, Enter opens the highlighted result', async ({
    page,
  }) => {
    await page.goto(CHAPTER);
    const input = await typeInHeader(page, 'mutual aid');
    await expect(options(page).first()).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press('ArrowDown');
    const first = options(page).first();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!);

    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('header-search-input');
    await expect(input).toHaveValue('mutual aid');

    await page.keyboard.press('ArrowDown');
    await expect(options(page).first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('ArrowDown');
    const href = (await options(page).first().getAttribute('href'))!;
    await page.keyboard.press('Enter');
    await page.waitForURL((url) => url.pathname + url.hash === href.replace(/\/(#|$)/, '$1') || url.pathname + url.hash === href, {
      timeout: 15_000,
    });
    const hash = new URL(href, 'http://x').hash;
    if (hash) {
      // The landing (BR5): the searched words under the named header sit
      // in the ring mark, focused, in view under the sticky header, and
      // the URL settled to the header anchor
      const mark = page.locator('mark.search-landing');
      await expect(mark).toHaveText(/mutual|aid/i, { timeout: 15_000 });
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.classList.contains('search-landing')))
        .toBe(true);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const r = document.querySelector('mark.search-landing')!.getBoundingClientRect();
            return r.top >= 56 && r.bottom <= window.innerHeight;
          })
        )
        .toBe(true);
      expect(new URL(page.url()).hash).toBe(hash);
    }
  });

  test('Enter with no highlighted option lands /search carrying the query', async ({ page }) => {
    await page.goto(CHAPTER);
    await typeInHeader(page, 'go bag');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/search\?q=go(\+|%20)bag/);
    const pageInput = page.locator('#page-search-input');
    await expect(pageInput).toHaveValue('go bag');
    await expect(page.locator('[data-search-page] [data-search-count]')).toHaveText(/^\d+ results in \d+ modules$/, {
      timeout: 15_000,
    });
    await expect(page.locator('[data-search-page] [role="option"]').first()).toBeVisible();
    await expect(page.locator('[data-search-contents]')).toBeHidden();
    expect(await page.locator('[data-search-page] [data-search-see-all]').count()).toBe(0);
  });

  test('query recall (ES5): empty on load, restored and selected on focus, the /search URL beats the store', async ({
    page,
  }) => {
    await page.goto(CHAPTER);
    await typeInHeader(page, 'go bag');
    await page.goto('/introduction');
    const input = headerInput(page);
    await expect(input).toHaveValue('');
    await input.focus();
    await expect(input).toHaveValue('go bag', { timeout: 10_000 });
    const selection = await input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]);
    expect(selection).toEqual([0, 6]);

    await page.goto('/search?q=shelter');
    await expect(page.locator('#page-search-input')).toHaveValue('shelter');
    await page.goto(CHAPTER);
    await expect(headerInput(page)).toHaveValue('');
    await headerInput(page).focus();
    await expect(headerInput(page)).toHaveValue('shelter', { timeout: 10_000 });
  });

  test('the Searching line appears past 400ms; a failed query shows the unavailable line, never navigator.onLine', async ({
    page,
    context,
  }) => {
    await page.goto(CHAPTER);
    await context.route('**/pagefind/**', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await typeInHeader(page, 'mutual aid');
    await expect(status(page)).toHaveText('Searching', { timeout: 3_000 });
    await expect(options(page).first()).toBeVisible({ timeout: 20_000 });
    await context.unroute('**/pagefind/**');

    // A query that actually fails
    await context.route('**/pagefind/**', (route) => route.abort());
    await page.goto(CHAPTER);
    await typeInHeader(page, 'mutual aid');
    await expect(status(page)).toHaveText('Search is unavailable right now.', { timeout: 10_000 });
    await context.unroute('**/pagefind/**');

    // navigator.onLine alone never triggers it: with the flag reporting
    // offline but the server reachable, search still works (ES2)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
    });
    await page.goto(CHAPTER);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await typeInHeader(page, 'mutual aid');
    await expect(options(page).first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('no JavaScript', () => {
  test.use({ viewport: { width: 1360, height: 900 }, javaScriptEnabled: false });

  test('the header form submits to /search and the honest floor renders', async ({ page }) => {
    await page.goto(CHAPTER);
    await expect(page.locator('.contents-tree--rail .contents-tree__search')).toHaveAttribute('href', '/search');
    const input = headerInput(page);
    await expect(input).toBeVisible();
    await input.fill('mutual aid');
    await input.press('Enter');
    await page.waitForURL(/\/search\?q=mutual(\+|%20)aid/);
    // The line lives in a noscript block, which text locators do not enter
    const floor = page.locator('.search-page__nojs');
    await expect(floor).toBeVisible();
    await expect(floor).toHaveText('Search needs JavaScript. Every module is listed below.');
    await expect(page.locator('[data-search-contents]')).toBeVisible();
    await expect(page.locator('[data-search-contents]')).toContainText('Knowing Your Community');
    // The page is static: without JavaScript the box cannot echo the query,
    // and the floor line plus the contents are the honest state
    await expect(page.locator('#page-search-input')).toBeVisible();
  });
});

test.describe('bands', () => {
  // The shipped header row (logo, five nav items, toggle) fits the 180px
  // input from about 1060px; below that, and at any zoom or font scale
  // that overflows the row, ES4 hands the slot to the lens
  test('the tight desktop band holds the 180px minimum; ES4 collapses to the lens when the row cannot fit it', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
    const page = await ctx.newPage();
    await page.goto(CHAPTER);
    const input = headerInput(page);
    await expect(input).toBeVisible();
    expect(await input.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(180);
    await expect(page.locator('#header-search-lens')).toBeHidden();

    // Zoom the header's contents without changing the media query width:
    // the row can no longer fit the input, so the lens takes over
    await page.evaluate(() => {
      (document.body.style as CSSStyleDeclaration & { zoom: string }).zoom = '2';
    });
    await expect(page.locator('header[data-search-overflow]')).toHaveCount(1);
    await expect(input).toBeHidden();
    await expect(page.locator('#header-search-lens')).toBeVisible();
    await page.evaluate(() => {
      (document.body.style as CSSStyleDeclaration & { zoom: string }).zoom = '1';
    });
    await expect(page.locator('header[data-search-overflow]')).toHaveCount(0);
    await expect(input).toBeVisible();
    await ctx.close();
  });

  test('768 to 1024: the lens expands into the box in place of the nav, and collapses on an outside click', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const page = await ctx.newPage();
    await page.goto(CHAPTER);
    const lens = page.locator('#header-search-lens');
    await expect(lens).toBeVisible();
    await expect(headerInput(page)).toBeHidden();
    await expect(page.locator('#mobile-search-lens')).toBeHidden();
    await lens.click();
    await expect(headerInput(page)).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('header-search-input');
    await expect(page.locator('header nav').first()).toBeHidden();
    await page.mouse.click(450, 400);
    await expect(headerInput(page)).toBeHidden();
    await expect(page.locator('header nav').first()).toBeVisible();
    await ctx.close();
  });
});

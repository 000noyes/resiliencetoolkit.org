import { test, expect, type Page } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Width discipline (DESIGN.md, Layout): nothing exceeds its column.
 *
 * Every route at 375 wide, closed; the overlay states (the contents sheet,
 * the search sheet, the external-link modal) on the chapter, the
 * introduction, and /search; and the ten reviewed pages at 320 and 414.
 * The document never scrolls sideways, and every rendered element sits
 * inside the viewport (overlays) or inside the content column (in-flow
 * content), the left edge included. scrollWidth alone would miss a fixed
 * box and reads nothing while a sheet locks body scroll, so the element
 * bounds are the first assertion and scrollWidth the second.
 */

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');

/** Every built route, from dist (the preview serves the same tree) */
function routes(): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}/${entry.name}`);
      else if (entry.name === 'index.html') out.push(prefix || '/');
    }
  };
  walk(DIST, '');
  return out.filter((r) => !r.startsWith('/rounds')).sort();
}

const REVIEWED = [
  '/',
  '/introduction',
  '/modules',
  '/modules/knowing-your-community',
  '/modules/emergency-preparedness',
  '/modules/emergency-preparedness/1-2',
  '/modules/emergency-preparedness/1-4',
  '/modules/baseline-resilience/2-1',
  '/downloads',
  '/search',
];

const PHONES: Record<number, number> = { 320: 568, 375: 667, 414: 736 };

interface Offender {
  tag: string;
  cls: string;
  left: number;
  right: number;
  bound: string;
}

/** Every rendered element's box against its bound */
async function offenders(page: Page): Promise<Offender[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const tol = 0.5;
    const column = document.querySelector('.reading-content')?.getBoundingClientRect() ?? null;
    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'HTML', 'HEAD']);
    const scrolls = (el: Element): boolean => {
      let node: Element | null = el.parentElement;
      while (node && node !== document.body) {
        const o = getComputedStyle(node).overflowX;
        if (o === 'auto' || o === 'scroll') return true;
        node = node.parentElement;
      }
      return false;
    };
    const out: Offender[] = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (skipTags.has(el.tagName)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 && rect.height <= 1) continue;
      if (el.getClientRects().length === 0) continue;
      if (scrolls(el)) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const record = (bound: string) =>
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute('class') ?? el.id ?? '').slice(0, 60),
          left: Math.round(rect.left * 10) / 10,
          right: Math.round(rect.right * 10) / 10,
          bound,
        });
      if (rect.left < -tol || rect.right > vw + tol) {
        record(`viewport 0 to ${vw}`);
        continue;
      }
      const fixed = style.position === 'fixed';
      if (column && !fixed && el.closest('.reading-content')) {
        if (rect.left < column.left - tol || rect.right > column.right + tol) {
          record(`column ${Math.round(column.left)} to ${Math.round(column.right)}`);
        }
      }
    }
    return out;
  });
}

/** One label's findings, as lines; empty when the surface holds */
async function sweep(page: Page, width: number, label: string): Promise<string[]> {
  const lines = (await offenders(page)).map(
    (o) => `${label}: <${o.tag} class="${o.cls}"> ${o.left} to ${o.right} outside ${o.bound}`
  );
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  if (scrollWidth > width) lines.push(`${label}: document ${scrollWidth} wide in a ${width} viewport`);
  return lines;
}

test.describe('width sweep', () => {
  test.skip(!existsSync(DIST), 'needs a build in dist');

  test('every route at 375, nothing open', async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true });
    const page = await ctx.newPage();
    const findings: string[] = [];
    for (const route of routes()) {
      await page.goto(route, { waitUntil: 'networkidle' });
      findings.push(...(await sweep(page, 375, `${route} at 375`)));
    }
    await ctx.close();
    expect(findings, findings.join('\n')).toEqual([]);
  });

  test('the sheets and the modal at 375 stay inside the viewport', async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true });
    const page = await ctx.newPage();
    const findings: string[] = [];
    for (const route of ['/modules/emergency-preparedness/1-2', '/introduction', '/search']) {
      await page.goto(route, { waitUntil: 'networkidle' });

      // The contents sheet (bar-carrying pages)
      const contentsDoor = page.locator('[data-sheet-open="contents"]');
      if (await contentsDoor.count()) {
        await contentsDoor.click();
        await expect(page.getByRole('dialog', { name: 'Toolkit Contents' })).toBeVisible();
        findings.push(...(await sweep(page, 375, `${route} contents sheet`)));
        await page.locator('[data-sheet="contents"] .reading-sheet__close').click();
      }

      // The search sheet (every page below md)
      await page.locator('#mobile-search-lens').click();
      await expect(page.getByRole('dialog', { name: 'Search the toolkit' })).toBeVisible();
      await page.locator('#search-sheet input[type="search"]').fill('water');
      await page.waitForTimeout(600);
      findings.push(...(await sweep(page, 375, `${route} search sheet`)));
      await page.locator('#search-sheet .search-sheet__close').click();

      // The external-link modal (the reading pages carry outside links in
      // their body; /search's article is the search shell)
      const outside = page.locator('.reading-content a.external-link:not(.is-internal)').first();
      if (route !== '/search' && (await outside.count())) {
        await outside.scrollIntoViewIfNeeded();
        await outside.click();
        const modal = page.locator('dialog.external-link-modal[open]');
        await expect(modal, `${route}: the outside-link notice opens`).toBeVisible();
        findings.push(...(await sweep(page, 375, `${route} external-link modal`)));
        await page.keyboard.press('Escape');
      }
    }
    await ctx.close();
    expect(findings, findings.join('\n')).toEqual([]);
  });

  for (const width of [320, 414]) {
    test(`the reviewed pages at ${width}`, async ({ browser }) => {
      test.setTimeout(120_000);
      const ctx = await browser.newContext({
        viewport: { width, height: PHONES[width] },
        hasTouch: true,
      });
      const page = await ctx.newPage();
      const findings: string[] = [];
      for (const route of REVIEWED) {
        await page.goto(route, { waitUntil: 'networkidle' });
        findings.push(...(await sweep(page, width, `${route} at ${width}`)));
      }
      await ctx.close();
      expect(findings, findings.join('\n')).toEqual([]);
    });
  }
});

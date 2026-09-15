/**
 * Index scope in the built HTML (SR11, committed as a dist assertion in the
 * search eng delta): data-pagefind-body rides ONLY the article content of
 * the pages the contents model names; site chrome, /search, and the cover
 * carry none; chrome inside an article is marked ignore; and every
 * article heading carries the static id that search landings use (ES3).
 *
 * Skips without a build (dist is gitignored); run `pnpm build` first.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { urlToChapter } from '@/lib/search/urlToChapter';

const distDir = path.resolve(__dirname, '../../dist');
const DIST_PRESENT = existsSync(path.join(distDir, 'index.html'));

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function routeOf(file: string): string {
  const rel = path.relative(distDir, file).replace(/\\/g, '/');
  const noIndex = rel.replace(/(^|\/)index\.html$/, '');
  return `/${noIndex}`.replace(/\/$/, '') || '/';
}

describe('search index scope (dist)', () => {
  const files = DIST_PRESENT ? htmlFiles(distDir) : [];

  it.skipIf(!DIST_PRESENT)('every data-pagefind-body sits on one article of a contents-model page', () => {
    const indexed: string[] = [];
    for (const file of files) {
      const html = readFileSync(file, 'utf-8');
      const bodies = html.match(/data-pagefind-body/g) ?? [];
      if (bodies.length === 0) continue;
      const route = routeOf(file);
      expect(bodies, `${route} carries more than one index body`).toHaveLength(1);
      expect(/<article[^>]*\sdata-pagefind-body/.test(html), `${route}: the body is not an article`).toBe(true);
      expect(urlToChapter(route), `${route} is indexed but outside the contents model`).not.toBeNull();
      indexed.push(route);
    }
    expect(indexed.length).toBeGreaterThan(15);
  });

  it.skipIf(!DIST_PRESENT)('the cover, /search, and site chrome pages are not indexed', () => {
    for (const route of ['/', '/search', '/modules', '/downloads', '/about', '/map']) {
      const file = path.join(distDir, route === '/' ? 'index.html' : `${route.slice(1)}/index.html`);
      if (!existsSync(file)) continue;
      expect(readFileSync(file, 'utf-8'), `${route} must not be indexed`).not.toContain('data-pagefind-body');
    }
  });

  it.skipIf(!DIST_PRESENT)('chrome inside an indexed article is excluded and every heading carries an id', () => {
    for (const file of files) {
      const html = readFileSync(file, 'utf-8');
      const start = html.indexOf('data-pagefind-body');
      if (start < 0) continue;
      const route = routeOf(file);
      const article = html.slice(start, html.indexOf('</article>', start));
      // The reading chrome inside the article (breadcrumb, prev/next: the
      // no-print navs) is index chrome; content navs such as the recovery
      // continuum stay indexed
      for (const nav of article.match(/<nav[^>]*>/g) ?? []) {
        if (!/no-print/.test(nav)) continue;
        expect(nav, `${route}: nav without data-pagefind-ignore`).toContain('data-pagefind-ignore');
      }
      // The DR17 citation is provenance metadata, never a search hit
      for (const cite of article.match(/<p[^>]*class="[^"]*module-citation[^"]*"[^>]*>/g) ?? []) {
        expect(cite, `${route}: citation indexed`).toContain('data-pagefind-ignore');
      }
      // The chapter action bar is chrome
      if (route !== '/introduction' && !/emergency-preparedness$|baseline-resilience$/.test(route)) {
        expect(article, `${route}: action bar not ignored`).toMatch(/<div[^>]*no-print[^>]*data-pagefind-ignore|<div[^>]*data-pagefind-ignore[^>]*no-print/);
      }
      // The static anchors search lands on (ES3)
      for (const h of article.match(/<h[23][^>]*>/g) ?? []) {
        expect(h, `${route}: heading without id`).toMatch(/\sid="[^"]+"/);
      }
    }
  });
});

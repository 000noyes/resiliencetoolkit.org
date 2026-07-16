import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Homepage "Find your path" section: build-output assertions against dist/.
// The phase cards carry the verbatim one-sentence descriptions (folded from the
// removed "Before, During, and After" section), the module-explorer island is
// gone without remnants, search is a labeled progressive enhancement that ships
// hidden for JS-off users, and the neighbor sections (partners) are undamaged.
// dist/ is gitignored build output — assertions skip when it is absent.
// Run `pnpm build` then `pnpm vitest run tests/build/homepage-find-your-path.test.ts`.

const distDir = path.resolve(__dirname, '../../dist');
const homepageHtmlPath = path.join(distDir, 'index.html');
const HOMEPAGE_PRESENT = existsSync(homepageHtmlPath);

const PHASE_DESCRIPTIONS = [
  'Map assets, build networks, prepare supplies, and train volunteers before disaster strikes.',
  'Coordinate response, track needs, manage volunteers, and communicate with your community.',
  'Track recovery progress, support rebuilding, and strengthen long-term community resilience.',
];

describe('homepage find-your-path section', () => {
  const html = HOMEPAGE_PRESENT ? readFileSync(homepageHtmlPath, 'utf-8') : '';

  it.skipIf(!HOMEPAGE_PRESENT)('renders the section heading and lede', () => {
    expect(html).toContain('Find your path');
    expect(html).toContain('Choose where you are relative to a flood. Everything works offline.');
  });

  it.skipIf(!HOMEPAGE_PRESENT)('renders all three verbatim phase descriptions on the cards', () => {
    for (const description of PHASE_DESCRIPTIONS) {
      expect(html).toContain(description);
    }
  });

  it.skipIf(!HOMEPAGE_PRESENT)('the phase-cards nav landmark appears exactly once', () => {
    const matches = html.match(/aria-label="Phases of a flood"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it.skipIf(!HOMEPAGE_PRESENT)('module-explorer island leaves no remnants', () => {
    expect(html).not.toContain('data-module-pill');
    expect(html).not.toContain('data-phase-filter');
    expect(html).not.toContain('data-detail-panel');
    expect(html).not.toContain('data-mobile-detail-panel');
    expect(html).not.toContain('Explore the toolkit yourself.');
    expect(html).not.toContain('Hover over a module to see its description.');
  });

  it.skipIf(!HOMEPAGE_PRESENT)('the duplicate Before, During, and After section is gone', () => {
    expect(html).not.toContain('Before, During, and After');
  });

  it.skipIf(!HOMEPAGE_PRESENT)('module links row lists all five module titles', () => {
    expect(html).toContain('Or start from a module:');
    for (const title of [
      'Introduction',
      'Knowing Your Community',
      'Emergency Preparedness and Response',
      'Baseline Resilience',
      'Resource Library',
    ]) {
      expect(html).toContain(title);
    }
  });

  it.skipIf(!HOMEPAGE_PRESENT)('search input has a real associated label', () => {
    expect(html).toMatch(/<label[^>]*for="pagefind-search"/);
    expect(html).toContain('Search by keyword:');
  });

  it.skipIf(!HOMEPAGE_PRESENT)('search row ships hidden (JS-off users never see a dead input)', () => {
    const searchRow = html.match(/<div[^>]*data-pagefind-search[^>]*>/);
    expect(searchRow).not.toBeNull();
    expect(searchRow![0]).toContain('hidden');
  });

  it.skipIf(!HOMEPAGE_PRESENT)('search status element carries role="status" (never the hits list)', () => {
    const statusEl = html.match(/<div[^>]*data-search-status[^>]*>/);
    expect(statusEl).not.toBeNull();
    expect(statusEl![0]).toContain('role="status"');
    const hitsEl = html.match(/<div[^>]*data-search-hits[^>]*>/);
    expect(hitsEl).not.toBeNull();
    expect(hitsEl![0]).not.toContain('role="status"');
  });

  it.skipIf(!HOMEPAGE_PRESENT)('Explore All Modules CTA in the section is the outline variant', () => {
    const sectionStart = html.indexOf('Find your path');
    const sectionEnd = html.indexOf('The Challenge');
    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    const section = html.slice(sectionStart, sectionEnd);
    const cta = section.match(/<a[^>]*href="\/modules"[^>]*>/);
    expect(cta).not.toBeNull();
    expect(cta![0]).toContain('border-primary');
    expect(cta![0]).not.toContain('action-button-primary');
  });

  it.skipIf(!HOMEPAGE_PRESENT)('noscript module list is present and dash-free', () => {
    const noscript = html.match(/<noscript>[\s\S]*?<\/noscript>/g) ?? [];
    const moduleList = noscript.find((block) => block.includes('All Modules'));
    expect(moduleList).toBeDefined();
    expect(moduleList).not.toContain('—');
    expect(moduleList).not.toContain('–');
  });

  it.skipIf(!HOMEPAGE_PRESENT)('origin-story photos ship as /_astro derivatives with dimensions', () => {
    const originStart = html.indexOf('The Challenge');
    expect(originStart).toBeGreaterThan(-1);
    const origin = html.slice(originStart);
    const imgs = origin.match(/<img[^>]+>/g) ?? [];
    const photos = imgs.filter((img) => img.includes('src="/_astro/'));
    expect(photos.length).toBeGreaterThanOrEqual(2);
    for (const img of photos.slice(0, 2)) {
      expect(img).toMatch(/width="\d+"/);
      expect(img).toMatch(/height="\d+"/);
      expect(img).toContain('loading="lazy"');
      expect(img).toContain('decoding="async"');
    }
  });

  it.skipIf(!HOMEPAGE_PRESENT)('washout alt names the Great Brook; locked captions are verbatim', () => {
    expect(html).toMatch(/alt="[^"]*Great Brook[^"]*"/);
    expect(html).toContain('Plainfield road closed for culvert repair, July 2023');
    expect(html).toContain('The Great Brook reclaiming ground, Plainfield, July 2023');
  });

  it.skipIf(!HOMEPAGE_PRESENT)('all 10 partner links survive (neighbor-damage guard)', () => {
    const partnersStart = html.indexOf('Built With Grassroots Partners');
    expect(partnersStart).toBeGreaterThan(-1);
    const partnersEnd = html.indexOf('Works Without Internet After First Visit');
    const partners = html.slice(partnersStart, partnersEnd);
    const links = partners.match(/<a[^>]*href="https?:\/\/[^"]+"[^>]*>/g) ?? [];
    expect(links).toHaveLength(10);
  });
});

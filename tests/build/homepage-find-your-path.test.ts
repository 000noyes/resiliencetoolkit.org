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

  it.skipIf(!HOMEPAGE_PRESENT)('the cover carries the full chapter list in tree order (DR6/DR8)', () => {
    expect(html).toMatch(/<nav[^>]*class="cover-contents"[^>]*aria-label="Toolkit contents"/);
    // Every chapter row, in reading order, title-only
    const numbers = [...html.matchAll(/cover-contents__number">([\d.]+)</g)].map((m) => m[1]);
    expect(numbers).toEqual([
      '0.1',
      '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13',
      '2.1', '2.2', '2.3',
    ]);
    // Front and back matter close the list with their signed subtitles
    expect(html).toContain('How to use this toolkit');
    expect(html).toContain('Print and download the toolkit');
  });

  it.skipIf(!HOMEPAGE_PRESENT)('the signed newcomer lines sit below the chapter list (DR11/DR22)', () => {
    expect(html).toContain(
      '0.1 Knowing Your Community is the first activity. It works best with a few other people.'
    );
    expect(html).toContain(
      'Community Resilience Organizations offers free help getting started.'
    );
    expect(html).toMatch(/<section id="technical-assistance"/);
  });

  it.skipIf(!HOMEPAGE_PRESENT)('the cover lands row-less: no search input, no retired strings (SE3/DR9)', () => {
    expect(html).not.toContain('data-pagefind-search');
    expect(html).not.toContain('Search by keyword:');
    expect(html).not.toContain('Or start from a module:');
    // The find-your-path section carries no Explore All Modules CTA; the
    // final ready-to-build CTA keeps its own
    const sectionStart = html.indexOf('Find your path');
    const sectionEnd = html.indexOf('The Challenge');
    const section = html.slice(sectionStart, sectionEnd);
    expect(section).not.toContain('Explore All Modules');
  });

  it.skipIf(!HOMEPAGE_PRESENT)('the After lead renders in the After green, never --secondary (DR12/ER5)', () => {
    expect(html).toMatch(/phase-cards__lead--after[^>]*>\s*Still being shaped/);
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

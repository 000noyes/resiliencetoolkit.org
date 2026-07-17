import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Radius-scale sweep: build-output assertions against dist/.
// Full radius (9999px / rounded-full) is reserved for true circles (step
// numbers, icon circles, spinners, phase dots); text chips, badges, and
// buttons use the hierarchical sm/md/lg/xl scale (see DESIGN.md). The phase
// chips on /modules echo the PhaseSlider continuum via .meta-chip__dot--*.
// dist/ is gitignored build output — assertions skip when it is absent.
// Run `pnpm build` then `pnpm vitest run tests/build/radius-scale-chips.test.ts`.

const distDir = path.resolve(__dirname, '../../dist');

const pages = {
  homepage: path.join(distDir, 'index.html'),
  modulesIndex: path.join(distDir, 'modules/index.html'),
  changelog: path.join(distDir, 'changelog/index.html'),
};

const DIST_PRESENT = existsSync(distDir);

function read(p: string): string {
  return existsSync(p) ? readFileSync(p, 'utf-8') : '';
}

// Class attributes that may legitimately keep rounded-full: true circles only.
const CIRCLE_MARKERS = [/w-8 h-8/, /w-10 h-10/, /w-16 h-16/, /animate-spin/, /h-2\b/];

function nonCircleRoundedFull(html: string): string[] {
  const classAttrs = html.match(/class="[^"]*rounded-full[^"]*"/g) ?? [];
  return classAttrs.filter(attr => !CIRCLE_MARKERS.some(re => re.test(attr)));
}

describe('radius scale on text chips (no full-radius pills)', () => {
  it.skipIf(!DIST_PRESENT)('homepage badges use the radius scale, rounded-full survives only on true circles', () => {
    const html = read(pages.homepage);
    expect(html.length).toBeGreaterThan(0);
    // The Badge signature (hero, origin story, offline) is scale-rounded now
    expect(html).toContain('px-2.5 py-0.5 rounded-md');
    expect(html).not.toContain('px-2.5 py-0.5 rounded-full');
    // Any remaining rounded-full class attr must be a true circle
    expect(nonCircleRoundedFull(html)).toEqual([]);
  });

  it.skipIf(!DIST_PRESENT)('modules index chips are scale-rounded; phase chips carry continuum dots', () => {
    const html = read(pages.modulesIndex);
    expect(html.length).toBeGreaterThan(0);
    // Header icon circles are the only permitted rounded-full occurrences
    expect(nonCircleRoundedFull(html)).toEqual([]);
    expect(html).not.toContain('py-1 rounded-full');
    expect(html).toContain('meta-chip');
    for (const phase of ['before', 'during', 'after']) {
      expect(html).toContain(`meta-chip__dot--${phase}`);
    }
    // The retired Before=blue mapping must leave no remnants
    expect(html).not.toContain('bg-blue-100');
  });

  it.skipIf(!DIST_PRESENT)('changelog tag badges use the radius scale', () => {
    const html = read(pages.changelog);
    expect(html.length).toBeGreaterThan(0);
    expect(html).not.toContain('px-2.5 py-0.5 rounded-full');
    expect(nonCircleRoundedFull(html)).toEqual([]);
  });

  it.skipIf(!DIST_PRESENT)('built CSS defines the shared chip classes and the --phase-during token', () => {
    const astroDir = path.join(distDir, '_astro');
    const cssFiles = existsSync(astroDir)
      ? readdirSync(astroDir).filter(f => f.endsWith('.css'))
      : [];
    const css = cssFiles.map(f => readFileSync(path.join(astroDir, f), 'utf-8')).join('\n');
    expect(css).toContain('.meta-chip');
    expect(css).toContain('--phase-during');
    // Floating triggers sit at the top of the scale, never 9999px
    expect(css).not.toContain('.toc-mobile-trigger{border-radius:9999px');
  });
});

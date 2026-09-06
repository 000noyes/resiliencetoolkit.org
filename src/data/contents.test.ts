/**
 * Consistency guards for the one contents model.
 *
 * The model is the single source of truth for the toolkit's reading order;
 * these tests hold the shape every render depends on: unique resolvable
 * chapters, chain integrity per mode, the tree ending at Resource Library,
 * and the derived views tracking the model.
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import {
  allChapters,
  chainFor,
  chainMode,
  chapterUrl,
  contents,
  findChapter,
  frontMatter,
  readingChain,
  resourceLibrary,
  treeRows,
} from './contents';
import { moduleDownloads } from './downloads';
import { modules } from './modules';
import { getPdfUrlForSection } from '@/lib/pdfLookup';
import { getResourcesUrlForSection } from '@/lib/resourcesLookup';

const chapters = allChapters();

describe('chapter identity', () => {
  it('holds all 17 chapters in printed order', () => {
    expect(chapters.map(({ chapter }) => chapter.number)).toEqual([
      '0.1',
      '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13',
      '2.1', '2.2', '2.3',
    ]);
  });

  it('has unique numbers and page URLs', () => {
    const numbers = chapters.map(({ chapter }) => chapter.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    const urls = chapters.map(({ chapter }) => chapterUrl(chapter.number));
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('resolves every chapter to an existing page file', () => {
    for (const { chapter, section } of chapters) {
      const url = `${section.basePath}/${chapter.slug}`;
      const pagePath = `src/pages${url}.astro`;
      expect(existsSync(pagePath), `${chapter.number} -> ${pagePath}`).toBe(true);
    }
  });

  it('resolves a PDF and a resources link for every chapter', () => {
    for (const { chapter } of chapters) {
      expect(getPdfUrlForSection(chapter.number), chapter.number).not.toBeNull();
      expect(getResourcesUrlForSection(chapter.number), chapter.number).not.toBeNull();
    }
  });

  it('records printed source pages for every chapter', () => {
    for (const { chapter } of chapters) {
      expect(chapter.sourcePages, chapter.number).toMatch(/^\d+(-\d+)?$/);
    }
  });
});

describe('reading chain', () => {
  it('answers null/null for unknown ids', () => {
    expect(chainFor('9.9')).toEqual({ prev: null, next: null });
  });

  if (chainMode === 'shipped') {
    it('reproduces the shipped links: sections are islands, 0.1 bridges', () => {
      expect(chainFor('0.1').prev).toMatchObject({
        label: `${frontMatter.number} ${frontMatter.title}`,
        href: frontMatter.path,
      });
      expect(chainFor('0.1').next).toMatchObject({ id: '1.1' });
      expect(chainFor('1.1').prev).toBeNull();
      expect(chainFor('1.13').next).toBeNull();
      expect(chainFor('2.1').prev).toBeNull();
      expect(chainFor('2.3').next).toBeNull();
      expect(chainFor('1.2').prev).toMatchObject({ id: '1.1' });
      expect(chainFor('1.2').next).toMatchObject({ id: '1.3' });
    });
  }

  if (chainMode === 'dr4') {
    it('walks the DR4 chain: openers sit IN the linear reading order', () => {
      expect(chainFor('0.1').prev).toMatchObject({ href: frontMatter.path });
      expect(chainFor('0.1').next).toMatchObject({ id: 'opener-1' });
      expect(chainFor('opener-1').prev).toMatchObject({ id: '0.1' });
      expect(chainFor('opener-1').next).toMatchObject({ id: '1.1' });
      expect(chainFor('1.13').next).toMatchObject({ id: 'opener-2' });
      expect(chainFor('opener-2').prev).toMatchObject({ id: '1.13' });
      expect(chainFor('opener-2').next).toMatchObject({ id: '2.1' });
      expect(chainFor('2.3').next).toBeNull();
    });

    it('is symmetric at every stop', () => {
      const stops = readingChain('dr4');
      for (let i = 0; i < stops.length; i++) {
        const { prev, next } = chainFor(stops[i].id);
        expect(prev?.id ?? null).toBe(stops[i - 1]?.id ?? null);
        expect(next?.id ?? null).toBe(stops[i + 1]?.id ?? null);
      }
    });
  }

  it('keeps the dr4 chain well-formed for the P3 flip', () => {
    const stops = readingChain('dr4');
    expect(stops[0].href).toBe(frontMatter.path);
    expect(stops.map((s) => s.id)).toContain('opener-1');
    expect(stops.map((s) => s.id)).toContain('opener-2');
    expect(stops[stops.length - 1].id).toBe('2.3');
    expect(new Set(stops.map((s) => s.id)).size).toBe(stops.length);
  });
});

describe('tree render', () => {
  it('starts at the front matter and ends at Resource Library', () => {
    const rows = treeRows();
    expect(rows[0]).toMatchObject({ kind: 'front-matter', href: frontMatter.path });
    expect(rows[rows.length - 1]).toMatchObject({
      kind: 'back-matter',
      label: resourceLibrary.title,
      href: resourceLibrary.path,
    });
  });

  it('never renders site chrome (Map, About, Changes) as rows', () => {
    const hrefs = treeRows().map((r) => r.href);
    expect(hrefs).not.toContain('/map');
    expect(hrefs).not.toContain('/about');
    expect(hrefs).not.toContain('/changelog');
  });
});

describe('derived views', () => {
  it('orders moduleDownloads exactly as the model reads', () => {
    expect(moduleDownloads.map((m) => m.number)).toEqual(
      chapters.map(({ chapter }) => chapter.number)
    );
    for (const [i, m] of moduleDownloads.entries()) {
      const { chapter, section } = chapters[i];
      expect(m.onlineUrl).toBe(`${section.basePath}/${chapter.slug}`);
      expect(m.pdfFilename).toBe(chapter.pdfFilename);
      expect(m.section).toBe(`Section ${section.number}`);
    }
  });

  it('orders the module cards as front matter, sections, back matter', () => {
    expect(modules.map((m) => m.slug)).toEqual([
      'introduction',
      ...contents.map((s) => s.slug),
      'downloads',
    ]);
    const km = modules.find((m) => m.slug === 'knowing-your-community');
    expect(km).toMatchObject({ url: '/modules/knowing-your-community' });
    expect(findChapter('0.1')?.section.openerPath).toBeNull();
  });
});

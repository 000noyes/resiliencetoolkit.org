/**
 * The deterministic URL-to-contents join (ES3) is TOTAL over the one
 * model: every page the model names resolves to its group, in reading
 * order, from any URL shape Pagefind may hand back; anything outside
 * the model is null. Search groups derive from here, never a hand-map.
 */
import { describe, expect, it } from 'vitest';
import { allChapters, chapterUrl, contents, frontMatter, searchRoute } from '@/data/contents';
import { joinableUrls, urlToChapter } from './urlToChapter';

describe('urlToChapter totality', () => {
  it('resolves the front matter, every opener, and every chapter', () => {
    expect(urlToChapter(frontMatter.path)?.label).toBe(frontMatter.title);
    for (const section of contents) {
      if (section.openerPath) {
        expect(urlToChapter(section.openerPath)?.label, section.openerPath).toBe(section.title);
      }
    }
    for (const { chapter } of allChapters()) {
      const url = chapterUrl(chapter.number)!;
      const group = urlToChapter(url);
      expect(group, url).not.toBeNull();
      expect(group!.label).toBe(`${chapter.number} ${chapter.title}`);
      expect(group!.url).toBe(url);
    }
  });

  it('joins from every URL shape: trailing slash, hash, query, absolute', () => {
    const url = chapterUrl('1.2')!;
    const expected = urlToChapter(url);
    expect(expected).not.toBeNull();
    expect(urlToChapter(`${url}/`)).toEqual(expected);
    expect(urlToChapter(`${url}/#food-and-water`)).toEqual(expected);
    expect(urlToChapter(`${url}#food-and-water`)).toEqual(expected);
    expect(urlToChapter(`${url}/?x=1`)).toEqual(expected);
    expect(urlToChapter(`https://resiliencetoolkit.org${url}/`)).toEqual(expected);
  });

  it('orders groups in reading order (front matter first, sections in sequence)', () => {
    const orders = joinableUrls().map((u) => urlToChapter(u)!.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(urlToChapter(frontMatter.path)!.order).toBe(0);
    expect(urlToChapter(chapterUrl('0.1')!)!.order).toBeLessThan(urlToChapter(chapterUrl('1.1')!)!.order);
    expect(urlToChapter(chapterUrl('1.13')!)!.order).toBeLessThan(urlToChapter(chapterUrl('2.1')!)!.order);
  });

  it('is null outside the model, including the search route and site chrome', () => {
    expect(urlToChapter(searchRoute)).toBeNull();
    expect(urlToChapter('/')).toBeNull();
    expect(urlToChapter('/modules')).toBeNull();
    expect(urlToChapter('/downloads')).toBeNull();
    expect(urlToChapter('/about')).toBeNull();
    expect(urlToChapter('/modules/emergency-preparedness/9-9')).toBeNull();
  });

  it('exposes exactly the model pages as joinable', () => {
    const expected = 1 + contents.filter((s) => s.openerPath).length + allChapters().length;
    expect(joinableUrls()).toHaveLength(expected);
  });
});

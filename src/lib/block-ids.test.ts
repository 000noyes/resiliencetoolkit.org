/**
 * Per-block annotation ids (ER4/DR18): derived from the static section
 * header ids, one level deep, in the kept API's shape.
 */
import { describe, expect, it } from 'vitest';
import { BLOCK_ID_RE, withBlockIds } from './block-ids';
import { withHeadingIds } from './heading-ids';

const ids = (html: string) => [...html.matchAll(/data-annot="([^"]+)"/g)].map((m) => m[1]);

describe('withBlockIds', () => {
  it('ids tables, body rows under their band, and skips header rows and nested prose', () => {
    const src =
      '<table class="guide-table"><thead><tr><th>Systems</th><th>Stuff</th></tr></thead><tbody>' +
      '<tr><td colspan="2"><strong>Backup food supply</strong></td></tr>' +
      '<tr><td><p>Create stores.</p></td><td><div><p>List</p></div></td></tr>' +
      '<tr><td colspan="2"><strong>Community meals</strong></td></tr>' +
      '<tr><td>Row</td><td>Row</td></tr></tbody></table>';
    const out = withBlockIds(withHeadingIds(src), '1-2');
    expect(ids(out)).toEqual([
      '1-2--top--t1',
      '1-2--backup-food-supply--r1',
      '1-2--backup-food-supply--r2',
      '1-2--community-meals--r1',
      '1-2--community-meals--r2',
    ]);
    // The header row and the paragraphs inside cells carry nothing
    expect(out).toContain('<tr><th>Systems</th>');
    expect(out).not.toMatch(/<p[^>]*data-annot/);
  });

  it('ids prose blocks under their heading and leaves list items to their list', () => {
    const src =
      '<h2>What is resilience?</h2><p>One.</p><p>Two.</p><ul><li><p>Inner</p></li></ul>' +
      '<h3>A sub</h3><ol><li>x</li></ol><blockquote>q</blockquote><figure>f</figure>';
    const out = withBlockIds(withHeadingIds(src), 'intro');
    expect(ids(out)).toEqual([
      'intro--what-is-resilience--p1',
      'intro--what-is-resilience--p2',
      'intro--what-is-resilience--l1',
      'intro--a-sub--l1',
      'intro--a-sub--q1',
      'intro--a-sub--f1',
    ]);
  });

  it('keeps an authored data-annot and never repeats an id', () => {
    const out = withBlockIds('<p data-annot="hero">a</p><p>b</p>', 'x');
    expect(ids(out)).toEqual(['hero', 'x--top--p1']);
  });

  it('truncates long section slugs and stays inside the API shape rule', () => {
    const src = '<h2>Warming / Cooling / Emergency Shelter and other long words here</h2><p>a</p>';
    const out = withBlockIds(withHeadingIds(src), '1-5');
    const [id] = ids(out);
    expect(id).toBe('1-5--warming-cooling-emergency-shelte--p1');
    expect(id.length).toBeLessThanOrEqual(64);
    expect(BLOCK_ID_RE.test(id)).toBe(true);
  });

  it('is deterministic: the same markup yields the same ids', () => {
    const src = '<h2>A</h2><p>x</p><table><tbody><tr><td>y</td></tr></tbody></table>';
    expect(withBlockIds(src, 'k')).toBe(withBlockIds(src, 'k'));
  });
});

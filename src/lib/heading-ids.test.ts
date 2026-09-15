/**
 * The one id system (SR3/ES3): static heading ids derived at build with
 * the same slugify the On this page scanner uses, authored ids kept,
 * page ids reserved so nothing collides.
 */
import { describe, expect, it } from 'vitest';
import { ensureUniqueId, slugify, withHeadingIds } from './heading-ids';

describe('slugify', () => {
  it('lowercases, drops punctuation, joins words with single hyphens', () => {
    expect(slugify("What's beyond resilience?")).toBe('whats-beyond-resilience');
    expect(slugify('  Food   and water  ')).toBe('food-and-water');
    expect(slugify('Warming / Cooling / Emergency Shelter')).toBe('warming-cooling-emergency-shelter');
  });
});

describe('ensureUniqueId', () => {
  it('suffixes from 2 and reserves what it returns', () => {
    const used = new Set<string>(['a']);
    expect(ensureUniqueId('a', used)).toBe('a-2');
    expect(ensureUniqueId('a', used)).toBe('a-3');
    expect(ensureUniqueId('b', used)).toBe('b');
    expect(used).toEqual(new Set(['a', 'a-2', 'a-3', 'b']));
  });
});

describe('withHeadingIds', () => {
  it('gives h2 and h3 an id from their text and leaves other tags alone', () => {
    const out = withHeadingIds('<h1>Title</h1><h2 class="x">Food and water</h2><h3>Go bag</h3><p>text</p>');
    expect(out).toBe(
      '<h1>Title</h1><h2 class="x" id="food-and-water">Food and water</h2><h3 id="go-bag">Go bag</h3><p>text</p>'
    );
  });

  it('keeps an authored id', () => {
    const out = withHeadingIds('<h2 id="kept">Something</h2>');
    expect(out).toBe('<h2 id="kept">Something</h2>');
  });

  it('reads through inline markup and entities', () => {
    const out = withHeadingIds('<h2>Mutual Aid <em>&amp;</em> Neighbor&nbsp;to Neighbor</h2>');
    expect(out).toContain('id="mutual-aid-neighbor-to-neighbor"');
  });

  it('never collides: repeated headings suffix, existing page ids are reserved', () => {
    const out = withHeadingIds(
      '<div id="notes"></div><h2>Notes</h2><h3>Notes</h3><h2>Other</h2><h2>Other</h2>'
    );
    expect(out).toContain('<h2 id="notes-2">Notes</h2>');
    expect(out).toContain('<h3 id="notes-3">Notes</h3>');
    expect(out).toContain('<h2 id="other">Other</h2>');
    expect(out).toContain('<h2 id="other-2">Other</h2>');
  });

  it('ids the table band labels a chapter reads by, in document order with the headings', () => {
    const out = withHeadingIds(
      '<h2>Notes</h2><table><tr><td colspan="2"><strong>Backup food supply</strong></td></tr>' +
        '<tr><td>\n  <strong>Notes</strong> for the row</td></tr>' +
        '<tr><td><strong>Not a band</strong></td><td>second cell</td></tr>' +
        '<tr><td colspan="2"><strong><a href="https://x.example">Link only</a></strong></td></tr></table>'
    );
    expect(out).toContain('<h2 id="notes">Notes</h2>');
    expect(out).toContain('<td colspan="2"><strong id="backup-food-supply">Backup food supply</strong>');
    expect(out).toContain('<strong id="notes-2">Notes</strong> for the row');
    expect(out).toContain('<td><strong>Not a band</strong></td><td>second cell</td>');
    expect(out).toContain('<strong><a href="https://x.example">Link only</a></strong>');
  });

  it('skips a heading whose text yields no slug', () => {
    expect(withHeadingIds('<h2>???</h2>')).toBe('<h2>???</h2>');
  });

  it('handles multi-line tags', () => {
    const out = withHeadingIds('<h2\n  class="a b"\n>Two\nlines</h2>');
    expect(out).toContain('id="two-lines"');
  });
});

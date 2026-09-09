/**
 * The search landing (BR5): the searched words under the header the
 * result named, phrase first, then the first word, never past the next
 * section header, and never the header's own text.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { clearLandingMark, findLandingRange, markLanding } from './landing';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe('findLandingRange', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds the whole phrase under the header', () => {
    const root = mount(
      '<h2 id="a">Mutual aid networks</h2><p>Lists of <em>mutual aid</em> groups.</p><h2 id="b">Next</h2><p>mutual aid again</p>'
    );
    const range = findLandingRange(root.querySelector('#a')!, 'Mutual  Aid', root);
    expect(range).not.toBeNull();
    expect(range!.node.data).toBe('mutual aid');
    expect(range!.start).toBe(0);
    expect(range!.length).toBe(10);
  });

  it('falls back to the first word in query order when the phrase is split', () => {
    const root = mount('<h3 id="a">Header</h3><p>Aid arrives. Then mutual support.</p>');
    const range = findLandingRange(root.querySelector('#a')!, 'mutual aid', root);
    expect(range!.node.data.slice(range!.start, range!.start + range!.length)).toBe('mutual');
  });

  it('stops at the next section header and skips the header itself', () => {
    const root = mount(
      '<h2 id="a">mutual aid</h2><p>nothing here</p><strong id="band">Band</strong><p>mutual aid below the band</p>'
    );
    expect(findLandingRange(root.querySelector('#a')!, 'mutual aid', root)).toBeNull();
  });

  it('ignores annotation chrome and hidden text', () => {
    const root = mount(
      '<h2 id="a">A</h2><div data-annot-ui>mutual aid</div><p hidden>mutual aid</p><p>plain</p>'
    );
    expect(findLandingRange(root.querySelector('#a')!, 'mutual aid', root)).toBeNull();
  });
});

describe('markLanding and clearLandingMark', () => {
  it('wraps the words in a focusable mark and unwraps it cleanly', () => {
    const root = mount('<h2 id="a">A</h2><p>Lists of mutual aid groups.</p>');
    const range = findLandingRange(root.querySelector('#a')!, 'mutual aid', root)!;
    const mark = markLanding(range);
    expect(mark.tagName).toBe('MARK');
    expect(mark.className).toBe('search-mark search-landing');
    expect(mark.tabIndex).toBe(-1);
    expect(root.querySelector('p')!.innerHTML).toBe('Lists of <mark class="search-mark search-landing" tabindex="-1">mutual aid</mark> groups.');
    clearLandingMark(root);
    expect(root.querySelector('p')!.innerHTML).toBe('Lists of mutual aid groups.');
    expect(root.querySelector('p')!.childNodes.length).toBe(1);
  });
});

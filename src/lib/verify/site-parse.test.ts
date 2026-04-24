import { describe, it, expect } from 'vitest';
import {
  extractLinks,
  extractHeadings,
  extractDataTables,
  extractColumnsProp,
} from './site-parse';

describe('site-parse: extractLinks', () => {
  it('extracts plain <a href> links', () => {
    const src = `<p>See <a href="https://example.org/path">Example</a>.</p>`;
    const links = extractLinks(src);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      href: 'https://example.org/path',
      component: 'a',
      anchor_text: 'Example',
    });
    expect(links[0].line).toBe(1);
  });

  it('extracts <ExternalLink href>', () => {
    const src = `<ExternalLink href="https://batjc.org/">Bay Area TJC</ExternalLink>`;
    const links = extractLinks(src);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      href: 'https://batjc.org/',
      component: 'ExternalLink',
      anchor_text: 'Bay Area TJC',
    });
  });

  it('handles multi-line ExternalLink with attributes before href', () => {
    const src = [
      '<ExternalLink',
      '  class="something"',
      '  href="https://a.example/b"',
      '>',
      '  inner text',
      '</ExternalLink>',
    ].join('\n');
    const links = extractLinks(src);
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('https://a.example/b');
    expect(links[0].anchor_text).toBe('inner text');
  });

  it('extracts links in document order across both component kinds', () => {
    const src =
      `<a href="/modules/emergency-preparedness/1-8">1.8</a>\n` +
      `<ExternalLink href="https://x.example">X</ExternalLink>\n` +
      `<a href="https://y.example">Y</a>`;
    const links = extractLinks(src);
    expect(links.map((l) => l.href)).toEqual([
      '/modules/emergency-preparedness/1-8',
      'https://x.example',
      'https://y.example',
    ]);
    expect(links[0].line).toBeLessThan(links[1].line);
  });

  it('strips nested tags from anchor text', () => {
    const src = `<a href="https://x.example">Leader <em>Directory</em></a>`;
    expect(extractLinks(src)[0].anchor_text).toBe('Leader Directory');
  });

  it('ignores expression-form href (href={url}) — documented non-goal', () => {
    const src = `<a href={computed}>x</a>`;
    expect(extractLinks(src)).toEqual([]);
  });

  it('handles single-quoted href', () => {
    const src = `<a href='https://x.example'>x</a>`;
    expect(extractLinks(src)[0].href).toBe('https://x.example');
  });
});

describe('site-parse: extractHeadings', () => {
  it('extracts h1/h2/h3 with level and text', () => {
    const src = [
      '<h1>Knowing Your Community</h1>',
      '<h2>Mapping</h2>',
      '<h3>Assets</h3>',
    ].join('\n');
    const hs = extractHeadings(src);
    expect(hs.map((h) => [h.level, h.text])).toEqual([
      [1, 'Knowing Your Community'],
      [2, 'Mapping'],
      [3, 'Assets'],
    ]);
  });

  it('collapses whitespace and strips nested tags', () => {
    const src = `<h2>  Hello   <span>there</span>  </h2>`;
    expect(extractHeadings(src)[0].text).toBe('Hello there');
  });

  it('ignores empty headings', () => {
    expect(extractHeadings(`<h2></h2>`)).toEqual([]);
  });

  it('preserves document order', () => {
    const src = `<h3>c</h3>\n<h1>a</h1>\n<h2>b</h2>`;
    expect(extractHeadings(src).map((h) => h.text)).toEqual(['c', 'a', 'b']);
  });
});

describe('site-parse: extractDataTables', () => {
  it('extracts moduleKey/tableId and columns', () => {
    const src = `
<DataTable
  moduleKey="1-1-kits"
  tableId="roles"
  columns={[
    { key: 'Role', label: 'Role', type: 'text', readonly: true, priority: 1 },
    { key: 'Name(s)', label: 'Name(s)', type: 'text', placeholder: 'Name(s)', priority: 1 }
  ]}
  client:idle
/>`;
    const tables = extractDataTables(src);
    expect(tables).toHaveLength(1);
    expect(tables[0].moduleKey).toBe('1-1-kits');
    expect(tables[0].tableId).toBe('roles');
    expect(tables[0].columns).toEqual([
      { key: 'Role', label: 'Role' },
      { key: 'Name(s)', label: 'Name(s)' },
    ]);
  });

  it('handles multiple DataTables in one file', () => {
    const src = `
<DataTable moduleKey="a" tableId="t1" columns={[{ key: 'X', label: 'X' }]} />
<DataTable moduleKey="a" tableId="t2" columns={[{ key: 'Y', label: 'Y' }]} />`;
    const tables = extractDataTables(src);
    expect(tables).toHaveLength(2);
    expect(tables[0].tableId).toBe('t1');
    expect(tables[1].tableId).toBe('t2');
  });

  it('returns empty columns when the prop is missing', () => {
    const src = `<DataTable moduleKey="a" tableId="t" />`;
    const tables = extractDataTables(src);
    expect(tables).toHaveLength(1);
    expect(tables[0].columns).toEqual([]);
  });

  it('tolerates trailing commas and nested brace expressions (boundaries)', () => {
    const src = `<DataTable columns={[
      { key: 'A', label: 'A', },
      { key: 'B' },
    ]} />`;
    const tables = extractDataTables(src);
    expect(tables[0].columns).toEqual([{ key: 'A', label: 'A' }, { key: 'B' }]);
  });
});

describe('site-parse: extractColumnsProp boundary cases', () => {
  it('returns [] on malformed JSX expr', () => {
    expect(extractColumnsProp(`<DataTable columns={[ broken `)).toEqual([]);
  });

  it('supports double-quoted object keys', () => {
    const tag = `<DataTable columns={[ { "key": "full-name", "label": "Full Name" } ]} />`;
    expect(extractColumnsProp(tag)).toEqual([
      { key: 'full-name', label: 'Full Name' },
    ]);
  });
});

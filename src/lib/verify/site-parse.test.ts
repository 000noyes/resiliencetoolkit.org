import { describe, it, expect } from 'vitest';
import {
  extractLinks,
  extractHeadings,
  extractDataTables,
  extractColumnsProp,
  extractPlanForms,
  extractParagraphs,
  extractSectionNumber,
  extractIntegerExpressionProp,
  extractSlotCollections,
} from './site-parse';

describe('site-parse: extractSectionNumber', () => {
  it('extracts the number from a typed sectionData block', () => {
    const src = `
const sectionData: SectionData = {
  number: "1.3",
  title: "First aid and medical",
};
---`;
    expect(extractSectionNumber(src)).toBe('1.3');
  });

  it('extracts single-quoted section numbers', () => {
    const src = `
const sectionData: SectionData = {
  number: '1.4',
  title: 'Power supply',
};`;
    expect(extractSectionNumber(src)).toBe('1.4');
  });

  it('returns null when there is no sectionData block', () => {
    expect(extractSectionNumber(`<p>Module index page</p>`)).toBeNull();
  });

  it('returns null when sectionData has no string-literal number', () => {
    const src = `
const sectionData: SectionData = {
  number: sectionNumber,
  title: "Computed",
};`;
    expect(extractSectionNumber(src)).toBeNull();
  });
});

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

describe('site-parse: extractPlanForms', () => {
  it('extracts moduleKey/formId from a self-closed PlanForm', () => {
    const src = `<PlanForm moduleKey="1-9" formId="emergency-plan" fields={planFields} title="Plan" />`;
    const out = extractPlanForms(src);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ moduleKey: '1-9', formId: 'emergency-plan' });
    expect(out[0].line).toBe(1);
  });

  it('handles multiple PlanForms in one file', () => {
    const src = `<PlanForm moduleKey="a" formId="f1" fields={x} title="A" />
<PlanForm moduleKey="b" formId="f2" fields={y} title="B" />`;
    const out = extractPlanForms(src);
    expect(out).toHaveLength(2);
    expect(out.map((f) => f.formId)).toEqual(['f1', 'f2']);
  });

  it('tolerates PlanForm with no string-literal props', () => {
    const src = `<PlanForm {...spread} />`;
    const out = extractPlanForms(src);
    expect(out).toHaveLength(1);
    expect(out[0].moduleKey).toBeUndefined();
    expect(out[0].formId).toBeUndefined();
  });
});

describe('site-parse: extractParagraphs', () => {
  it('extracts <p> text', () => {
    const src = `<p>Hello world.</p>`;
    const out = extractParagraphs(src);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ tag: 'p', text: 'Hello world.', line: 1 });
  });

  it('extracts <li> text', () => {
    const src = `<ul><li>One</li><li>Two</li></ul>`;
    const out = extractParagraphs(src);
    expect(out.map((o) => [o.tag, o.text])).toEqual([
      ['li', 'One'],
      ['li', 'Two'],
    ]);
  });

  it('strips nested inline tags (ExternalLink, strong, em)', () => {
    const src = `<p>See <ExternalLink href="https://x.example">the link</ExternalLink> for <strong>details</strong>.</p>`;
    expect(extractParagraphs(src)[0].text).toBe('See the link for details.');
  });

  it('collapses whitespace', () => {
    const src = `<p>  lots\n  of   whitespace  </p>`;
    expect(extractParagraphs(src)[0].text).toBe('lots of whitespace');
  });

  it('skips empty paragraphs', () => {
    const src = `<p></p><p>real text here</p><p>   </p>`;
    const out = extractParagraphs(src);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('real text here');
  });

  it('nested <ul> inside <li>: outer li text does not double-count inner items', () => {
    const src = `<ul><li>Outer text only.<ul><li>Inner item A</li><li>Inner item B</li></ul></li></ul>`;
    const out = extractParagraphs(src);
    // 1 outer li + 2 inner li = 3 entries; outer li text excludes inner items.
    expect(out).toHaveLength(3);
    expect(out[0].text).toBe('Outer text only.');
    expect(out.slice(1).map((p) => p.text)).toEqual(['Inner item A', 'Inner item B']);
  });

  it('preserves document order across <p> and <li>', () => {
    const src = `<p>First</p><ul><li>Second</li></ul><p>Third</p>`;
    expect(extractParagraphs(src).map((p) => p.text)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });
});

describe('site-parse: extractIntegerExpressionProp', () => {
  it('extracts a bare integer literal', () => {
    expect(extractIntegerExpressionProp(`<X count={3} />`, 'count')).toBe(3);
  });

  it('tolerates whitespace around the `=` sign', () => {
    expect(extractIntegerExpressionProp(`<X count = {3} />`, 'count')).toBe(3);
  });

  it('tolerates whitespace inside the braces', () => {
    expect(extractIntegerExpressionProp(`<X count={ 3 } />`, 'count')).toBe(3);
  });

  it('returns undefined when the prop is missing', () => {
    expect(extractIntegerExpressionProp(`<X />`, 'count')).toBeUndefined();
  });

  it('rejects an identifier expression', () => {
    expect(
      extractIntegerExpressionProp(`<X count={foo} />`, 'count'),
    ).toBeUndefined();
  });

  it('rejects a JSX comment inside the expression', () => {
    expect(
      extractIntegerExpressionProp(`<X count={/* */ 3} />`, 'count'),
    ).toBeUndefined();
  });

  it('rejects a computed expression', () => {
    expect(
      extractIntegerExpressionProp(`<X count={3+0} />`, 'count'),
    ).toBeUndefined();
  });

  it('rejects a signed integer', () => {
    expect(
      extractIntegerExpressionProp(`<X count={-3} />`, 'count'),
    ).toBeUndefined();
  });

  it('extracts multi-digit integers', () => {
    expect(
      extractIntegerExpressionProp(`<X count={123} />`, 'count'),
    ).toBe(123);
  });

  it('extracts cleanly when a string prop sits beside the integer prop', () => {
    const tag = `<X prompt="hello" count={3} moduleKey="a" />`;
    expect(extractIntegerExpressionProp(tag, 'count')).toBe(3);
  });
});

describe('site-parse: extractSlotCollections', () => {
  it('returns an empty array when the file has no SlotCollection', () => {
    expect(extractSlotCollections(`<p>Just prose.</p>`)).toEqual([]);
  });

  it('extracts a SlotCollection with all four props', () => {
    const src = `<SlotCollection moduleKey="knowing-community" tableId="place-characteristics-row-0-slots" count={3} prompt="Write three things." />`;
    const out = extractSlotCollections(src);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      line: 1,
      moduleKey: 'knowing-community',
      tableId: 'place-characteristics-row-0-slots',
      count: 3,
      prompt: 'Write three things.',
    });
  });

  it('handles multiple SlotCollections in one file', () => {
    const src = `<SlotCollection moduleKey="a" tableId="t1" count={2} prompt="A" />
<SlotCollection moduleKey="b" tableId="t2" count={4} prompt="B" />`;
    const out = extractSlotCollections(src);
    expect(out).toHaveLength(2);
    expect(out.map((s) => [s.tableId, s.count])).toEqual([
      ['t1', 2],
      ['t2', 4],
    ]);
  });

  it('omits absent optional props (moduleKey, tableId, count, prompt)', () => {
    const src = `<SlotCollection />`;
    const out = extractSlotCollections(src);
    expect(out).toHaveLength(1);
    expect(out[0].moduleKey).toBeUndefined();
    expect(out[0].tableId).toBeUndefined();
    expect(out[0].count).toBeUndefined();
    expect(out[0].prompt).toBeUndefined();
    expect(out[0].line).toBe(1);
  });

  it('parses a SlotCollection across multiple authored lines', () => {
    const src = `<SlotCollection
  moduleKey="knowing-community"
  tableId="place-characteristics-row-0-slots"
  count={3}
  prompt="Write down three important things about your place."
/>`;
    const out = extractSlotCollections(src);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      line: 1,
      moduleKey: 'knowing-community',
      tableId: 'place-characteristics-row-0-slots',
      count: 3,
    });
  });
});

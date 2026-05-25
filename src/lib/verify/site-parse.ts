/**
 * Parse .astro / .tsx component source to extract the three site-side
 * artifacts the day-5 runner checks need:
 *
 *   1. Links — `<a href="...">` and `<ExternalLink href="...">` occurrences.
 *   2. Headings — h1/h2/h3 tag text content, in document order.
 *   3. DataTable columns — the `columns={[{ key, label }, ...]}` arrays
 *      passed to `<DataTable ...>`.
 *
 * All parsing is regex-based, NOT an AST. Rationale: the site's authored
 * .astro files follow a predictable hand-written shape (no computed JSX
 * expressions in these three targets, no dynamically-built column arrays).
 * Introducing a ts-morph / estree dependency here would be a real-weight
 * architectural choice; the regex path is good enough to serve day-5 and
 * degrades safely to "no match" on anything unexpected. The runner treats
 * unparseable shapes as `needs_human_review`, not `pass`.
 *
 * Known non-goals (documented so 5b/6 don't hit these blind):
 *   - No computed href (e.g. `href={url}`) — those never appear in module
 *     pages today and would trip the class-c source-fidelity rule anyway.
 *   - No Fragment or conditional rendering introspection.
 *   - No className / style parsing.
 */

export interface SiteLink {
  /** The href value as authored, unnormalized. */
  href: string;
  /** Source of the link: 'a' for raw `<a>`, 'ExternalLink' for the wrapper. */
  component: 'a' | 'ExternalLink';
  /** Visible anchor text (inner) with tags stripped and whitespace collapsed. */
  anchor_text?: string;
  /** 1-indexed line number of the opening tag in the source. */
  line: number;
}

export interface SiteHeading {
  level: 1 | 2 | 3 | 4;
  /** Heading text with tags stripped and whitespace collapsed. */
  text: string;
  /** 1-indexed line number of the opening tag. */
  line: number;
}

export interface SiteColumn {
  /** The `key` property value as authored (may be kebab-case or human-readable). */
  key: string;
  /** The `label` property value as authored (optional per DataTable's ColumnDef). */
  label?: string;
}

export interface SiteDataTable {
  /** 1-indexed line number of the opening `<DataTable` tag. */
  line: number;
  /** `moduleKey` prop if authored as a string literal, else undefined. */
  moduleKey?: string;
  /** `tableId` prop if authored as a string literal, else undefined. */
  tableId?: string;
  /** Columns in authored order. */
  columns: SiteColumn[];
}

export interface SitePlanForm {
  /** 1-indexed line number of the opening `<PlanForm` tag. */
  line: number;
  /** `moduleKey` prop if authored as a string literal, else undefined. */
  moduleKey?: string;
  /** `formId` prop if authored as a string literal, else undefined. */
  formId?: string;
}

export interface SiteSlotCollection {
  /** 1-indexed line number of the opening `<SlotCollection` tag. */
  line: number;
  /** `moduleKey` prop if authored as a string literal, else undefined. */
  moduleKey?: string;
  /** `tableId` prop if authored as a string literal, else undefined. */
  tableId?: string;
  /** `count` prop if authored as a non-negative integer expression `{N}`. */
  count?: number;
  /** `prompt` prop if authored as a string literal, else undefined. */
  prompt?: string;
}

export interface SiteParagraph {
  /** Tag name — 'p' for paragraph, 'li' for list item. */
  tag: 'p' | 'li';
  /** Visible text with tags stripped and whitespace collapsed. */
  text: string;
  /** 1-indexed line number of the opening tag. */
  line: number;
}

function lineAtIndex(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

function stripTagsAndCollapse(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Extract the section number from the module page's authored sectionData
 * object. ModuleLayout uses this number to render the automatic "See
 * Additional Resources" link, so runner checks can use it as static context.
 */
export function extractSectionNumber(content: string): string | null {
  const blockRe =
    /const\s+sectionData(?:\s*:\s*SectionData)?\s*=\s*\{([\s\S]*?)\};/m;
  const block = blockRe.exec(content);
  if (!block) return null;

  const numberRe = /(?:\bnumber\b|['"]number['"])\s*:\s*(['"])([^'"]+)\1/;
  const number = numberRe.exec(block[1]);
  return number ? number[2] : null;
}

/**
 * Extract all `<a href="..."...>...</a>` and `<ExternalLink href="...">...
 * </ExternalLink>` occurrences. Ignores self-closing `<a/>` (not a real
 * pattern on this site) and expression-form `href={expr}` (intentional —
 * see module docstring).
 */
export function extractLinks(content: string): SiteLink[] {
  const out: SiteLink[] = [];
  // <a ... href="..."...>...</a>  — href attribute, any order, string literal only.
  const aRe = /<a\b([^>]*?)\bhref\s*=\s*(['"])([^'"]*)\2([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = aRe.exec(content)) !== null) {
    out.push({
      href: m[3],
      component: 'a',
      anchor_text: stripTagsAndCollapse(m[5]) || undefined,
      line: lineAtIndex(content, m.index),
    });
  }
  // <ExternalLink ... href="..."...>...</ExternalLink>  — same shape.
  const elRe = /<ExternalLink\b([^>]*?)\bhref\s*=\s*(['"])([^'"]*)\2([^>]*)>([\s\S]*?)<\/ExternalLink>/g;
  while ((m = elRe.exec(content)) !== null) {
    out.push({
      href: m[3],
      component: 'ExternalLink',
      anchor_text: stripTagsAndCollapse(m[5]) || undefined,
      line: lineAtIndex(content, m.index),
    });
  }
  out.sort((a, b) => a.line - b.line);
  return out;
}

/**
 * Extract h1/h2/h3/h4 tag contents. Ignores self-closing and expression-body
 * forms. Returns in document (line) order.
 */
export function extractHeadings(content: string): SiteHeading[] {
  const out: SiteHeading[] = [];
  const re = /<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const level = parseInt(m[1], 10) as 1 | 2 | 3 | 4;
    const text = stripTagsAndCollapse(m[2]);
    if (!text) continue;
    out.push({ level, text, line: lineAtIndex(content, m.index) });
  }
  return out;
}

/**
 * Extract every `<DataTable ...>` occurrence with its string-literal props
 * and its `columns` array. The `columns` prop is a JSX expression of the
 * form `columns={[{ key: '...', label: '...' }, ...]}` — we parse it with a
 * bracket-balanced walk (not a regex) so nested object literals, trailing
 * commas, and whitespace variants all round-trip cleanly. Unparseable column
 * arrays return an empty columns list; the runner treats that as
 * `needs_human_review`.
 */
export function extractDataTables(content: string): SiteDataTable[] {
  const out: SiteDataTable[] = [];
  const tagRe = /<DataTable\b/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(content)) !== null) {
    const openIdx = m.index;
    const gt = findTagClose(content, openIdx);
    if (gt === -1) continue;
    const tag = content.slice(openIdx, gt);
    const line = lineAtIndex(content, openIdx);
    const columns = extractColumnsProp(tag);
    const moduleKey = extractStringProp(tag, 'moduleKey');
    const tableId = extractStringProp(tag, 'tableId');
    const entry: SiteDataTable = { line, columns };
    if (moduleKey !== undefined) entry.moduleKey = moduleKey;
    if (tableId !== undefined) entry.tableId = tableId;
    out.push(entry);
  }
  return out;
}

/**
 * Walk forward from the `<DataTable` opening and return the index of the
 * matching `>` (or `/>`), respecting braces and quoted strings. JSX nests
 * braces inside attribute expressions (e.g. `columns={[{...}]}`), which a
 * naive `indexOf('>')` would terminate at.
 */
function findTagClose(content: string, openIdx: number): number {
  let depth = 0;
  let inStr: '"' | "'" | null = null;
  for (let i = openIdx; i < content.length; i++) {
    const c = content[i];
    if (inStr) {
      if (c === inStr && content[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i + 1;
  }
  return -1;
}

/** Pull `propName="value"` or `propName='value'` out of an opening tag. */
function extractStringProp(tag: string, propName: string): string | undefined {
  const re = new RegExp(
    `\\b${propName}\\s*=\\s*(['"])((?:(?!\\1).)*)\\1`,
  );
  const m = re.exec(tag);
  return m ? m[2] : undefined;
}

/**
 * Extract a JSX integer-expression prop value: matches `prop={N}` where N is a
 * non-negative integer literal. Tolerates cosmetic whitespace around `=` and
 * inside the braces (mirrors `extractStringProp`'s `\s*=\s*` convention).
 *
 * Returns `undefined` if the prop is absent, an identifier (`count={foo}`),
 * a JSX comment (`count={/* *\/ 3}`), a computed expression (`count={3+0}`),
 * a signed integer (`count={-3}`), or any shape that isn't a bare digit
 * sequence inside braces. The strict-shape contract is intentional: the
 * verifier parses authored source, not runtime values, so anything that
 * isn't an obvious integer literal should fail closed (undefined → the
 * consumer treats it as unparseable rather than mis-parsing).
 *
 * Exported because both `extractSlotCollections` (this file) and a future
 * `expected_component_count` enforcement check will use it on the same
 * `count={N}` prop shape.
 */
export function extractIntegerExpressionProp(
  tag: string,
  propName: string,
): number | undefined {
  const re = new RegExp(`\\b${propName}\\s*=\\s*\\{\\s*(\\d+)\\s*\\}`);
  const m = re.exec(tag);
  return m ? parseInt(m[1], 10) : undefined;
}

/**
 * Pull the `columns={[...]}` expression out of a DataTable opening tag, then
 * parse each top-level object literal for its `key` and `label` string
 * properties.
 */
export function extractColumnsProp(tag: string): SiteColumn[] {
  const start = tag.search(/\bcolumns\s*=\s*\{/);
  if (start === -1) return [];
  const openBrace = tag.indexOf('{', start);
  if (openBrace === -1) return [];
  // Find matching close brace for the outer `columns={...}` expression.
  const end = matchClose(tag, openBrace, '{', '}');
  if (end === -1) return [];
  const expr = tag.slice(openBrace + 1, end).trim();
  // Inside the expression we expect a single array literal `[...]`.
  if (!expr.startsWith('[')) return [];
  const arrEnd = matchClose(expr, 0, '[', ']');
  if (arrEnd === -1) return [];
  const arrBody = expr.slice(1, arrEnd);
  return parseObjectLiteralArray(arrBody);
}

function matchClose(s: string, openAt: number, open: string, close: string): number {
  let depth = 0;
  let inStr: '"' | "'" | null = null;
  for (let i = openAt; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === inStr && s[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Given the body of a JSX array literal (`{...}, {...}, {...}`), split on
 * top-level commas (respecting braces/strings) and parse each `{...}` chunk
 * as a key/label pair.
 */
function parseObjectLiteralArray(body: string): SiteColumn[] {
  const objects: string[] = [];
  let depth = 0;
  let inStr: '"' | "'" | null = null;
  let start = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (c === inStr && body[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(body.slice(start + 1, i));
        start = -1;
      }
    }
  }
  const out: SiteColumn[] = [];
  for (const obj of objects) {
    const key = extractObjectProp(obj, 'key');
    if (key === undefined) continue;
    const col: SiteColumn = { key };
    const label = extractObjectProp(obj, 'label');
    if (label !== undefined) col.label = label;
    out.push(col);
  }
  return out;
}

/**
 * Pull a string-literal value for `propName` out of an object-literal body.
 * Accepts both bare and quoted keys: `key: 'x'`, `"key": 'x'`, `key: "x"`.
 */
function extractObjectProp(body: string, propName: string): string | undefined {
  const re = new RegExp(
    `(?:\\b${propName}\\b|['"]${propName}['"])\\s*:\\s*(['"])((?:(?!\\1).)*)\\1`,
  );
  const m = re.exec(body);
  return m ? m[2] : undefined;
}

/**
 * Extract every `<PlanForm ...>` occurrence with its string-literal
 * `moduleKey` / `formId` props. PlanForm is one of three primary data-bearing
 * components on this site (alongside DataTable and SlotCollection);
 * `structuralFidelityMatches` sums all three component counts for the spec's
 * `table_count` comparison.
 *
 * Unlike DataTable, PlanForm's `fields` prop is typically authored from an
 * imported const in the same file (or ported from a source spec), so this
 * extractor does NOT try to parse the fields array — it only reports presence
 * and line. Column-alignment for PlanForm is a day-9 concern.
 */
export function extractPlanForms(content: string): SitePlanForm[] {
  const out: SitePlanForm[] = [];
  const tagRe = /<PlanForm\b/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(content)) !== null) {
    const openIdx = m.index;
    const gt = findTagClose(content, openIdx);
    if (gt === -1) continue;
    const tag = content.slice(openIdx, gt);
    const line = lineAtIndex(content, openIdx);
    const entry: SitePlanForm = { line };
    const moduleKey = extractStringProp(tag, 'moduleKey');
    const formId = extractStringProp(tag, 'formId');
    if (moduleKey !== undefined) entry.moduleKey = moduleKey;
    if (formId !== undefined) entry.formId = formId;
    out.push(entry);
  }
  return out;
}

/**
 * Extract every `<SlotCollection ...>` occurrence with its string-literal
 * `moduleKey` / `tableId` / `prompt` props and its integer-expression `count`
 * prop. SlotCollection is the third primary data-bearing component on this
 * site (alongside DataTable and PlanForm); `structuralFidelityMatches` sums
 * all three component counts for the spec's `table_count` comparison.
 *
 * The `count` prop is a JSX integer expression (`count={3}`), not a quoted
 * string, so it's parsed via `extractIntegerExpressionProp` rather than
 * `extractStringProp`. Counts that aren't a bare non-negative integer
 * literal yield `undefined` (the consumer surfaces that as a needs-review
 * shape rather than mis-parsing computed/signed/identifier forms).
 */
export function extractSlotCollections(content: string): SiteSlotCollection[] {
  const out: SiteSlotCollection[] = [];
  const tagRe = /<SlotCollection\b/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(content)) !== null) {
    const openIdx = m.index;
    const gt = findTagClose(content, openIdx);
    if (gt === -1) continue;
    const tag = content.slice(openIdx, gt);
    const line = lineAtIndex(content, openIdx);
    const entry: SiteSlotCollection = { line };
    const moduleKey = extractStringProp(tag, 'moduleKey');
    const tableId = extractStringProp(tag, 'tableId');
    const count = extractIntegerExpressionProp(tag, 'count');
    const prompt = extractStringProp(tag, 'prompt');
    if (moduleKey !== undefined) entry.moduleKey = moduleKey;
    if (tableId !== undefined) entry.tableId = tableId;
    if (count !== undefined) entry.count = count;
    if (prompt !== undefined) entry.prompt = prompt;
    out.push(entry);
  }
  return out;
}

/**
 * Extract visible text from every `<p>` and `<li>` element in authored order.
 * Used by `proseMatches` to compare site-rendered prose to the pdftotext
 * extraction of the workbook.
 *
 * Nested inline tags (e.g. `<ExternalLink>`, `<strong>`, `<em>`, `<span>`)
 * have their tags stripped but text preserved — what's compared is the
 * visible reading experience, not the component tree. Nested `<ul>`/`<ol>`
 * are removed from the parent `<li>`'s text so their `<li>` children
 * (which are emitted as their own paragraph entries) don't double-count.
 *
 * Nesting support: a `<li>Outer<ul><li>Inner</li></ul></li>` shape emits
 * THREE entries — outer (text="Outer"), inner1, inner2 — with depth-balanced
 * close matching per tag. Empty paragraphs are skipped.
 *
 * Non-goal: this extractor does not currently decode HTML entities
 * (`&amp;`, `&mdash;`, etc.). proseMatches should normalize both sides so
 * that entity-raw-text comparison doesn't false-positive — but if the
 * workbook or site adds unusual entities, extend normalization there.
 */
export function extractParagraphs(content: string): SiteParagraph[] {
  const out: SiteParagraph[] = [];
  const openRe = /<(p|li)\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(content)) !== null) {
    const tag = m[1].toLowerCase() as 'p' | 'li';
    const innerStart = m.index + m[0].length;
    const closeStart = findMatchingClose(content, innerStart, tag);
    if (closeStart === -1) continue;
    const inner = content.slice(innerStart, closeStart);
    const text = collapseDirectText(inner);
    if (!text) continue;
    out.push({ tag, text, line: lineAtIndex(content, m.index) });
  }
  return out;
}

/**
 * Given `content` and a position just past a `<tag>` opening, return the
 * index of the matching `</tag>` — respecting same-tag nesting. Returns -1
 * if no matching close exists.
 */
function findMatchingClose(
  content: string,
  from: number,
  tag: 'p' | 'li',
): number {
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  const closeRe = new RegExp(`</${tag}\\s*>`, 'gi');
  let depth = 1;
  let cursor = from;
  while (depth > 0) {
    openRe.lastIndex = cursor;
    closeRe.lastIndex = cursor;
    const nextOpen = openRe.exec(content);
    const nextClose = closeRe.exec(content);
    if (!nextClose) return -1;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      cursor = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      if (depth === 0) return nextClose.index;
      cursor = nextClose.index + nextClose[0].length;
    }
  }
  return -1;
}

/**
 * Strip tags and collapse whitespace, but also drop the inner text of any
 * NESTED `<ul>` / `<ol>` (their `<li>` children become their own paragraph
 * entries, so we must not double-count them inside the parent `<li>`).
 */
function collapseDirectText(inner: string): string {
  const withoutNested = inner.replace(/<(ul|ol)\b[\s\S]*?<\/\1>/gi, ' ');
  return stripTagsAndCollapse(withoutNested);
}

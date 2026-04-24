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

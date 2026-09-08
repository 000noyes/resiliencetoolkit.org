/**
 * Per-block annotation ids (ER4, DR18): every block a reader might leave a
 * note on carries a stable data-annot id from the build. Pins anchor at
 * block level (a table row, a paragraph, a list) and whole-table notes at
 * the table itself; the ids are what the kept notes API stores as
 * target_id, so they follow its shape rule (max 64 chars, alphanumeric
 * and hyphen) and are write-once (tests/build/annot-registry.test.ts).
 *
 * Shape: <page>--<section>--<kind><n>. The page key is the chapter number
 * (1-2) or intro; the section is the nearest preceding header id (the
 * static heading ids: h2, h3, table band labels), truncated to 32 chars;
 * the kind is t (table), r (row), p (paragraph), l (list), q (quote),
 * f (figure); n counts within the section. Blocks nest only one level:
 * a paragraph inside a cell or a list item belongs to that row or list.
 */

const SECTION_MAX = 32;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
const ID_OF = /\sid\s*=\s*"([^"]*)"/;
const BAND_STRONG = /<strong[^>]*\sid\s*=\s*"([^"]+)"/;

const KINDS: Record<string, string> = {
  table: 't',
  tr: 'r',
  p: 'p',
  ul: 'l',
  ol: 'l',
  blockquote: 'q',
  figure: 'f',
};

function sectionKey(id: string): string {
  return id.slice(0, SECTION_MAX).replace(/-+$/, '') || 'top';
}

export function withBlockIds(html: string, pageKey: string): string {
  let out = '';
  let last = 0;
  let section = 'top';
  let cellDepth = 0;
  let liDepth = 0;
  let theadDepth = 0;
  const counts = new Map<string, number>();
  const used = new Set<string>();

  const nextId = (kind: string): string => {
    const key = `${section}|${kind}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    let id = `${pageKey}--${section}--${kind}${n}`;
    let dup = 2;
    while (used.has(id)) id = `${pageKey}--${section}--${kind}${n}-${dup++}`;
    used.add(id);
    return id;
  };

  for (const m of html.matchAll(TAG)) {
    const [whole, close, rawName, attrs] = m;
    const name = rawName.toLowerCase();
    const at = m.index!;
    if (close) {
      if (name === 'td' || name === 'th') cellDepth = Math.max(0, cellDepth - 1);
      else if (name === 'li') liDepth = Math.max(0, liDepth - 1);
      else if (name === 'thead') theadDepth = Math.max(0, theadDepth - 1);
      continue;
    }
    if (name === 'h2' || name === 'h3' || name === 'strong') {
      const id = ID_OF.exec(attrs)?.[1];
      if (id) section = sectionKey(id);
      continue;
    }
    if (name === 'thead') {
      theadDepth++;
      continue;
    }
    if (name === 'td' || name === 'th') {
      cellDepth++;
      continue;
    }
    if (name === 'li') {
      liDepth++;
      continue;
    }
    const kind = KINDS[name];
    if (!kind) continue;
    if (/\sdata-annot\s*=/.test(attrs)) continue;
    if (name === 'tr') {
      if (theadDepth > 0) continue;
      // A band row opens its own section: the band label inside it names
      // the rows that follow, and the band row is the first of them
      const cellStart = html.indexOf('<td', at);
      const cellEnd = html.indexOf('</td>', at);
      if (cellStart >= 0 && cellEnd > cellStart) {
        const cell = html.slice(cellStart, cellEnd);
        if (/^<td[^>]*colspan/i.test(cell)) {
          const band = BAND_STRONG.exec(cell)?.[1];
          if (band) section = sectionKey(band);
        }
      }
    } else if (name !== 'table' && (cellDepth > 0 || liDepth > 0)) {
      continue; // nested prose belongs to its row or list
    }
    const id = nextId(kind);
    out += html.slice(last, at) + `<${rawName}${attrs} data-annot="${id}">`;
    last = at + whole.length;
  }
  return out + html.slice(last);
}

/** The kept API's shape rule for a target id */
export const BLOCK_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;

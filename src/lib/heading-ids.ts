/**
 * Static heading ids: the one id system for anchors (SR3/ES3).
 *
 * Chapter and front-matter bodies render their section-header ids at
 * build time from the header text (h2, h3, and the table band labels a
 * chapter reads by), so the built HTML carries the anchors that search
 * results land on. The On this page scanner reuses an id it
 * finds and derives one only for a header that has none, with the same
 * slugify, so a reader reaches the same anchor from a search pick, a
 * contents click, or a shared link.
 */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Ensures a unique id by appending a numeric suffix when needed */
export function ensureUniqueId(id: string, existing: Set<string>): string {
  if (!existing.has(id)) {
    existing.add(id);
    return id;
  }
  let counter = 2;
  while (existing.has(`${id}-${counter}`)) counter++;
  const unique = `${id}-${counter}`;
  existing.add(unique);
  return unique;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** The text a heading reads as: tags dropped, entities decoded */
function textOf(inner: string): string {
  return inner
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === '#') {
        const n =
          code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The section headers a chapter reads by (the On this page scanner's own
 * selection): h2 and h3, plus the table band labels (a strong opening a
 * colspan cell, or the only cell of a row). Matched in document order so
 * uniqueness suffixes fall exactly where the scanner would put them.
 */
const TARGET =
  /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1\s*>|(<td\s[^>]*colspan=[^>]*>\s*)<strong(\s[^>]*)?>((?:(?!<\/td>|<td[\s>])[\s\S])*?)<\/strong>|(<tr(?:\s[^>]*)?>\s*<td(?:\s[^>]*)?>\s*)<strong(\s[^>]*)?>((?:(?!<\/td>|<td[\s>])[\s\S])*?)<\/strong>((?:(?!<td[\s>])[\s\S])*?<\/td>\s*<\/tr>)/gi;
const ID_ATTR = /\sid\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i;
const ANY_ID = /\sid\s*=\s*"([^"]*)"/g;

/** A band label made only of links is a link row, not a header (the scanner's rule) */
function isLinkOnly(inner: string): boolean {
  if (!/<a\s/i.test(inner)) return false;
  return textOf(inner.replace(/<a\s[\s\S]*?<\/a>/gi, '')) === '';
}

/**
 * Give every section header in a rendered body an id derived from its
 * text. Authored ids are kept; every id already on the page is reserved
 * so a derived id never collides with a block id.
 */
export function withHeadingIds(html: string): string {
  const used = new Set<string>();
  for (const m of html.matchAll(ANY_ID)) used.add(m[1]);
  const idFor = (attrs: string, inner: string): string | null => {
    if (ID_ATTR.test(attrs)) return null;
    const base = slugify(textOf(inner));
    if (!base) return null;
    return ensureUniqueId(base, used);
  };
  return html.replace(
    TARGET,
    (
      whole: string,
      hLevel: string | undefined,
      hAttrs: string | undefined,
      hInner: string | undefined,
      bandOpen: string | undefined,
      bandAttrs: string | undefined,
      bandInner: string | undefined,
      rowOpen: string | undefined,
      rowAttrs: string | undefined,
      rowInner: string | undefined,
      rowTail: string | undefined
    ) => {
      if (hLevel !== undefined) {
        const id = idFor(hAttrs ?? '', hInner ?? '');
        return id ? `<h${hLevel}${hAttrs ?? ''} id="${id}">${hInner}</h${hLevel}>` : whole;
      }
      if (bandOpen !== undefined) {
        const inner = bandInner ?? '';
        if (isLinkOnly(inner)) return whole;
        const id = idFor(bandAttrs ?? '', inner);
        return id ? `${bandOpen}<strong${bandAttrs ?? ''} id="${id}">${inner}</strong>` : whole;
      }
      const inner = rowInner ?? '';
      if (isLinkOnly(inner)) return whole;
      const id = idFor(rowAttrs ?? '', inner);
      return id
        ? `${rowOpen}<strong${rowAttrs ?? ''} id="${id}">${inner}</strong>${rowTail ?? ''}`
        : whole;
    }
  );
}

/** A section header as On this page lists it, read from the built body */
export interface SeededHeading {
  id: string;
  text: string;
  level: 'h2' | 'h3' | 'table';
  /** Todo islands between this header and the next, in document order */
  interactiveCount: number;
}

const ISLAND = /<astro-island\b[^>]*?(?:component-url="[^"]*\/Todo[^"/]*\.js"|name(?:&quot;|"):(?:&quot;|")Todo(?:&quot;|"))[^>]*>/gi;

function countIslands(html: string): number {
  return (html.match(ISLAND) ?? []).length;
}

/**
 * The On this page entries, read once from a body that has been through
 * withHeadingIds: the same headers the scanner selects (h2, h3, the table
 * band labels, link-only bands skipped), in document order, each with its
 * static id and the count of todo islands before the next header. The
 * island seeds its list from these, so the list is on the page before
 * any script runs; the scanner only adds counts and the active item.
 */
export function extractHeadings(html: string): SeededHeading[] {
  const found: { id: string; text: string; level: SeededHeading['level']; start: number; end: number }[] = [];
  for (const m of html.matchAll(TARGET)) {
    const [whole, hLevel, hAttrs, hInner, bandOpen, bandAttrs, bandInner, , rowAttrs, rowInner] = m;
    let attrs: string;
    let inner: string;
    let level: SeededHeading['level'];
    if (hLevel !== undefined) {
      attrs = hAttrs ?? '';
      inner = hInner ?? '';
      level = hLevel === '2' ? 'h2' : 'h3';
    } else if (bandOpen !== undefined) {
      attrs = bandAttrs ?? '';
      inner = bandInner ?? '';
      level = 'table';
      if (isLinkOnly(inner)) continue;
    } else {
      attrs = rowAttrs ?? '';
      inner = rowInner ?? '';
      level = 'table';
      if (isLinkOnly(inner)) continue;
    }
    const idMatch = ID_ATTR.exec(attrs);
    if (!idMatch) continue;
    const id = idMatch[1].replace(/^["']|["']$/g, '');
    const text = textOf(inner);
    if (!id || !text) continue;
    found.push({ id, text, level, start: m.index ?? 0, end: (m.index ?? 0) + whole.length });
  }
  return found.map((h, i) => ({
    id: h.id,
    text: h.text,
    level: h.level,
    interactiveCount: countIslands(html.slice(h.end, i + 1 < found.length ? found[i + 1].start : html.length)),
  }));
}

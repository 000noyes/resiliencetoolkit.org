/**
 * The landing a search pick performs (BR5, amending ES3/SR3/SR11): the
 * page opens at its top, then scrolls down to the searched words under
 * the header the result named. The words sit in a mark carrying the ring
 * and take focus, so reading starts at the match rather than at the
 * header. The URL settles to the header anchor, the shareable deep link.
 * Cross-page picks hand the landing over through sessionStorage so the
 * browser never jumps to the hash on load; same-page picks land directly.
 */

export interface Landing {
  /** The header anchor id the result named (ER4 ids) */
  id: string;
  /** The query as typed */
  q: string;
}

export interface LandingRange {
  node: Text;
  start: number;
  length: number;
}

const SECTION_HEADER = 'h2, h3, strong[id]';
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);
const MIN_WORD = 2;
const FROM_TOP_PAUSE_MS = 250;

/** Text nodes after the header in document order, up to the next section header */
function textNodesUnder(header: Element, root: ParentNode): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-annot-ui], [hidden]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const position = header.compareDocumentPosition(node);
    if (!(position & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    if (header.contains(node)) continue;
    const owner = (node.parentElement as Element).closest(SECTION_HEADER);
    if (owner && owner !== header) break;
    out.push(node as Text);
  }
  return out;
}

function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The first run of the searched words under the header: the whole phrase
 * if any text node carries it, else the first word (in query order) any
 * node carries. Null when nothing under the header matches.
 */
export function findLandingRange(header: Element, q: string, root: ParentNode = document): LandingRange | null {
  const phrase = normalize(q);
  if (phrase.length < MIN_WORD) return null;
  const nodes = textNodesUnder(header, root);
  const find = (needle: string): LandingRange | null => {
    for (const node of nodes) {
      const at = node.data.toLowerCase().indexOf(needle);
      if (at >= 0) return { node, start: at, length: needle.length };
    }
    return null;
  };
  const whole = find(phrase);
  if (whole) return whole;
  for (const word of phrase.split(' ')) {
    if (word.length < MIN_WORD) continue;
    const hit = find(word);
    if (hit) return hit;
  }
  return null;
}

/** Unwrap the previous landing mark, keeping its text in place */
export function clearLandingMark(root: ParentNode = document) {
  root.querySelectorAll('mark.search-landing').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

/** Wrap the range in the landing mark (text nodes only, SR10) */
export function markLanding(range: LandingRange): HTMLElement {
  const r = document.createRange();
  r.setStart(range.node, range.start);
  r.setEnd(range.node, range.start + range.length);
  const mark = document.createElement('mark');
  mark.className = 'search-mark search-landing';
  mark.tabIndex = -1;
  r.surroundContents(mark);
  return mark;
}

export interface LandOptions {
  /** A fresh page: hold at the top for a beat, then travel down, then settle the URL */
  fromTop: boolean;
}

/**
 * Land on the searched words under the header, or on the header when
 * nothing under it matches. Returns the element landed on.
 */
export function landOnSearch(landing: Landing, opts: LandOptions): HTMLElement | null {
  const header = document.getElementById(landing.id);
  if (!header) return null;
  clearLandingMark();
  const range = findLandingRange(header, landing.q);
  let target: HTMLElement = header;
  if (range) {
    target = markLanding(range);
  } else {
    header.setAttribute('tabindex', '-1');
  }
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const travel = () => {
    target.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: range ? 'center' : 'start' });
    target.focus({ preventScroll: true });
    if (opts.fromTop) history.replaceState(null, '', `#${landing.id}`);
  };
  if (opts.fromTop) {
    window.scrollTo(0, 0);
    window.setTimeout(travel, reduced ? 0 : FROM_TOP_PAUSE_MS);
  } else {
    travel();
  }
  return target;
}

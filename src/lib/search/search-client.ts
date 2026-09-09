/**
 * The one search module (2A): mounted by the header box, the phone search
 * sheet, and /search. Loaded lazily on first focus (ES7); Pagefind itself
 * loads inside it, so pages ship zero search JS until a reader reaches
 * for the box.
 *
 * Contract (the search end-state addendum): panel opens at the 2nd
 * character with a 150ms debounce; a Searching line appears past 400ms;
 * failure and offline reuse the shipped unavailable line, triggered by
 * an actual query failure and never by navigator.onLine (ES2); results
 * group by chapter (derived from the one contents model), one hit per
 * destination anchor (ES3), max 6 rows across max 3 groups in the panel;
 * combobox keyboard per the APG combobox-listbox pattern; Escape closes
 * and keeps focus; outside click and route change dismiss, scroll does
 * not; Enter with no highlighted option submits the native form to
 * /search (SR4). Query recall is sessionStorage restore-on-focus, the
 * URL beating storage on /search (ES5). History: the panel claims no
 * entry, same-page picks push one, other picks are plain navigations; a
 * host such as the phone sheet may take a pick over to settle its own
 * entry first (ES6).
 */
import { searchRoute } from '@/data/contents';
import { urlToChapter } from './urlToChapter';

interface PagefindAnchor {
  element: string;
  id: string;
  text: string;
  location: number;
}

interface PagefindDocument {
  url: string;
  content: string;
  excerpt: string;
  meta: { title?: string };
  anchors?: PagefindAnchor[];
  locations?: number[];
}

interface PagefindResult {
  data: () => Promise<PagefindDocument>;
}

interface Pagefind {
  init?: () => Promise<void>;
  search: (q: string) => Promise<{ results: PagefindResult[] }>;
}

const STORE_KEY = 'rt-search-query';
const LANDING_KEY = 'rt-search-landing';
const PAGEFIND_URL = '/pagefind/pagefind.js';
const DEBOUNCE_MS = 150;
const SEARCHING_AFTER_MS = 400;
const PANEL_MAX_ROWS = 6;
const PANEL_MAX_GROUPS = 3;
const PAGE_MAX_ROWS = 40;
const MAX_DOCS = 30;

let pagefindPromise: Promise<Pagefind | null> | null = null;

/**
 * Prewarm/load Pagefind once per page (ES7). Pagefind writes this module
 * into dist at build, so the specifier stays out of the bundler's reach.
 * A failed load is not sticky: the next query tries again.
 */
export function loadPagefind(): Promise<Pagefind | null> {
  if (!pagefindPromise) {
    const spec = PAGEFIND_URL;
    pagefindPromise = import(/* @vite-ignore */ spec)
      .then(async (pf: Pagefind) => {
        if (pf.init) await pf.init();
        return pf;
      })
      .catch(() => {
        pagefindPromise = null;
        return null;
      });
  }
  return pagefindPromise;
}

export function readStoredQuery(): string {
  try {
    return sessionStorage.getItem(STORE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeQuery(q: string) {
  try {
    sessionStorage.setItem(STORE_KEY, q);
  } catch {
    /* recall silently off (private mode) */
  }
}

/** The /search href carrying a query: the one route constant, everywhere */
export function searchHref(q: string): string {
  return `${searchRoute}?q=${encodeURIComponent(q)}`;
}

/** A snippet as text runs, marked or plain: rendered as text nodes only (SR10) */
interface ExcerptPart {
  text: string;
  mark: boolean;
}

/**
 * Decode HTML entities through an inert textarea (its content is text,
 * never parsed as markup), keeping every whitespace run intact.
 */
function decodeEntities(escaped: string): string {
  const box = document.createElement('textarea');
  box.innerHTML = escaped;
  return box.value;
}

/** Pagefind's own excerpt: escaped text with <mark> around matched words */
function partsFromExcerpt(excerpt: string): ExcerptPart[] {
  return excerpt
    .split(/<\/?mark>/)
    .map((part, i) => ({ text: decodeEntities(part), mark: i % 2 === 1 }))
    .filter((p) => p.text !== '');
}

const EXCERPT_BEFORE = 6;
const EXCERPT_WORDS = 26;

/** A snippet around a matched word, from the page's own word list */
function partsAround(words: string[], center: number, matched: Set<number>): ExcerptPart[] {
  const start = Math.max(0, Math.min(center - EXCERPT_BEFORE, words.length - EXCERPT_WORDS));
  const end = Math.min(words.length, start + EXCERPT_WORDS);
  const parts: ExcerptPart[] = [];
  for (let i = start; i < end; i++) {
    const mark = matched.has(i);
    const text = (i > start ? ' ' : '') + words[i];
    const last = parts[parts.length - 1];
    if (last && last.mark === mark) last.text += text;
    else if (mark && last) {
      // keep the space outside the mark
      last.text += ' ';
      parts.push({ text: words[i], mark });
    } else parts.push({ text, mark });
  }
  return parts;
}

function renderExcerpt(target: HTMLElement, parts: ExcerptPart[]) {
  for (const part of parts) {
    if (part.mark) {
      const mark = document.createElement('mark');
      mark.className = 'search-mark';
      mark.textContent = part.text;
      target.appendChild(mark);
    } else {
      target.appendChild(document.createTextNode(part.text));
    }
  }
}

interface Hit {
  url: string;
  title: string;
  excerpt: ExcerptPart[];
  group: { label: string; order: number; url: string };
}

/**
 * The section headers a chapter reads by (ES3): h2, h3, and the table
 * band labels, which carry static ids from the build. Pagefind records
 * every id in the body as an anchor; these are the anchors results land
 * on, so each match nests under the header above it.
 */
const ANCHOR_ELEMENTS = new Set(['h2', 'h3', 'strong']);

/** One hit per header anchor a document matches under (ES3) */
function hitsForDocument(doc: PagefindDocument, group: Hit['group']): Hit[] {
  const anchors = (doc.anchors ?? [])
    .filter((a) => ANCHOR_ELEMENTS.has(a.element) && a.id && a.text)
    .sort((a, b) => a.location - b.location);
  const locations = [...new Set(doc.locations ?? [])].sort((a, b) => a - b);
  const pageTitle = doc.meta.title ?? group.label;
  if (locations.length === 0 || !doc.content) {
    return [{ url: doc.url, title: pageTitle, excerpt: partsFromExcerpt(doc.excerpt), group }];
  }
  const words = doc.content.split(/[\r\n\s]+/);
  const matched = new Set(locations);
  // First matched word under each anchor (index -1 = the text before any header)
  const firstUnder = new Map<number, number>();
  for (const loc of locations) {
    let idx = -1;
    for (let i = 0; i < anchors.length && anchors[i].location <= loc; i++) idx = i;
    if (!firstUnder.has(idx)) firstUnder.set(idx, loc);
  }
  return [...firstUnder.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([idx, loc]) => {
      const anchor = idx >= 0 ? anchors[idx] : null;
      return {
        url: anchor ? `${doc.url}#${anchor.id}` : doc.url,
        title: anchor ? anchor.text : pageTitle,
        excerpt: partsAround(words, loc, matched),
        group,
      };
    });
}

function normalizeDest(url: string): string {
  return url.replace(/\/$/, '').replace(/\/(#|\?)/, '$1');
}

async function collectHits(pagefind: Pagefind, query: string): Promise<Hit[]> {
  const { results } = await pagefind.search(query);
  const docs = await Promise.all(results.slice(0, MAX_DOCS).map((r) => r.data()));
  const hits: Hit[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    const group = urlToChapter(doc.url);
    if (!group) continue;
    for (const hit of hitsForDocument(doc, group)) {
      const dest = normalizeDest(hit.url);
      if (seen.has(dest)) continue; // one hit per destination anchor (ES3)
      seen.add(dest);
      hits.push(hit);
    }
  }
  return hits;
}

interface Grouped {
  group: Hit['group'];
  hits: Hit[];
}

function groupHits(
  hits: Hit[],
  maxRows: number,
  maxGroups: number
): { groups: Grouped[]; shown: number } {
  const byGroup = new Map<string, Grouped>();
  for (const hit of hits) {
    let g = byGroup.get(hit.group.url);
    if (!g) {
      g = { group: hit.group, hits: [] };
      byGroup.set(hit.group.url, g);
    }
    g.hits.push(hit);
  }
  const ordered = [...byGroup.values()].sort((a, b) => a.group.order - b.group.order);
  const capped: Grouped[] = [];
  let rows = 0;
  for (const g of ordered) {
    if (capped.length >= maxGroups || rows >= maxRows) break;
    const take = g.hits.slice(0, maxRows - rows);
    capped.push({ group: g.group, hits: take });
    rows += take.length;
  }
  return { groups: capped, shown: rows };
}

/** The count line pattern (S43), shared by /search and the live region */
function countLine(hits: Hit[]): string {
  const modules = new Set(hits.map((h) => h.group.url)).size;
  return `${hits.length} results in ${modules} modules`;
}

export interface SearchMount {
  destroy: () => void;
  runQuery: (q: string) => void;
}

export interface MountOptions {
  form: HTMLFormElement;
  /** 'panel' (header box / sheet: capped rows, See all footer) or 'page' (/search) */
  mode: 'panel' | 'page';
  /** page mode: elements owned by /search */
  countEl?: HTMLElement | null;
  contentsEl?: HTMLElement | null;
}

/** Detail of the cancelable rt-search-navigate event a host may take over */
export interface SearchNavigateDetail {
  url: string;
  go: () => void;
}

export function mountSearch(opts: MountOptions): SearchMount {
  const { form, mode } = opts;
  const root = form.parentElement!;
  const input = form.querySelector<HTMLInputElement>('input[type="search"]')!;
  const panel = root.querySelector<HTMLElement>('[data-search-panel]')!;
  const listbox = panel.querySelector<HTMLElement>('[role="listbox"]')!;
  const statusEl = panel.querySelector<HTMLElement>('[data-search-status]')!;
  const liveEl = root.querySelector<HTMLElement>('[data-search-live]');
  const footer = panel.querySelector<HTMLElement>('[data-search-footer]');
  const moreEl = panel.querySelector<HTMLElement>('[data-search-more]');
  const seeAll = panel.querySelector<HTMLAnchorElement>('[data-search-see-all]');

  let debounceId = 0;
  let searchingId = 0;
  let seq = 0;
  let active = -1;
  let options: HTMLElement[] = [];

  const setExpanded = (open: boolean) => {
    panel.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (!open) {
      active = -1;
      input.removeAttribute('aria-activedescendant');
    }
  };

  const status = (text: string) => {
    statusEl.textContent = text;
    statusEl.hidden = text === '';
  };

  const setActive = (i: number) => {
    options[active]?.setAttribute('aria-selected', 'false');
    active = i;
    const el = options[i];
    if (el) {
      el.setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  /** The navigation a pick performs (ES6): same-page picks push a history entry */
  const goTo = (url: string) => () => {
    const dest = new URL(url, location.origin);
    if (dest.pathname === location.pathname && dest.hash) {
      history.pushState(null, '', dest.hash);
      const target = document.getElementById(decodeURIComponent(dest.hash.slice(1)));
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.scrollIntoView();
        target.focus({ preventScroll: true });
      }
      setExpanded(false);
    } else {
      try {
        sessionStorage.setItem(LANDING_KEY, '1');
      } catch {
        /* focus assist off */
      }
      location.href = url;
    }
  };

  const navigateTo = (url: string) => {
    storeQuery(input.value);
    const go = goTo(url);
    // A host (the phone sheet) may take the pick over to settle its own
    // history entry first; otherwise the pick is a plain navigation
    const detail: SearchNavigateDetail = { url, go };
    const event = new CustomEvent('rt-search-navigate', { bubbles: true, cancelable: true, detail });
    if (root.dispatchEvent(event)) go();
  };

  const render = (query: string, hits: Hit[]) => {
    const maxRows = mode === 'panel' ? PANEL_MAX_ROWS : PAGE_MAX_ROWS;
    const maxGroups = mode === 'panel' ? PANEL_MAX_GROUPS : Number.POSITIVE_INFINITY;
    const { groups, shown } = groupHits(hits, maxRows, maxGroups);
    listbox.textContent = '';
    options = [];
    let idx = 0;
    for (const g of groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'search-results__group';
      groupEl.setAttribute('role', 'group');
      groupEl.setAttribute('aria-label', g.group.label);
      const heading = document.createElement('div');
      heading.className = 'search-results__group-label';
      heading.setAttribute('aria-hidden', 'true');
      heading.textContent = g.group.label;
      groupEl.appendChild(heading);
      for (const hit of g.hits) {
        const opt = document.createElement('a');
        opt.className = 'search-results__row';
        opt.setAttribute('role', 'option');
        opt.setAttribute('aria-selected', 'false');
        opt.tabIndex = -1; // options are reached by arrow keys, never Tab (APG)
        opt.id = `${listbox.id}-opt-${idx}`;
        opt.href = hit.url;
        const title = document.createElement('span');
        title.className = 'search-results__row-title';
        title.textContent = hit.title;
        const excerpt = document.createElement('span');
        excerpt.className = 'search-results__row-excerpt';
        renderExcerpt(excerpt, hit.excerpt);
        opt.append(title, excerpt);
        opt.addEventListener('click', (e) => {
          // Modified clicks keep the browser's own open-in-new-tab
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          navigateTo(hit.url);
        });
        groupEl.appendChild(opt);
        options.push(opt);
        idx++;
      }
      listbox.appendChild(groupEl);
    }

    if (hits.length === 0) {
      status(`No results for ${query}. Try another word, or open the contents.`);
    } else {
      status('');
    }

    if (mode === 'panel') {
      if (moreEl) {
        const more = hits.length - shown;
        moreEl.textContent = more > 0 ? `${more} more results` : '';
      }
      if (seeAll) seeAll.href = searchHref(query);
      if (footer) footer.hidden = hits.length === 0;
      // The polite live count for assistive tech (SR11)
      if (liveEl) liveEl.textContent = hits.length > 0 ? countLine(hits) : '';
    } else {
      if (footer) footer.hidden = true;
      if (opts.countEl) {
        opts.countEl.textContent = countLine(hits);
        opts.countEl.hidden = false;
      }
    }
    // On /search the results replace the contents list; the empty state
    // leaves the contents in place, since it points the reader there
    if (opts.contentsEl) opts.contentsEl.hidden = hits.length > 0;

    setExpanded(true);
  };

  const runQuery = async (query: string) => {
    const mySeq = ++seq;
    if (query.trim().length < 2) {
      clearTimeout(searchingId);
      setExpanded(false);
      listbox.textContent = '';
      options = [];
      status('');
      if (footer) footer.hidden = true;
      if (liveEl) liveEl.textContent = '';
      if (opts.countEl) opts.countEl.hidden = true;
      if (opts.contentsEl) opts.contentsEl.hidden = false;
      return;
    }
    clearTimeout(searchingId);
    searchingId = window.setTimeout(() => {
      if (seq === mySeq) {
        status('Searching');
        setExpanded(true);
      }
    }, SEARCHING_AFTER_MS);
    try {
      const pagefind = await loadPagefind();
      if (!pagefind) throw new Error('unavailable');
      const hits = await collectHits(pagefind, query);
      if (seq !== mySeq) return;
      clearTimeout(searchingId);
      render(query, hits);
    } catch {
      if (seq !== mySeq) return;
      clearTimeout(searchingId);
      listbox.textContent = '';
      options = [];
      if (footer) footer.hidden = true;
      status('Search is unavailable right now.');
      setExpanded(true);
    }
  };

  const onInput = () => {
    storeQuery(input.value);
    clearTimeout(debounceId);
    debounceId = window.setTimeout(() => runQuery(input.value), DEBOUNCE_MS);
  };

  const onFocus = () => {
    loadPagefind();
    if (input.value === '') {
      const stored = readStoredQuery();
      if (stored) {
        input.value = stored;
        input.select(); // one-keystroke replace (SR5)
      }
    }
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (panel.hidden) runQuery(input.value);
      else setActive(Math.min(active + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(active - 1, -1));
    } else if (e.key === 'Escape') {
      if (!panel.hidden) {
        e.preventDefault();
        e.stopPropagation();
        setExpanded(false); // focus stays in the box (SR2)
      }
    } else if (e.key === 'Enter') {
      if (active >= 0 && options[active]) {
        e.preventDefault();
        navigateTo(options[active].getAttribute('href')!);
      } else {
        // No highlighted option: the native GET form lands /search (SR4)
        storeQuery(input.value);
      }
    }
  };

  const onDocClick = (e: MouseEvent) => {
    if (!root.contains(e.target as Node)) setExpanded(false);
  };
  // The header panel collapses when the page leaves. On /search the
  // panel is the result surface itself, so it stays for a back-forward
  // cache restore; pageshow re-runs the query if the list came back empty
  const onPageHide = () => {
    if (mode === 'panel') setExpanded(false);
  };
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted && mode === 'page' && options.length === 0 && input.value.trim().length >= 2) {
      runQuery(input.value);
    }
  };

  input.addEventListener('input', onInput);
  input.addEventListener('focus', onFocus);
  input.addEventListener('keydown', onKeydown);
  document.addEventListener('click', onDocClick);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);

  // The module mounts on the reader's first focus or keystroke: honor
  // whichever already happened before it arrived
  if (document.activeElement === input) onFocus();
  if (input.value.trim().length >= 2) runQuery(input.value);

  return {
    destroy: () => {
      clearTimeout(debounceId);
      clearTimeout(searchingId);
      input.removeEventListener('input', onInput);
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('keydown', onKeydown);
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    },
    runQuery,
  };
}

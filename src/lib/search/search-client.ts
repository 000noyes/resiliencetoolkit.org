/**
 * The one search module (2A): mounted by the header box, the phone search
 * sheet, and /search. Loaded lazily on first focus (ES7); Pagefind itself
 * loads inside it, so pages ship zero search JS until a reader reaches
 * for the box.
 *
 * Contract (the search end-state addendum): panel opens at the 2nd
 * character with a 150ms debounce; a Searching line appears past 400ms;
 * failure and offline reuse the shipped unavailable line; results group
 * by chapter (derived from the one contents model), one hit per
 * destination anchor, max 6 rows across max 3 groups in the panel;
 * combobox keyboard per APG; Escape closes and keeps focus; outside
 * click and route change dismiss, scroll does not; Enter with no
 * highlighted option submits the native form to /search. Query recall is
 * sessionStorage restore-on-focus, URL beating storage on /search (ES5).
 */
import { urlToChapter } from './urlToChapter';

interface PagefindSubResult {
  url: string;
  title: string;
  excerpt: string;
}

interface PagefindDocument {
  url: string;
  excerpt: string;
  meta: { title?: string };
  sub_results?: PagefindSubResult[];
}

interface PagefindResult {
  data: () => Promise<PagefindDocument>;
}

interface Pagefind {
  search: (q: string) => Promise<{ results: PagefindResult[] }>;
}

const STORE_KEY = 'rt-search-query';
const DEBOUNCE_MS = 150;
const SEARCHING_AFTER_MS = 400;
const PANEL_MAX_ROWS = 6;
const PANEL_MAX_GROUPS = 3;
const PAGE_MAX_ROWS = 40;

let pagefindPromise: Promise<Pagefind | null> | null = null;

/** Prewarm/load Pagefind once per page (ES7). */
export function loadPagefind(): Promise<Pagefind | null> {
  if (!pagefindPromise) {
    // @ts-expect-error runtime-only module: pagefind generates it into
    // dist at build; it never exists at compile time
    pagefindPromise = import(/* @vite-ignore */ '/pagefind/pagefind.js')
      .then((pf: Pagefind) => pf)
      .catch(() => null);
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

function storeQuery(q: string) {
  try {
    sessionStorage.setItem(STORE_KEY, q);
  } catch {
    /* recall silently off (private mode) */
  }
}

/** Decode HTML entities through an inert document (never live innerHTML). */
function decodeEntities(escaped: string): string {
  return (
    new DOMParser().parseFromString(escaped, 'text/html').documentElement
      .textContent ?? ''
  );
}

/**
 * Pagefind excerpts arrive as escaped text with <mark> around matched
 * words. Build the highlight from text nodes and mark elements: safe
 * text nodes only (SR10), no HTML injection path.
 */
function renderExcerpt(target: HTMLElement, excerpt: string) {
  const parts = excerpt.split(/<\/?mark>/);
  parts.forEach((part, i) => {
    const text = decodeEntities(part);
    if (text === '') return;
    if (i % 2 === 1) {
      const mark = document.createElement('mark');
      mark.className = 'search-mark';
      mark.textContent = text;
      target.appendChild(mark);
    } else {
      target.appendChild(document.createTextNode(text));
    }
  });
}

interface Hit {
  url: string;
  title: string;
  excerpt: string;
  group: { label: string; order: number; url: string };
}

function normalizeDest(url: string): string {
  return url.replace(/\/$/, '').replace(/\/(#|\?)/, '$1');
}

async function collectHits(
  pagefind: Pagefind,
  query: string,
  maxDocs: number
): Promise<Hit[]> {
  const { results } = await pagefind.search(query);
  const docs = await Promise.all(results.slice(0, maxDocs).map((r) => r.data()));
  const hits: Hit[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    const group = urlToChapter(doc.url);
    if (!group) continue;
    const subs =
      doc.sub_results && doc.sub_results.length > 0
        ? doc.sub_results
        : [{ url: doc.url, title: doc.meta.title ?? group.label, excerpt: doc.excerpt }];
    for (const sub of subs) {
      const dest = normalizeDest(sub.url);
      if (seen.has(dest)) continue; // one hit per destination (ES3)
      seen.add(dest);
      hits.push({ url: sub.url, title: sub.title, excerpt: sub.excerpt, group });
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
  onNavigate?: () => void;
}

export function mountSearch(opts: MountOptions): SearchMount {
  const { form, mode } = opts;
  const root = form.parentElement!;
  const input = form.querySelector<HTMLInputElement>('input[type="search"]')!;
  const panel = root.querySelector<HTMLElement>('[data-search-panel]')!;
  const listbox = panel.querySelector<HTMLElement>('[role="listbox"]')!;
  const statusEl = panel.querySelector<HTMLElement>('[data-search-status]')!;
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

  const navigateTo = (url: string) => {
    storeQuery(input.value);
    const dest = new URL(url, location.origin);
    if (dest.pathname === location.pathname && dest.hash) {
      // Same-page pick: push a history entry, land focus on the anchor (ES6)
      history.pushState(null, '', dest.hash);
      const target = document.getElementById(dest.hash.slice(1));
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.scrollIntoView();
        target.focus({ preventScroll: true });
      }
      setExpanded(false);
      opts.onNavigate?.();
    } else {
      try {
        sessionStorage.setItem('rt-search-landing', '1');
      } catch {
        /* focus assist off */
      }
      location.href = url;
    }
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
      const heading = document.createElement('div');
      heading.className = 'search-results__group-label';
      heading.textContent = g.group.label;
      groupEl.appendChild(heading);
      for (const hit of g.hits) {
        const opt = document.createElement('a');
        opt.className = 'search-results__row';
        opt.setAttribute('role', 'option');
        opt.setAttribute('aria-selected', 'false');
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
      if (seeAll) seeAll.href = `/search?q=${encodeURIComponent(query)}`;
      if (footer) footer.hidden = hits.length === 0;
    } else if (opts.countEl) {
      const moduleCount = new Set(hits.map((h) => h.group.url)).size;
      opts.countEl.textContent = `${hits.length} results in ${moduleCount} modules`;
      opts.countEl.hidden = false;
    }
    if (opts.contentsEl) opts.contentsEl.hidden = hits.length > 0 || query.length > 0;

    // Live count for assistive tech (SR11)
    listbox.setAttribute('aria-label', `${hits.length} results`);
    setExpanded(true);
  };

  const runQuery = async (query: string) => {
    const mySeq = ++seq;
    if (query.trim().length < 2) {
      setExpanded(false);
      listbox.textContent = '';
      status('');
      if (footer) footer.hidden = true;
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
      const hits = await collectHits(pagefind, query, 30);
      if (seq !== mySeq) return;
      clearTimeout(searchingId);
      render(query, hits);
    } catch {
      if (seq !== mySeq) return;
      clearTimeout(searchingId);
      listbox.textContent = '';
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

  input.addEventListener('input', onInput);
  input.addEventListener('focus', onFocus);
  input.addEventListener('keydown', onKeydown);
  document.addEventListener('click', onDocClick);
  window.addEventListener('pagehide', () => setExpanded(false));

  return {
    destroy: () => {
      input.removeEventListener('input', onInput);
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('keydown', onKeydown);
      document.removeEventListener('click', onDocClick);
    },
    runQuery,
  };
}

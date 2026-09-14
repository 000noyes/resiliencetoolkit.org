/**
 * The deterministic URL-to-contents join (ES3): every indexed page URL
 * resolves to its place in the one contents model, so search results
 * group by chapter in the structure's own vocabulary. The join is total
 * over the model (a build test asserts every contents URL resolves) and
 * returns null for anything outside it.
 */
import {
  contents,
  frontMatter,
  type Chapter,
  type ContentsSection,
} from '@/data/contents';

export interface SearchGroup {
  /** Group heading in the structure's vocabulary, e.g. "1.2 Food and water" */
  label: string;
  /** Reading order for sorting groups */
  order: number;
  url: string;
}

function normalize(url: string): string {
  try {
    const path = url.startsWith('http') ? new URL(url).pathname : url;
    const clean = path.replace(/[?#].*$/, '').replace(/\/$/, '');
    return clean === '' ? '/' : clean;
  } catch {
    return url;
  }
}

const joinTable = new Map<string, SearchGroup>();
let order = 0;
joinTable.set(frontMatter.path, {
  label: frontMatter.title,
  order: order++,
  url: frontMatter.path,
});
for (const section of contents) {
  if (section.openerPath) {
    joinTable.set(normalize(section.openerPath), {
      label: section.title,
      order: order++,
      url: section.openerPath,
    });
  }
  for (const chapter of section.chapters) {
    const url = `${section.basePath}/${chapter.slug}`;
    joinTable.set(normalize(url), {
      label: `${chapter.number} ${chapter.title}`,
      order: order++,
      url,
    });
  }
}

/** Resolve an indexed page URL to its contents-model group, or null. */
export function urlToChapter(url: string): SearchGroup | null {
  return joinTable.get(normalize(url)) ?? null;
}

/** Every joinable URL, for the totality build assertion. */
export function joinableUrls(): string[] {
  return [...joinTable.keys()];
}

export type { Chapter, ContentsSection };

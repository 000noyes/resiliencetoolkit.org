/**
 * check-build-output.ts
 *
 * Last postbuild step. It reads the finished dist/ and fails the build when
 * the output is wrong, so a broken build never deploys:
 *
 * 1. Every page the table of contents links to (front matter, section
 *    openers, every chapter, back matter) plus the home page and the site
 *    chrome pages has a dist/<path>/index.html.
 * 2. Each of those pages carries real reading text, not an empty shell. A
 *    chapter's text is measured inside its <article> (the reading column),
 *    because the header, contents rail and footer alone come to about 2,400
 *    characters; it needs at least MIN_CHAPTER_TEXT. Any other page needs
 *    MIN_PAGE_TEXT of visible text on the whole page.
 * 3. No text file in dist/ contains a forbidden string: the unreplaced
 *    service worker version sentinel, or a URL pointing at a local dev
 *    server.
 *
 * The page list comes from src/data/contents.ts, the same model the site
 * renders its contents from, so a chapter added there is checked here with
 * no further edit. Runs inside `pnpm build`, so the Cloudflare build fails
 * the same way a local one does.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { contents, frontMatter, resourceLibrary, siteChrome } from '../src/data/contents';

export const MIN_CHAPTER_TEXT = 300;
export const MIN_PAGE_TEXT = 200;

export const FORBIDDEN_STRINGS = ['v-build-PENDING', '://localhost', '://127.0.0.1'];

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.xml', '.txt', '.webmanifest', '']);

export interface ExpectedPage {
  path: string;
  minText: number;
  /** Measure only the text inside the page's <article> (chapters). */
  article?: boolean;
}

/** Every internal page the contents model links to, plus home and site chrome. */
export function expectedPages(): ExpectedPage[] {
  const pages: ExpectedPage[] = [
    { path: '/', minText: MIN_PAGE_TEXT },
    { path: frontMatter.path, minText: MIN_PAGE_TEXT },
    { path: resourceLibrary.path, minText: MIN_PAGE_TEXT },
    ...siteChrome.map((item) => ({ path: item.path, minText: MIN_PAGE_TEXT })),
  ];
  for (const section of contents) {
    if (section.openerPath) pages.push({ path: section.openerPath, minText: MIN_PAGE_TEXT });
    for (const chapter of section.chapters) {
      pages.push({ path: `${section.basePath}/${chapter.slug}`, minText: MIN_CHAPTER_TEXT, article: true });
    }
  }
  return pages;
}

/** Visible text of an HTML document: scripts, styles and tags removed, whitespace collapsed. */
export function visibleText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageFile(distDir: string, path: string): string {
  const clean = path.replace(/^\/+|\/+$/g, '');
  return clean ? join(distDir, clean, 'index.html') : join(distDir, 'index.html');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Returns one line per problem; an empty list means the output passes. */
export function checkBuildOutput(distDir: string, pages: ExpectedPage[] = expectedPages()): string[] {
  if (!existsSync(distDir)) return [`${distDir} does not exist`];
  const problems: string[] = [];

  for (const { path, minText, article } of pages) {
    const file = pageFile(distDir, path);
    if (!existsSync(file)) {
      problems.push(`missing page: ${path} (expected ${file})`);
      continue;
    }
    let html = readFileSync(file, 'utf-8');
    if (article) {
      const match = html.match(/<article\b[^>]*>([\s\S]*)<\/article>/i);
      if (!match) {
        problems.push(`no chapter article: ${path}`);
        continue;
      }
      html = match[1];
    }
    const length = visibleText(html).length;
    if (length < minText) {
      problems.push(`too little text: ${path} has ${length} characters, needs at least ${minText}`);
    }
  }

  for (const file of walk(distDir)) {
    if (!TEXT_EXTENSIONS.has(extname(file))) continue;
    const body = readFileSync(file, 'utf-8');
    for (const needle of FORBIDDEN_STRINGS) {
      if (body.includes(needle)) problems.push(`forbidden string "${needle}" in ${file}`);
    }
  }

  return problems;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  const pages = expectedPages();
  const problems = checkBuildOutput(distDir, pages);
  if (problems.length > 0) {
    console.error(`build output check: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`build output check: ${pages.length} pages present with text; no forbidden strings`);
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  checkBuildOutput,
  expectedPages,
  visibleText,
  MIN_CHAPTER_TEXT,
  type ExpectedPage,
} from '../../scripts/check-build-output';
import { allChapters } from '../../src/data/contents';

let dist: string;

const CHROME = 'Site header and contents rail text that every page carries. '.repeat(3);

function writePage(path: string, text: string, opts: { article?: boolean } = {}): void {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const file = clean ? join(dist, clean, 'index.html') : join(dist, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  const body = opts.article ? `${CHROME}<article class="reading-content">${text}</article>${CHROME}` : text;
  writeFileSync(file, `<!doctype html><html><head><script>var x = 1;</script></head><body><main>${body}</main></body></html>`);
}

const PAGES: ExpectedPage[] = [
  { path: '/', minText: 20 },
  { path: '/modules/a/1-1', minText: 50, article: true },
];

beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'check-build-output-'));
});
afterEach(() => {
  rmSync(dist, { recursive: true, force: true });
});

describe('check-build-output: expectedPages', () => {
  it('lists every chapter in the contents model with the chapter minimum', () => {
    const pages = expectedPages();
    for (const { chapter, section } of allChapters()) {
      expect(pages).toContainEqual({
        path: `${section.basePath}/${chapter.slug}`,
        minText: MIN_CHAPTER_TEXT,
        article: true,
      });
    }
  });

  it('includes the home page, front matter and back matter', () => {
    const paths = expectedPages().map((p) => p.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/introduction');
    expect(paths).toContain('/downloads');
  });
});

describe('check-build-output: visibleText', () => {
  it('drops scripts, styles, comments and tags', () => {
    expect(visibleText('<style>p{}</style><script>alert(1)</script><!-- c --><p>Hello <b>hub</b></p>')).toBe('Hello hub');
  });
});

describe('check-build-output: checkBuildOutput', () => {
  it('passes a complete tree', () => {
    writePage('/', 'Welcome to the toolkit home page.');
    writePage('/modules/a/1-1', 'x'.repeat(60), { article: true });
    expect(checkBuildOutput(dist, PAGES)).toEqual([]);
  });

  it('reports a missing chapter page with its path', () => {
    writePage('/', 'Welcome to the toolkit home page.');
    const problems = checkBuildOutput(dist, PAGES);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^missing page: \/modules\/a\/1-1/);
  });

  it('reports a chapter whose article is nearly empty, even with full page chrome', () => {
    writePage('/', 'Welcome to the toolkit home page.');
    writePage('/modules/a/1-1', 'short', { article: true });
    expect(checkBuildOutput(dist, PAGES)).toEqual([
      'too little text: /modules/a/1-1 has 5 characters, needs at least 50',
    ]);
  });

  it('reports the unreplaced service worker sentinel and local dev URLs', () => {
    writePage('/', 'Welcome to the toolkit home page.');
    writePage('/modules/a/1-1', 'x'.repeat(60), { article: true });
    writeFileSync(join(dist, 'sw.js'), "const CACHE_VERSION = 'v-build-PENDING';");
    writeFileSync(join(dist, 'app.js'), 'fetch("http://localhost:4321/api")');
    const problems = checkBuildOutput(dist, PAGES);
    expect(problems).toHaveLength(2);
    expect(problems.some((p) => p.includes('"v-build-PENDING"') && p.endsWith('sw.js'))).toBe(true);
    expect(problems.some((p) => p.includes('"://localhost"') && p.endsWith('app.js'))).toBe(true);
  });

  it('allows a bare localhost hostname, which the service worker host guard uses', () => {
    writePage('/', 'Welcome to the toolkit home page.');
    writePage('/modules/a/1-1', 'x'.repeat(60), { article: true });
    writeFileSync(join(dist, 'sw.js'), "const HOSTS = ['rt.localhost', 'localhost'];");
    expect(checkBuildOutput(dist, PAGES)).toEqual([]);
  });

  it('reports a chapter page with no article', () => {
    writePage('/', 'Welcome to the toolkit home page.');
    writePage('/modules/a/1-1', 'x'.repeat(60));
    expect(checkBuildOutput(dist, PAGES)).toEqual(['no chapter article: /modules/a/1-1']);
  });

  it('reports a missing dist directory', () => {
    expect(checkBuildOutput(join(dist, 'nope'), PAGES)).toEqual([`${join(dist, 'nope')} does not exist`]);
  });
});

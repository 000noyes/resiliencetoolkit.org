import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The changelog page renders the repository's CHANGELOG.md, so the page and
// the file cannot disagree. These assertions hold that: the current release
// reaches the page, and the retired hand-typed entries do not.
// dist/ is gitignored build output - assertions skip when it is absent.
// Run `pnpm build` then `pnpm vitest run tests/build/changelog-page.test.ts`.

const distDir = path.resolve(__dirname, '../../dist');
const changelogPage = path.join(distDir, 'changelog/index.html');
const DIST_PRESENT = existsSync(distDir);

describe('changelog page renders the changelog file', () => {
  it.skipIf(!DIST_PRESENT)('carries the current release and none of the retired entries', () => {
    const html = existsSync(changelogPage) ? readFileSync(changelogPage, 'utf-8') : '';
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('0.1.2');
    expect(html).not.toContain('Homepage Photo Gallery');
  });
});

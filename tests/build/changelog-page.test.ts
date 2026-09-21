import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The changelog page renders the repository's CHANGELOG.md, so the page and
// the file cannot fall out of step. The assertions read the file rather than
// a pinned version, so a release needs no test edit.
// dist/ is gitignored build output - assertions skip when it is absent.
// Run `pnpm build` then `pnpm vitest run tests/build/changelog-page.test.ts`.

const repoRoot = path.resolve(__dirname, '../..');
const distDir = path.join(repoRoot, 'dist');
const changelogPage = path.join(distDir, 'changelog/index.html');
const changelogFile = path.join(repoRoot, 'CHANGELOG.md');
const DIST_PRESENT = existsSync(distDir);

describe('changelog page renders the changelog file', () => {
  it.skipIf(!DIST_PRESENT)('carries the newest release and none of the retired entries', () => {
    const html = existsSync(changelogPage) ? readFileSync(changelogPage, 'utf-8') : '';
    const file = readFileSync(changelogFile, 'utf-8');
    const newestRelease = file.match(/^## (\[[^\]]+\][^\n]*)$/m)?.[1];

    expect(html.length).toBeGreaterThan(0);
    expect(newestRelease).toBeTruthy();
    expect(html).toContain(newestRelease as string);
    expect(html).toContain('Notable changes to ResilienceToolkit.org');
    expect(html).not.toContain('Homepage Photo Gallery');
  });
});

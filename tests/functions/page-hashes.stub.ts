/**
 * Stand-in for functions/lib/page-hashes.generated.js under vitest. The real
 * file is written at postbuild and gitignored, so it does not exist on a
 * checkout that has not built (CI runs vitest before any build). vitest.config.ts
 * aliases the generated module to this file, so the middleware imports the
 * same two entries locally and on CI.
 */
export const PAGE_HASHES: Readonly<Record<string, string>> = {
  '/': '0123456789abcdef',
  '/modules/1-1/': 'fedcba9876543210',
};

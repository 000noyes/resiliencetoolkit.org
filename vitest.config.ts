import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: '@/components', replacement: path.resolve(dirname, './src/components') },
      { find: '@/design-system', replacement: path.resolve(dirname, './src/design-system') },
      { find: '@/layouts', replacement: path.resolve(dirname, './src/layouts') },
      { find: '@/lib', replacement: path.resolve(dirname, './src/lib') },
      { find: '@', replacement: path.resolve(dirname, './src') },
      // The page hash map is written at postbuild and gitignored; under
      // vitest the middleware reads a tracked stub instead, so the suite runs
      // the same on a checkout that has not built (CI).
      {
        find: /^\.\/lib\/page-hashes\.generated$/,
        replacement: path.resolve(dirname, './tests/functions/page-hashes.stub.ts'),
      },
    ],
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
  },
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
      '@/components': path.resolve(dirname, './src/components'),
      '@/design-system': path.resolve(dirname, './src/design-system'),
      '@/layouts': path.resolve(dirname, './src/layouts'),
      '@/lib': path.resolve(dirname, './src/lib'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
  },
});

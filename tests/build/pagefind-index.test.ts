import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const distDir = path.resolve(__dirname, '../../dist');
const pagefindDir = path.join(distDir, 'pagefind');

describe('pagefind build output', () => {
  it('dist/pagefind/ directory exists', () => {
    expect(existsSync(pagefindDir)).toBe(true);
  });

  it('contains pagefind.js entry point', () => {
    expect(existsSync(path.join(pagefindDir, 'pagefind.js'))).toBe(true);
  });

  it('contains at least one index chunk', () => {
    const files = readdirSync(pagefindDir);
    const hasChunk = files.some((f) => f.endsWith('.pf_meta'));
    expect(hasChunk).toBe(true);
  });
});

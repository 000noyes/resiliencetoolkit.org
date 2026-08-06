// @vitest-environment node
/**
 * Workshop noindex postbuild: the header rule is appended only on workshop
 * builds, exactly once, without disturbing the existing _headers content
 * (the CSP block must survive byte-for-byte).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { appendWorkshopHeaders, NOINDEX_BLOCK } from '../../scripts/append-workshop-headers.mjs';

const EXISTING = '/*\n  X-Frame-Options: DENY\n\n/sw.js\n  Cache-Control: no-cache\n';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'workshop-headers-'));
  writeFileSync(join(dir, '_headers'), EXISTING, 'utf-8');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('appendWorkshopHeaders', () => {
  it('does nothing on a production build (no WORKSHOP flag)', () => {
    expect(appendWorkshopHeaders(dir, {})).toBe('skipped');
    expect(readFileSync(join(dir, '_headers'), 'utf-8')).toBe(EXISTING);
  });

  it('appends the noindex block on a workshop build, keeping the existing rules intact', () => {
    expect(appendWorkshopHeaders(dir, { WORKSHOP: '1' })).toBe('appended');
    const content = readFileSync(join(dir, '_headers'), 'utf-8');
    expect(content.startsWith(EXISTING)).toBe(true);
    expect(content).toContain('X-Robots-Tag: noindex');
    expect(content.endsWith(NOINDEX_BLOCK)).toBe(true);
  });

  it('is idempotent: a second run never duplicates the rule', () => {
    appendWorkshopHeaders(dir, { WORKSHOP: '1' });
    expect(appendWorkshopHeaders(dir, { WORKSHOP: '1' })).toBe('already-present');
    const content = readFileSync(join(dir, '_headers'), 'utf-8');
    expect(content.match(/X-Robots-Tag/g)).toHaveLength(1);
  });

  it('creates _headers when the build produced none', () => {
    rmSync(join(dir, '_headers'));
    expect(appendWorkshopHeaders(dir, { WORKSHOP: '1' })).toBe('appended');
    expect(readFileSync(join(dir, '_headers'), 'utf-8')).toContain('X-Robots-Tag: noindex');
  });
});

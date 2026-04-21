import { describe, it, expect } from 'vitest';
import { normalizeUrl, TRACKING_PARAMS } from './normalize-url';

describe('normalizeUrl', () => {
  it('strips ?usp=drive_link (common Drive URL suffix)', () => {
    expect(
      normalizeUrl('https://drive.google.com/file/d/ABC123/view?usp=drive_link'),
    ).toBe('https://drive.google.com/file/d/ABC123/view');
  });

  it('strips all utm_ variants (utm_source, utm_medium, utm_campaign, utm_term, utm_content)', () => {
    const input =
      'https://example.com/path?utm_source=a&utm_medium=b&utm_campaign=c&utm_term=d&utm_content=e';
    expect(normalizeUrl(input)).toBe('https://example.com/path');
  });

  it('preserves gid (Sheets tab ID is semantically meaningful)', () => {
    expect(
      normalizeUrl('https://docs.google.com/spreadsheets/d/XYZ/edit?gid=123'),
    ).toBe('https://docs.google.com/spreadsheets/d/XYZ/edit?gid=123');
  });

  it('preserves other meaningful query params alongside stripping trackers', () => {
    expect(
      normalizeUrl('https://example.com/search?q=resilience&utm_source=twitter&page=2'),
    ).toBe('https://example.com/search?q=resilience&page=2');
  });

  it('lowercases host', () => {
    expect(normalizeUrl('https://Drive.Google.COM/file/d/ABC')).toBe(
      'https://drive.google.com/file/d/ABC',
    );
  });

  it('strips trailing slash on path but preserves root "/"', () => {
    expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('strips fragment', () => {
    expect(normalizeUrl('https://example.com/page#section-3')).toBe(
      'https://example.com/page',
    );
  });

  it('is idempotent: normalizeUrl(normalizeUrl(x)) === normalizeUrl(x)', () => {
    const messy =
      'https://Drive.Google.COM/file/d/ABC/view/?usp=drive_link&utm_source=news#hash';
    const once = normalizeUrl(messy);
    const twice = normalizeUrl(once);
    expect(twice).toBe(once);
  });

  it('returns trimmed input for non-URL strings (no throw)', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
    expect(normalizeUrl('  spaces  ')).toBe('spaces');
    expect(normalizeUrl('')).toBe('');
  });

  it('two equivalent Drive URLs normalize to the same value', () => {
    const a = normalizeUrl('https://drive.google.com/file/d/ABC/view');
    const b = normalizeUrl('https://DRIVE.google.com/file/d/ABC/view?usp=drive_link');
    const c = normalizeUrl('https://drive.google.com/file/d/ABC/view/#anchor');
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('TRACKING_PARAMS set exposes the literal keys stripped (contract)', () => {
    expect(TRACKING_PARAMS.has('usp')).toBe(true);
    expect(TRACKING_PARAMS.has('utm_source')).toBe(false); // utm_ handled by prefix, not set membership
    expect(TRACKING_PARAMS.has('gid')).toBe(false);
  });
});

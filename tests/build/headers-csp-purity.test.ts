/**
 * Privacy gate: the Content-Security-Policy in public/_headers must allow no
 * third-party origins. The runtime network-purity Playwright test catches a
 * tracker *script* that actually fires, but astro preview (sirv) does not apply
 * public/_headers, so a CSP-only regression — re-adding cloud.umami.is or
 * static.cloudflareinsights.com to the allowlist — would slip past it. This
 * asserts the deployed policy itself stays self-only, the layer that actually
 * enforces "nothing leaves the device" on Cloudflare.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const HEADERS = readFileSync(join(ROOT, 'public/_headers'), 'utf-8');

describe('public/_headers — CSP allows no third-party origins', () => {
  const cspLine = HEADERS.split('\n').find((l) => /Content-Security-Policy:/i.test(l));

  it('has a Content-Security-Policy', () => {
    expect(cspLine).toBeTruthy();
  });

  it('references no http(s):// origin (self-only policy)', () => {
    const schemeOrigins = (cspLine ?? '').match(/https?:\/\/[^\s;]+/g) ?? [];
    expect(schemeOrigins, `third-party origins in CSP: ${schemeOrigins.join(', ')}`).toEqual([]);
  });

  it('does not mention known trackers', () => {
    expect(HEADERS).not.toMatch(/umami|cloudflareinsights/i);
  });
});

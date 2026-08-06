/**
 * The E10 client failure contract: saved means a 2xx status AND a JSON body
 * with ok AND the server pin number key. Anything else (throw, non-2xx,
 * non-JSON HTML error page, missing fields) is the keep/retry/copy state.
 */
import { describe, it, expect } from 'vitest';
import { interpretPostResponse, newDraftUuid } from './post-contract';

describe('interpretPostResponse', () => {
  it('accepts the happy envelope', () => {
    expect(interpretPostResponse(200, '{"ok":true,"pin_no":3}')).toEqual({
      saved: true,
      pinNo: 3,
    });
  });

  it('accepts a whole-page save (pin_no null is still a save)', () => {
    expect(interpretPostResponse(200, '{"ok":true,"pin_no":null}')).toEqual({
      saved: true,
      pinNo: null,
    });
  });

  it('refuses any non-2xx even with a plausible body', () => {
    expect(interpretPostResponse(429, '{"ok":true,"pin_no":1}').saved).toBe(false);
    expect(interpretPostResponse(500, '{"ok":false}').saved).toBe(false);
  });

  it('refuses the daily-cap HTML error page (non-JSON never crashes)', () => {
    const html = '<!DOCTYPE html><html><body>Error 1027</body></html>';
    expect(interpretPostResponse(200, html).saved).toBe(false);
  });

  it('refuses a JSON body without ok or without the pin_no key', () => {
    expect(interpretPostResponse(200, '{"pin_no":2}').saved).toBe(false);
    expect(interpretPostResponse(200, '{"ok":true}').saved).toBe(false);
    expect(interpretPostResponse(200, 'null').saved).toBe(false);
  });
});

describe('newDraftUuid', () => {
  it('returns distinct well-formed ids', () => {
    const a = newDraftUuid();
    const b = newDraftUuid();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });
});

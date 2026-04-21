export const TRACKING_PARAMS = new Set(['usp']);

export function normalizeUrl(input: string): string {
  try {
    const u = new URL(input);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    const drop: string[] = [];
    for (const key of u.searchParams.keys()) {
      if (TRACKING_PARAMS.has(key) || key.startsWith('utm_')) drop.push(key);
    }
    for (const k of drop) u.searchParams.delete(k);
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString();
  } catch {
    return input.trim();
  }
}

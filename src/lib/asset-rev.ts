// Deployed-asset revision marker.
//
// Bumped 2026-06-07 to force fresh `/_astro` content hashes after a Cloudflare
// asset-store poisoning incident: the v0.0.13.0 island chunks (Todo, DataTable,
// SlotCollection, and the BaseLayout entry script) were cached by Cloudflare as
// HTTP 500 and served broken on every module page, so the interactive tables and
// todos failed to hydrate. Cloudflare content-addresses static assets, so the
// only reliable fix is to change the chunks' content and mint fresh, un-poisoned
// hashes. Importing this module into those components does exactly that.
//
// Safe to bump (or remove the imports) once the poisoned blobs are purged.
export const ASSET_REV = '2026-06-07-1';

// Top-level side effect so a bare `import '@/lib/asset-rev'` is preserved rather
// than tree-shaken (package.json declares no `sideEffects: false`). Doubles as a
// way to read which deploy a browser is running: `window.__RHT_ASSET_REV__`.
if (typeof window !== 'undefined') {
  (window as Window & { __RHT_ASSET_REV__?: string }).__RHT_ASSET_REV__ = ASSET_REV;
}

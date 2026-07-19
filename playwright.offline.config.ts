import { defineConfig, devices } from '@playwright/test';

/**
 * Offline-durability + network-purity Playwright project.
 *
 * SEPARATE from playwright.config.ts on purpose. The standard e2e project runs
 * against `astro dev`, which does NOT run the postbuild precache generator — so
 * the service worker under `dev` is absent/wrong and an offline test there is
 * meaningless. This project runs against the REAL built artifact:
 *   `pnpm build` (runs scripts/generate-sw-precache.mjs as postbuild) → `astro preview`.
 *
 * Why `rt.localhost` and not `localhost`?
 *   src/lib/sw-register.ts unregisters the service worker whenever the hostname
 *   is `localhost` or `127.0.0.1` (its dev guard). Chromium resolves any
 *   `*.localhost` name to the loopback address AND treats it as a secure
 *   context, so `rt.localhost` gives us a working service worker over plain
 *   http while sidestepping the dev guard — i.e. it exercises the worker
 *   exactly as production does. The webServer readiness URL stays on
 *   `localhost` (same loopback) just for the up-check.
 */
export default defineConfig({
  testDir: './tests/e2e-offline',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://rt.localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'offline',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/webkit-offline-shell.spec.ts',
    },
    // WebKit is the engine under iOS Safari and the home screen app, where the
    // real offline failures happen (small cache budget, aggressive worker
    // termination, its own Cache API matching). Desktop WebKit is the closest
    // proxy Playwright can drive; the true gate remains a real iPhone check.
    // It runs only its own spec file: WebKit cannot simulate offline via
    // route interception or setOffline without severing the service worker
    // from top-level navigations, so its spec manages a private server whose
    // process it stops instead (see webkit-offline-shell.spec.ts).
    {
      name: 'offline-webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: '**/webkit-offline-shell.spec.ts',
      // Each WebKit test boots its own preview server and fills the whole
      // precache from scratch before it can cut the network, which does not
      // fit the default 30s budget. Headroom raised with the #106 poll-gate
      // conversion: the readiness gates now genuinely wait (they were vacuous
      // async waitForFunction gates that resolved instantly), so a slow CI
      // WebKit fill consumes real wall-clock inside the test instead of racing
      // past it into the offline phase.
      timeout: 180_000,
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm exec astro preview --port 4321 --host',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});

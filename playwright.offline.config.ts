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
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm exec astro preview --port 4321 --host',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});

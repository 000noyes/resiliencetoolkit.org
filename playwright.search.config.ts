import { defineConfig, devices } from '@playwright/test';

/**
 * Search end-state suite: the one header box and its panel, /search's
 * three states, the phone lens and sheet, the bands and the ES4 overflow
 * guard, query recall, and the no-JS floor. Runs against the built
 * artifact (the Pagefind index only exists after a build) on plain
 * localhost, where the service worker unregisters itself; offline search
 * lives in the offline suite.
 */
export default defineConfig({
  testDir: './tests/e2e-search',
  // Each test loads Pagefind and its index fresh; the built preview under
  // a full run needs more than the default budget
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'search',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm exec astro preview --port 4321 --host',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
});

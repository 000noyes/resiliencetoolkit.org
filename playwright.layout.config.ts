import { defineConfig, devices } from '@playwright/test';

/**
 * Layout-contract suite for the 3C reading surface: the DR3 grid and
 * gutter mechanics, the phone bar and sheet grammar, print chrome rules,
 * and the progress-counter regression on the re-housed On this page.
 */
export default defineConfig({
  testDir: './tests/e2e-layout',
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
      name: 'layout',
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

import { defineConfig, devices } from '@playwright/test';

/**
 * Workshop round-page suite: the round route + annotation island on a phone
 * viewport, against `astro dev` with the workshop build variables set (the
 * strip, noindex meta, and the round route only exist under them).
 *
 * The notes API is mocked per test: the function itself is covered by the
 * unit suite in tests/functions/, and the real function + D1 integration is
 * proven on the live domain by the deploy-verify pass. Chromium with a phone
 * profile (Pixel 7): the phone-first layout is what round one ships.
 */
export default defineConfig({
  testDir: './tests/e2e-workshop',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4322',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'workshop-phone',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'pnpm astro dev --port 4322',
    url: 'http://localhost:4322',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      WORKSHOP: '1',
      ROUND_ID: 'r1-e2etesttoken0123456789',
      PLAYWRIGHT_TEST: '1',
    },
  },
});

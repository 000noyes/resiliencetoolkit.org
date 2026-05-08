/**
 * UpdatePromptToast E2E — fakes the SW registration so the toast renders
 * without a real deploy cycle. Verifies render + accept-update postMessage.
 *
 * Run: npx playwright test update-prompt-toast
 *
 * Why a fake registration: in dev mode (the playwright webServer command),
 * BaseLayout unregisters real service workers. We inject a fake on the
 * window before any island hydrates, then assert the toast surfaces it.
 */
import { test, expect } from '@playwright/test';

test.describe('UpdatePromptToast', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const events: Record<string, ((e: any) => void)[]> = {};
      const fakeWaiting: any = {
        scriptURL: '/sw.js?fake=1',
        state: 'installed',
        postMessage: (msg: any) => {
          (window as any).__lastSwMessage = msg;
          setTimeout(() => {
            (events.controllerchange || []).forEach((cb) => cb({}));
          }, 50);
        },
      };
      const fakeRegistration: any = {
        waiting: fakeWaiting,
        installing: null,
        addEventListener: () => {},
        unregister: () => Promise.resolve(true),
      };

      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          ready: Promise.resolve(fakeRegistration),
          controller: { state: 'activated' },
          register: () => Promise.resolve(fakeRegistration),
          getRegistrations: () => Promise.resolve([fakeRegistration]),
          addEventListener: (type: string, cb: (e: any) => void) => {
            (events[type] ||= []).push(cb);
          },
          removeEventListener: () => {},
        },
      });
    });

    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('renders toast when SW has a waiting worker; Update now posts SKIP_WAITING', async ({ page }) => {
    await page.reload();

    const toast = page.locator('[role="status"]', { hasText: 'Toolkit update available' });
    await expect(toast).toBeVisible({ timeout: 10000 });

    const updateButton = toast.getByRole('button', { name: 'Update now.' });
    await expect(updateButton).toBeVisible();

    await updateButton.click();

    await expect
      .poll(() => page.evaluate(() => (window as any).__lastSwMessage))
      .toEqual({ type: 'SKIP_WAITING' });
  });
});

import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The backup-to-import journey, walked whole on the built artifact:
 * notice strip -> anchor landing -> backup -> receipt -> restore preview ->
 * replace -> the just-restored card after reload. Plus the no-work silence
 * matrix (a visitor with nothing saved never sees the soft storage strip),
 * session dismissal, and the JS-dead server shell.
 *
 * Selectors are stable test ids, never copy strings, so copy sweeps cannot
 * churn this suite. Runs in the chromium 'offline' project only (the
 * WebKit-only project is reserved for dead-server shell navigation).
 */

const dirname = path.dirname(fileURLToPath(import.meta.url));
const LEGACY_FIXTURE = path.resolve(
  dirname,
  '../fixtures/backups/resilience-toolkit-backup-2026-06-15.json',
);

// Force a non-durable origin so the soft storage strip is a live claimant.
async function forceAtRisk(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persist: async () => false,
        persisted: async () => false,
        estimate: async () => ({ usage: 0, quota: 0 }),
      },
    });
  });
}

// The plain-anchor transport is the deterministic one under automation: the
// save picker would open a native dialog no test can drive.
async function forceAnchorTransport(page: Page) {
  await page.addInitScript(() => {
    // @ts-expect-error - removing the picker capability on purpose
    delete window.showSaveFilePicker;
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: undefined,
    });
  });
}

/** Seed one todo and one table row through the app's own IndexedDB schema. */
async function seedWork(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('resilience-toolkit', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['todos', 'tables'], 'readwrite');
        tx.objectStore('todos').put({
          id: 'e2e-journey-t1',
          moduleKey: 'e2e-journey',
          todoId: 't1',
          completed: true,
          completedAt: new Date().toISOString(),
        });
        tx.objectStore('tables').put({
          id: 'e2e-journey-tab-r1',
          moduleKey: 'e2e-journey',
          tableId: 'tab',
          rowId: 'r1',
          data: { col: 'seeded' },
          updatedAt: new Date().toISOString(),
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    localStorage.setItem(
      'rt-has-work',
      JSON.stringify({ modules: { 'e2e-journey': true }, updatedAt: new Date().toISOString() }),
    );
  });
}

const softStrip = (page: Page) => page.getByText(/keep a backup copy/i);

test.describe('no-work silence', () => {
  test('a browse-only visitor never sees the soft storage strip, even at risk', async ({ page }) => {
    test.setTimeout(90_000);
    await forceAtRisk(page);
    for (const route of ['/', '/modules/knowing-your-community', '/dashboard']) {
      await page.goto(route, { waitUntil: 'load' });
      // Let the banner island hydrate and its sequenced check settle.
      await page.waitForTimeout(1500);
      await expect(softStrip(page)).toHaveCount(0);
    }
  });

  test('with unprotected work the strip claims, and dismissal stays quiet for the session', async ({
    page,
  }) => {
    await forceAtRisk(page);
    await page.goto('/dashboard', { waitUntil: 'load' });
    await seedWork(page);
    await page.reload({ waitUntil: 'load' });
    await expect(softStrip(page)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Dismiss storage notice' }).click();
    await expect(softStrip(page)).toHaveCount(0);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1500);
    await expect(softStrip(page)).toHaveCount(0);
  });
});

test.describe('the journey', () => {
  test('notice -> anchor landing -> backup -> receipt -> claim released -> restore -> just restored', async ({
    page,
  }) => {
    await forceAtRisk(page);
    await forceAnchorTransport(page);

    // Arrive with work on the device but no backup ever.
    await page.goto('/dashboard', { waitUntil: 'load' });
    await seedWork(page);
    await page.goto('/', { waitUntil: 'load' });
    await expect(softStrip(page)).toBeVisible({ timeout: 20_000 });

    // The strip's Back up link lands with the backup control visible (the
    // landing test: the anchor actually delivers).
    await page.getByRole('link', { name: 'Back up' }).click();
    await expect(page).toHaveURL(/\/dashboard\/?#backup/);
    const backupButton = page.getByTestId('rt-backup-button');
    await expect(backupButton).toBeVisible({ timeout: 20_000 });
    await expect(backupButton).toBeInViewport();

    // First-work state: work exists, never backed up.
    await expect(page.getByTestId('rt-safety-headline')).toBeVisible();

    // Back up. The anchor transport fires a real download whose filename is
    // dictation-stable (DR10): the name, then the date, then the time.
    const downloadPromise = page.waitForEvent('download');
    await backupButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^resilience-toolkit-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/,
    );

    // The receipt names the file; the soft strip's claim is released.
    await expect(page.getByTestId('rt-safety-receipt')).toContainText(
      download.suggestedFilename(),
    );
    await expect(softStrip(page)).toHaveCount(0);

    // Restore from the committed legacy fixture. The preview shows the
    // filename and, because this device holds work the file does not, the
    // conservative verdict plus the partial-file gate, with Replace demoted.
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(LEGACY_FIXTURE);
    await expect(page.getByTestId('rt-restore-dialog')).toBeVisible();
    await expect(page.getByTestId('rt-restore-filename')).toContainText(
      'resilience-toolkit-backup-2026-06-15.json',
    );
    await expect(page.getByTestId('rt-restore-verdict').first()).toBeVisible();
    await expect(page.getByTestId('rt-restore-partial')).toBeVisible();
    await expect(page.getByTestId('rt-restore-backup-first')).toBeVisible();

    // Replace, then the success handoff: reload lands on the just-restored card.
    await page.getByTestId('rt-restore-replace').click();
    await expect(page.getByTestId('rt-restore-success')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('rt-restore-finish').click();
    await page.waitForLoadState('load');
    await expect(page.getByTestId('rt-safety-headline')).toHaveText('Your work is back.', {
      timeout: 20_000,
    });
  });
});

test.describe('phone relay (DR10)', () => {
  test('the recovery card spells the site and the filename in speakable words', async ({ page }) => {
    await page.goto('/recovery-card', { waitUntil: 'load' });
    await expect(page.getByText('resiliencetoolkit dot org')).toBeVisible();
    await expect(page.getByText('resilience dash toolkit dash backup')).toBeVisible();
  });
});

test.describe('JS-dead shell (DR8)', () => {
  test.use({ javaScriptEnabled: false });

  test('the no-JS dashboard renders the safety zone with true words and no implied calm', async ({
    page,
  }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await expect(page.getByTestId('rt-safety-headline')).toContainText(
      'Your work is saved on this device, and only here.',
    );
    await expect(page.getByTestId('rt-backup-button')).toBeVisible();
    const anchor = page.locator('#backup');
    await expect(anchor).toHaveCount(1);
    const body = await page.textContent('body');
    expect(body).not.toContain('Everything you have is backed up');
  });
});

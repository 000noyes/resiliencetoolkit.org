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
// 39 blank scaffold rows, 0 todos, no lineage hash: the meter-inflation repro.
const EMPTY_SCAFFOLD_FIXTURE = path.resolve(
  dirname,
  '../fixtures/backups/resilience-toolkit-backup-2026-07-04.json',
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

test.describe('empty-scaffold restore (the meter acceptance gate)', () => {
  test('restoring the all-blank legacy backup imports every row yet counts zero, with no loss overlay', async ({
    page,
  }) => {
    // Fresh device, nothing saved. Restore the 39-row all-blank legacy backup
    // (the exact meter-inflation repro): the honest count is zero saved rows.
    await page.goto('/dashboard', { waitUntil: 'load' });

    await page.locator('input[type="file"]').first().setInputFiles(EMPTY_SCAFFOLD_FIXTURE);
    await expect(page.getByTestId('rt-restore-dialog')).toBeVisible();
    await expect(page.getByTestId('rt-restore-filename')).toContainText(
      'resilience-toolkit-backup-2026-07-04.json',
    );
    // Blank scaffold rows are not saved work: no "back up first" verdict and no
    // partial-file gate fire over a device that holds nothing and a file that
    // holds no real work. The single Replace button is offered directly.
    await expect(page.getByTestId('rt-restore-verdict')).toHaveCount(0);
    await expect(page.getByTestId('rt-restore-partial')).toHaveCount(0);

    await page.getByTestId('rt-restore-replace').click();
    await expect(page.getByTestId('rt-restore-success')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('rt-restore-finish').click();
    await page.waitForLoadState('load');

    // Counting fix, not deletion: every one of the 39 rows imported and lives on
    // the device (import is untouched; the fix filters what is counted, never
    // what is kept).
    const rowCount = await page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const req = indexedDB.open('resilience-toolkit');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const countReq = db.transaction('tables').objectStore('tables').count();
            countReq.onsuccess = () => {
              db.close();
              resolve(countReq.result);
            };
            countReq.onerror = () => reject(countReq.error);
          };
        }),
    );
    expect(rowCount).toBe(39);

    // The card is honest: no false "your work may be missing" overlay, and the
    // meter reads no saved work rather than 39 inflated rows.
    await page.waitForTimeout(1500); // let the safety-card island settle
    const body = await page.textContent('body');
    expect(body).not.toContain('Some saved work may be missing.');
    // The repro was "39 saved rows" on a device with zero real work.
    expect(body).not.toContain('39 saved row');
  });
});

// A touch device that advertises file share but cannot deliver it: touch input
// present (so the button shows), canShare({files}) true, yet share() throws a
// non-abort error. This is the phone-with-a-hostile-share-target case the
// download fallback exists for.
async function forceShareThrows(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data?: { files?: unknown[] }) => !!(data && data.files),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Share is not available on this device.', 'NotAllowedError');
      },
    });
  });
}

test.describe('send a copy on a share-hostile browser', () => {
  test('a desktop (no touch) never shows Send a copy', async ({ page }) => {
    // Default Desktop Chrome has no touch input, so the share sheet has no
    // useful target: the button is hidden and Back up my work covers it.
    await page.goto('/dashboard', { waitUntil: 'load' });
    await seedWork(page);
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByTestId('rt-backup-button')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('rt-share-button')).toHaveCount(0);
  });

  test('a thrown share falls back to a download, never "backup did not finish"', async ({ page }) => {
    await forceAnchorTransport(page);
    await forceShareThrows(page);

    await page.goto('/dashboard', { waitUntil: 'load' });
    await seedWork(page);
    await page.reload({ waitUntil: 'load' });

    // Touch device with file share advertised, so Send a copy is offered.
    const shareButton = page.getByTestId('rt-share-button');
    await expect(shareButton).toBeVisible({ timeout: 20_000 });

    // The one-time caution shows on the first send; confirm it.
    await shareButton.click();
    await expect(page.getByTestId('rt-share-caution')).toBeVisible();

    // Confirming calls share(), which throws; the copy comes down as a download
    // instead of failing, so the click always delivers the file.
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Send to a device I own' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^resilience-toolkit-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/,
    );

    // Honest receipt: a made file, never the backup-failure or share-failure words.
    await expect(page.getByTestId('rt-safety-headline')).toHaveText('Your backup file is made.', {
      timeout: 20_000,
    });
    const body = await page.textContent('body');
    expect(body).not.toContain('That backup did not finish.');
    expect(body).not.toContain('That copy did not send.');
  });
});

test.describe('your progress list (no self-duplicating or empty dropdowns)', () => {
  async function seedProgressWork(page: Page) {
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('resilience-toolkit', 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['todos'], 'readwrite');
          const todos = tx.objectStore('todos');
          // A checked item in a child module whose display name equals its parent.
          todos.put({
            id: 'knowing-community-k1',
            moduleKey: 'knowing-community',
            todoId: 'k1',
            completed: true,
            completedAt: new Date().toISOString(),
          });
          // A glanced-at emergency child with nothing checked (a 0-item scaffold).
          todos.put({
            id: 'food-and-water-f1',
            moduleKey: 'food-and-water',
            todoId: 'f1',
            completed: false,
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
        JSON.stringify({ modules: { 'knowing-community': true }, updatedAt: new Date().toISOString() }),
      );
    });
  }

  test('a single self-duplicating child is a flat row, and a 0-item module never expands', async ({
    page,
  }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    await seedProgressWork(page);
    await page.reload({ waitUntil: 'load' });

    const progress = page.locator('section[aria-label="Your progress"]');
    await expect(progress).toBeVisible({ timeout: 20_000 });

    // The child that duplicates its parent name folds into the parent: the name
    // appears once, with no drill-down chevron.
    await expect(progress.getByText('Knowing Your Community', { exact: true })).toHaveCount(1);
    await expect(progress.getByRole('button', { name: /Knowing Your Community/ })).toHaveCount(0);

    // A glanced-at 0-item child does not make its parent expandable.
    await expect(
      progress.getByRole('button', { name: /Expand Emergency Preparedness/ }),
    ).toHaveCount(0);
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

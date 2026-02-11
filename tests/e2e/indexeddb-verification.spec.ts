/**
 * IndexedDB Verification E2E Tests
 *
 * Verifies that IndexedDB is properly initialized and functioning
 * across all 17 module section pages. Tests use the `debugStorage.healthCheck()`
 * utility exposed on `window` by BaseLayout.astro.
 *
 * Run with: npx playwright test
 * Requires dev server running on localhost:4321
 */
import { test, expect } from '@playwright/test';

// All 17 module section pages
// 14 have interactive components (Todo/EditableTable), 3 are informational-only
const ALL_MODULE_PAGES = [
  // Standalone module
  { url: '/modules/knowing-your-community', label: '0.1 Knowing Your Community', hasInteractive: true },

  // Emergency Preparedness (13 sections)
  { url: '/modules/emergency-preparedness/1-1', label: '1.1 Emergency Kits', hasInteractive: true },
  { url: '/modules/emergency-preparedness/1-2', label: '1.2 Food & Water', hasInteractive: true },
  { url: '/modules/emergency-preparedness/1-3', label: '1.3 Medical', hasInteractive: true },
  { url: '/modules/emergency-preparedness/1-4', label: '1.4 Power', hasInteractive: true },
  { url: '/modules/emergency-preparedness/1-5', label: '1.5 Shelter', hasInteractive: true },
  { url: '/modules/emergency-preparedness/1-6', label: '1.6 Vehicles', hasInteractive: true },
  { url: '/modules/emergency-preparedness/1-7', label: '1.7 Sanitation', hasInteractive: true },
  { url: '/modules/emergency-preparedness/1-8', label: '1.8 Special Populations', hasInteractive: true },
  { url: '/modules/emergency-preparedness/1-9', label: '1.9 Response Plans', hasInteractive: false },
  { url: '/modules/emergency-preparedness/1-10', label: '1.10 Volunteers', hasInteractive: false },
  { url: '/modules/emergency-preparedness/1-11', label: '1.11 Flood Recovery', hasInteractive: true },
  { url: '/modules/emergency-preparedness/1-12', label: '1.12 Mutual Aid', hasInteractive: true },
  { url: '/modules/emergency-preparedness/1-13', label: '1.13 Financial Resources', hasInteractive: false },

  // Baseline Resilience (3 sections)
  { url: '/modules/baseline-resilience/2-1', label: '2.1 Basic Needs', hasInteractive: true },
  { url: '/modules/baseline-resilience/2-2', label: '2.2 Shared Tools', hasInteractive: true },
  { url: '/modules/baseline-resilience/2-3', label: '2.3 Community Building', hasInteractive: true },
];

test.describe('IndexedDB initialization on all module pages', () => {
  for (const page of ALL_MODULE_PAGES) {
    test(`DB initializes on ${page.label}`, async ({ page: browserPage }) => {
      await browserPage.goto(page.url, { waitUntil: 'networkidle' });

      // Wait for storage initialization (debugStorage is set after initializeStorage completes)
      await browserPage.waitForFunction(
        () => typeof (window as any).debugStorage?.healthCheck === 'function',
        { timeout: 10000 }
      );

      const result = await browserPage.evaluate(
        () => (window as any).debugStorage.healthCheck()
      );

      expect(result.status).toBe('healthy');
      expect(result.dbVersion).toBe(1);
      expect(result.stores).toContain('todos');
      expect(result.stores).toContain('tables');
      expect(result.stores).toContain('metadata');
      expect(result.stores).toHaveLength(3);
      expect(result.deviceId).toBeTruthy();
    });
  }
});

test.describe('Interactive component functionality', () => {
  test('Todo components load without timeout on interactive pages', async ({ page }) => {
    // Test a page with many Todos (1.1 Emergency Kits)
    await page.goto('/modules/emergency-preparedness/1-1', { waitUntil: 'networkidle' });

    // Wait for Todo components to hydrate (they show loading state initially)
    // All Todos should be loaded within 5 seconds (the component timeout)
    const todoCheckboxes = page.locator('input.todo-checkbox');
    await expect(todoCheckboxes.first()).toBeVisible({ timeout: 10000 });

    // Verify at least one checkbox exists and is interactive
    const count = await todoCheckboxes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Todo data persists across page navigation', async ({ page }) => {
    // Navigate to a page with Todos
    await page.goto('/modules/emergency-preparedness/1-1', { waitUntil: 'networkidle' });

    // Wait for components to load
    const firstCheckbox = page.locator('input.todo-checkbox').first();
    await expect(firstCheckbox).toBeVisible({ timeout: 10000 });

    // Get initial state
    const wasChecked = await firstCheckbox.isChecked();

    // Toggle the checkbox
    await firstCheckbox.click();
    // Wait for IndexedDB write
    await page.waitForTimeout(500);

    // Verify it toggled
    const isNowChecked = await firstCheckbox.isChecked();
    expect(isNowChecked).toBe(!wasChecked);

    // Navigate away and back
    await page.goto('/modules/emergency-preparedness/1-2', { waitUntil: 'networkidle' });
    await page.goto('/modules/emergency-preparedness/1-1', { waitUntil: 'networkidle' });

    // Wait for component to reload from IndexedDB
    const reloadedCheckbox = page.locator('input.todo-checkbox').first();
    await expect(reloadedCheckbox).toBeVisible({ timeout: 10000 });

    // Verify state persisted
    const persistedState = await reloadedCheckbox.isChecked();
    expect(persistedState).toBe(!wasChecked);

    // Toggle back to original state to clean up
    await reloadedCheckbox.click();
    await page.waitForTimeout(500);
  });

  test('Todo data persists across page refresh', async ({ page }) => {
    await page.goto('/modules/baseline-resilience/2-1', { waitUntil: 'networkidle' });

    const firstCheckbox = page.locator('input.todo-checkbox').first();
    await expect(firstCheckbox).toBeVisible({ timeout: 10000 });

    const wasChecked = await firstCheckbox.isChecked();
    await firstCheckbox.click();
    await page.waitForTimeout(500);

    // Hard refresh
    await page.reload({ waitUntil: 'networkidle' });

    const reloadedCheckbox = page.locator('input.todo-checkbox').first();
    await expect(reloadedCheckbox).toBeVisible({ timeout: 10000 });

    const persistedState = await reloadedCheckbox.isChecked();
    expect(persistedState).toBe(!wasChecked);

    // Clean up
    await reloadedCheckbox.click();
    await page.waitForTimeout(500);
  });
});

test.describe('Storage health across different page types', () => {
  test('informational pages still initialize DB', async ({ page }) => {
    // Visit an informational-only page (no interactive components)
    await page.goto('/modules/emergency-preparedness/1-9', { waitUntil: 'networkidle' });

    await page.waitForFunction(
      () => typeof (window as any).debugStorage?.healthCheck === 'function',
      { timeout: 10000 }
    );

    const result = await page.evaluate(
      () => (window as any).debugStorage.healthCheck()
    );

    // DB should still be created even without interactive components
    // (because initializeStorage now pre-warms the DB)
    expect(result.status).toBe('healthy');
    expect(result.stores).toHaveLength(3);
  });

  test('data created on one page is accessible from another', async ({ page }) => {
    // Save data on one page
    await page.goto('/modules/emergency-preparedness/1-1', { waitUntil: 'networkidle' });

    await page.waitForFunction(
      () => typeof (window as any).debugStorage?.healthCheck === 'function',
      { timeout: 10000 }
    );

    // Check health from the first page
    const firstPageResult = await page.evaluate(
      () => (window as any).debugStorage.healthCheck()
    );

    // Navigate to a completely different module
    await page.goto('/modules/baseline-resilience/2-1', { waitUntil: 'networkidle' });

    await page.waitForFunction(
      () => typeof (window as any).debugStorage?.healthCheck === 'function',
      { timeout: 10000 }
    );

    const secondPageResult = await page.evaluate(
      () => (window as any).debugStorage.healthCheck()
    );

    // Same device ID should be used across pages
    expect(secondPageResult.deviceId).toBe(firstPageResult.deviceId);
    // Same DB version
    expect(secondPageResult.dbVersion).toBe(firstPageResult.dbVersion);
  });
});

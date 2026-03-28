/**
 * Module Hydration E2E Tests
 *
 * Verifies interactive components actually hydrate and respond to user input.
 * Unlike render-verification (which only checks DOM presence), these tests
 * click, toggle, and navigate to confirm React islands are functional.
 *
 * Tests:
 *   1. Todo checkbox interactivity (click to check, click to uncheck)
 *   2. ExternalLink confirmation modal (opens, closes, has correct buttons)
 *   3. Cross-module navigation (1.13 footer links to baseline-resilience/2-1)
 *
 * Run with: npx playwright test module-hydration
 * Requires dev server running on localhost:4321
 */
import { test, expect } from '@playwright/test';

test.describe('Todo checkbox interactivity', () => {
  test('1.2 Food and water — checkbox toggles checked state', async ({ page }) => {
    await page.goto('/modules/emergency-preparedness/1-2', { waitUntil: 'domcontentloaded' });

    // Wait for loading skeleton to clear — first checkbox becomes enabled
    const checkbox = page.locator('input.todo-checkbox').first();
    await expect(checkbox).toBeEnabled({ timeout: 10000 });

    const initialChecked = await checkbox.isChecked();

    // Click to toggle
    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: !initialChecked, timeout: 5000 });

    // Click again to restore original state
    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: initialChecked, timeout: 5000 });
  });

  test('2.1 Basic needs — checkbox toggles checked state', async ({ page }) => {
    await page.goto('/modules/baseline-resilience/2-1', { waitUntil: 'domcontentloaded' });

    const checkbox = page.locator('input.todo-checkbox').first();
    await expect(checkbox).toBeEnabled({ timeout: 10000 });

    const initialChecked = await checkbox.isChecked();

    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: !initialChecked, timeout: 5000 });

    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: initialChecked, timeout: 5000 });
  });

  test('1.9 Community emergency response — checkbox toggles checked state', async ({ page }) => {
    await page.goto('/modules/emergency-preparedness/1-9', { waitUntil: 'domcontentloaded' });

    const checkbox = page.locator('input.todo-checkbox').first();
    await expect(checkbox).toBeEnabled({ timeout: 10000 });

    const initialChecked = await checkbox.isChecked();

    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: !initialChecked, timeout: 5000 });

    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: initialChecked, timeout: 5000 });
  });

  test('1.10 Volunteer management — checkbox toggles checked state', async ({ page }) => {
    await page.goto('/modules/emergency-preparedness/1-10', { waitUntil: 'domcontentloaded' });

    const checkbox = page.locator('input.todo-checkbox').first();
    await expect(checkbox).toBeEnabled({ timeout: 10000 });

    const initialChecked = await checkbox.isChecked();

    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: !initialChecked, timeout: 5000 });

    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: initialChecked, timeout: 5000 });
  });
});

test.describe('ExternalLink confirmation modal', () => {
  test('1.2 — clicking external link opens confirmation modal', async ({ page }) => {
    await page.goto('/modules/emergency-preparedness/1-2', { waitUntil: 'domcontentloaded' });

    // Wait for ExternalLink to hydrate (becomes an .external-link element)
    const externalLink = page.locator('a.external-link').first();
    await expect(externalLink).toBeVisible({ timeout: 10000 });

    await externalLink.click();

    // Modal should appear
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Modal contains the expected action buttons
    const openButton = page.locator('button', { hasText: /open/i });
    const cancelButton = page.locator('button', { hasText: /cancel/i });
    await expect(openButton).toBeVisible();
    await expect(cancelButton).toBeVisible();
  });

  test('1.2 — cancel button closes modal', async ({ page }) => {
    await page.goto('/modules/emergency-preparedness/1-2', { waitUntil: 'domcontentloaded' });

    const externalLink = page.locator('a.external-link').first();
    await expect(externalLink).toBeVisible({ timeout: 10000 });

    await externalLink.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const cancelButton = page.locator('button', { hasText: /cancel/i });
    await cancelButton.click();

    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Cross-module navigation', () => {
  test('1.13 footer — next section link points to baseline-resilience/2-1', async ({ page }) => {
    await page.goto('/modules/emergency-preparedness/1-13', { waitUntil: 'domcontentloaded' });

    // Find the next-section nav link in the footer area
    const nextLink = page.locator('a[href*="baseline-resilience/2-1"]');
    await expect(nextLink).toBeAttached({ timeout: 5000 });
    await expect(nextLink).toBeVisible();
  });

  test('1.13 — clicking next section navigates to 2.1', async ({ page }) => {
    await page.goto('/modules/emergency-preparedness/1-13', { waitUntil: 'domcontentloaded' });

    const nextLink = page.locator('a[href*="baseline-resilience/2-1"]');
    await expect(nextLink).toBeVisible({ timeout: 5000 });

    await nextLink.click();
    await page.waitForURL('**/baseline-resilience/2-1', { timeout: 10000 });

    expect(page.url()).toContain('baseline-resilience/2-1');
  });
});

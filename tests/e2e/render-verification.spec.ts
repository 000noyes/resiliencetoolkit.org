/**
 * Render Verification E2E Tests
 *
 * Verifies every module section page loads correctly from MDX content
 * collections. Each test visits the URL, checks the heading renders,
 * and verifies interactive components (Todo/EditableTable) are present
 * in the DOM for pages that should have them.
 *
 * Run with: npx playwright test render-verification
 * Requires dev server running on localhost:4321
 */
import { test, expect } from '@playwright/test';

const SECTION_PAGES = [
  // Knowing Your Community
  { url: '/modules/knowing-your-community/0-1', title: 'Knowing Your Community', interactive: 'editable-table' },

  // Emergency Preparedness
  { url: '/modules/emergency-preparedness/1-1', title: 'Emergency preparedness kits', interactive: 'todo' },
  { url: '/modules/emergency-preparedness/1-2', title: 'Food and water', interactive: 'todo' },
  { url: '/modules/emergency-preparedness/1-3', title: 'First aid and medical', interactive: 'todo' },
  { url: '/modules/emergency-preparedness/1-4', title: 'Power supply', interactive: 'todo' },
  { url: '/modules/emergency-preparedness/1-5', title: 'Warming / Cooling / Emergency Shelter', interactive: 'todo' },
  { url: '/modules/emergency-preparedness/1-6', title: 'Vehicles and Equipment', interactive: 'todo' },
  { url: '/modules/emergency-preparedness/1-7', title: 'Sanitation and Hygiene', interactive: 'todo' },
  { url: '/modules/emergency-preparedness/1-8', title: 'Populations with Specific Needs', interactive: 'todo' },
  { url: '/modules/emergency-preparedness/1-9', title: 'Community Emergency Response Plans', interactive: 'none' },
  { url: '/modules/emergency-preparedness/1-10', title: 'Volunteer Management', interactive: 'none' },
  { url: '/modules/emergency-preparedness/1-11', title: 'Flood Recovery Supplies and Work', interactive: 'todo' },
  { url: '/modules/emergency-preparedness/1-12', title: 'Mutual Aid / Neighbor to Neighbor', interactive: 'todo' },
  { url: '/modules/emergency-preparedness/1-13', title: 'Financial Resources', interactive: 'none' },

  // Baseline Resilience
  { url: '/modules/baseline-resilience/2-1', title: 'Basic Needs', interactive: 'todo' },
  { url: '/modules/baseline-resilience/2-2', title: 'Shared Tools', interactive: 'todo' },
  { url: '/modules/baseline-resilience/2-3', title: 'Community Building', interactive: 'todo' },
];

test.describe('MDX render verification — all 17 section pages', () => {
  for (const section of SECTION_PAGES) {
    test(`${section.title} renders correctly`, async ({ page }) => {
      const response = await page.goto(section.url, { waitUntil: 'domcontentloaded' });

      // Page loads without error
      expect(response?.status()).toBe(200);

      // Section title appears in the page heading
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 5000 });
      const headingText = await heading.textContent();
      expect(headingText).toContain(section.title);

      // Interactive components are present in the DOM
      if (section.interactive === 'todo') {
        const todos = page.locator('[data-todo], input.todo-checkbox');
        await expect(todos.first()).toBeAttached({ timeout: 10000 });
      } else if (section.interactive === 'editable-table') {
        const tables = page.locator('[data-editable-table], table');
        await expect(tables.first()).toBeAttached({ timeout: 10000 });
      }

      // Breadcrumb navigation is present
      const breadcrumb = page.locator('nav[aria-label="Breadcrumb"], .breadcrumb, a[href*="/modules/"]');
      await expect(breadcrumb.first()).toBeAttached({ timeout: 5000 });
    });
  }
});

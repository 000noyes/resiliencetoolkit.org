import { test, expect, type Page } from '@playwright/test';

/**
 * The workshop preview at desktop widths: the Make Comments tenant is a
 * rail panel in the 3C grammar (board 6), open at load, one tenant at a
 * time; the rail foot owns compose (DR20) with the Click hint on a fine
 * pointer (S35); pins anchor at the block edge (DR18); a pin click opens
 * its thread in the foot; the tenant states hold (DR19).
 */

const ROUND = 'r1-e2etesttoken0123456789';
const URL_PATH = `/rounds/${ROUND}/`;

interface MockNote {
  draft_uuid: string;
  pin_no: number | null;
  target_id: string | null;
  fx: number | null;
  fy: number | null;
  name: string | null;
  text: string;
  created_at: string;
}

interface MockState {
  status: 'open' | 'closed';
  notes: MockNote[];
  failPosts: boolean;
  postDelayMs: number;
  postCount: number;
  current_round_id?: string;
}

function threadsOf(state: MockState) {
  const threads: Array<{
    pin_no: number;
    target_id: string | null;
    fx: number | null;
    fy: number | null;
    notes: Array<{ name: string | null; text: string; created_at: string }>;
  }> = [];
  const whole: Array<{ name: string | null; text: string; created_at: string }> = [];
  for (const note of state.notes) {
    const view = { name: note.name, text: note.text, created_at: note.created_at };
    if (note.pin_no === null) {
      whole.push(view);
      continue;
    }
    let thread = threads.find((t) => t.pin_no === note.pin_no);
    if (!thread) {
      thread = { pin_no: note.pin_no, target_id: note.target_id, fx: note.fx, fy: note.fy, notes: [] };
      threads.push(thread);
    }
    thread.notes.push(view);
  }
  return { threads, whole };
}

async function mockApi(page: Page, overrides: Partial<MockState> = {}): Promise<MockState> {
  const state: MockState = {
    status: 'open',
    notes: [],
    failPosts: false,
    postDelayMs: 0,
    postCount: 0,
    ...overrides,
  };

  await page.route('**/api/rounds/**', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      const { threads, whole } = threadsOf(state);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          status: state.status,
          threads,
          whole_page: whole,
          ...(state.current_round_id ? { current_round_id: state.current_round_id } : {}),
        }),
      });
      return;
    }

    state.postCount += 1;
    if (state.postDelayMs) await new Promise((r) => setTimeout(r, state.postDelayMs));
    if (state.failPosts) {
      await route.fulfill({
        status: 500,
        contentType: 'text/html',
        body: '<!DOCTYPE html><html><body>Error 1027</body></html>',
      });
      return;
    }

    const body = request.postDataJSON() as Record<string, unknown>;
    const existing = state.notes.find((n) => n.draft_uuid === body.draft_uuid);
    if (existing) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, pin_no: existing.pin_no }),
      });
      return;
    }

    let pinNo: number | null = null;
    if (typeof body.pin_no === 'number') {
      pinNo = body.pin_no;
    } else if (typeof body.target_id === 'string') {
      pinNo = Math.max(0, ...state.notes.map((n) => n.pin_no ?? 0)) + 1;
    }
    state.notes.push({
      draft_uuid: String(body.draft_uuid),
      pin_no: pinNo,
      target_id: typeof body.target_id === 'string' ? body.target_id : null,
      fx: typeof body.fx === 'number' ? body.fx : null,
      fy: typeof body.fy === 'number' ? body.fy : null,
      name: typeof body.name === 'string' ? body.name : null,
      text: String(body.text),
      created_at: new Date().toISOString(),
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, pin_no: pinNo }),
    });
  });

  return state;
}

const BLOCK = '1-2--water-supply-and-storage--r2';
const panel = (page: Page) => page.locator('#rail-panel-make-comments');

test('the tenant opens at load in the rail; one tenant at a time; closing returns to On this page', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto(URL_PATH);
  await expect(page.locator('.reading-grid')).toHaveAttribute('data-rail', 'make-comments');
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).locator('.reading-rail__panel-title')).toHaveText('Make Comments');
  await expect(page.locator('[data-rail-btn="make-comments"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(panel(page).getByRole('button', { name: 'Leave a note' })).toBeVisible();

  await page.click('[data-rail-btn="footnotes"]');
  await expect(panel(page)).toBeHidden();
  await expect(page.locator('#rail-panel-footnotes')).toBeVisible();
  await page.click('[data-rail-btn="make-comments"]');
  await expect(panel(page)).toBeVisible();
  await page.click('[data-rail-close="make-comments"]');
  await expect(page.locator('#rail-panel-on-this-page')).toBeVisible();
  // No sheet chrome at desktop widths
  await expect(page.locator('.reading-bar')).toBeHidden();
});

test('Leave a note: the foot carries the Click hint, a block click opens compose, Post places the pin at the block edge', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto(URL_PATH);
  await panel(page).getByRole('button', { name: 'Leave a note' }).click();
  await expect(panel(page)).toContainText('Click where the note goes.');
  await expect(panel(page).getByRole('button', { name: 'Cancel' })).toBeVisible();

  const block = page.locator(`[data-annot="${BLOCK}"]`);
  await block.click({ position: { x: 80, y: 30 } });
  await expect(panel(page).getByText('New note')).toBeVisible();
  await expect(page.locator('#annot-textarea')).toBeFocused();
  await page.locator('#annot-textarea').fill('Rotation cadence could name the season.');
  await panel(page).getByRole('button', { name: 'Post', exact: true }).click();

  const pin = block.locator('[data-annot-pin="1"]');
  await expect(pin).toBeVisible();
  // At the block's edge, inside its last cell (DR18)
  const pinBox = (await pin.boundingBox())!;
  const cellBox = (await block.locator('td').last().boundingBox())!;
  expect(pinBox.x + pinBox.width).toBeLessThanOrEqual(cellBox.x + cellBox.width + 1);
  expect(pinBox.x + pinBox.width).toBeGreaterThan(cellBox.x + cellBox.width - 60);
  await expect(panel(page)).toContainText('Rotation cadence could name the season.');
  await expect(page.locator('#annot-textarea')).toHaveCount(0);
  expect(state.notes[0]).toMatchObject({ target_id: BLOCK, fx: 1, fy: 0.5 });
  // The page never scrolled sideways
  expect(await page.evaluate(() => document.documentElement.scrollLeft)).toBe(0);
});

test('a pin click opens its thread in the foot and marks its card', async ({ page }) => {
  await mockApi(page, {
    notes: [
      { draft_uuid: 's1', pin_no: 1, target_id: BLOCK, fx: 1, fy: 0.5, name: 'Sample member', text: 'First.', created_at: new Date().toISOString() },
      { draft_uuid: 's2', pin_no: 2, target_id: '1-2--community-meals--r1', fx: 1, fy: 0.5, name: null, text: 'Second.', created_at: new Date().toISOString() },
    ],
  });
  await page.goto(URL_PATH);
  await expect(page.locator('[data-annot-pin]')).toHaveCount(2);
  await page.locator('[data-annot-pin="2"]').click();
  await expect(panel(page).getByText('Pin 2')).toBeVisible();
  await expect(panel(page).locator('.comments-card[aria-current="true"]')).toContainText('Second.');
  await expect(page.locator('#annot-textarea')).toBeFocused();
  await panel(page).getByRole('button', { name: 'Close' }).last().click();
  await expect(page.locator('#annot-textarea')).toHaveCount(0);
  await expect(panel(page).locator('.comments-card[aria-current="true"]')).toHaveCount(0);
});

test('Escape leaves placing mode; the whole-page path composes without a pin', async ({ page }) => {
  await mockApi(page);
  await page.goto(URL_PATH);
  await panel(page).getByRole('button', { name: 'Leave a note' }).click();
  await expect(panel(page)).toContainText('Click where the note goes.');
  await page.keyboard.press('Escape');
  await expect(panel(page).getByRole('button', { name: 'Leave a note' })).toBeVisible();
  await panel(page).getByRole('button', { name: 'Note on the whole page.' }).click();
  await expect(panel(page).getByText('The whole page')).toBeVisible();
  await page.locator('#annot-textarea').fill('Reads well.');
  await panel(page).getByRole('button', { name: 'Post', exact: true }).click();
  await expect(panel(page).locator('[data-comments-whole]')).toContainText('Reads well.');
  await expect(page.locator('[data-annot-pin]')).toHaveCount(0);
});

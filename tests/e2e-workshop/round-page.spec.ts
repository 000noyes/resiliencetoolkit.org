import { test, expect, type Page } from '@playwright/test';

/**
 * Round one on the frozen surface, phone viewport (the critical paths from
 * the round-one test plan): chrome, pin place -> post -> persist, unnamed
 * notes as Someone, the DD7 keep/retry/copy failure state with exactly-once
 * retry, the double-tap guard, the closed state, the whole-page path, the
 * API-down state, sheet accessibility, and the inert rendering of
 * attacker-shaped note text (text nodes only, nothing executes).
 *
 * The API is mocked per test with a stateful in-test store keyed by
 * draft_uuid, mirroring the real function's idempotency contract.
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

async function placePinAndOpenSheet(page: Page) {
  await page.getByRole('button', { name: 'Leave a note' }).click();
  await expect(page.getByText('Tap the spot you mean.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave a note' })).toBeHidden();
  await page.locator('[data-annot="hero"]').click({ position: { x: 120, y: 80 } });
  await expect(page.getByRole('dialog', { name: 'New note' })).toBeVisible();
}

test('round chrome: strip, header, destination line, inert two-door panel, noindex meta', async ({ page }) => {
  await mockApi(page);
  await page.goto(URL_PATH);

  await expect(page.getByText('This is the workshop copy of the toolkit')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Round 1' })).toBeVisible();
  await expect(page.getByText("Notes from this round go to the group's next meeting.")).toBeVisible();

  await expect(page.getByText('Write to the people who tend this toolkit.')).toBeVisible();
  await expect(page.getByText('Help keep the hubs and this toolkit going.')).toBeVisible();
  await expect(page.getByText('Notes on this page')).toHaveCount(0);

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('place a pin, post, pin appears in place, reload persists', async ({ page }) => {
  await mockApi(page);
  await page.goto(URL_PATH);

  await placePinAndOpenSheet(page);
  await page.locator('#annot-textarea').fill('The hero line reads clearly.');
  await page.getByRole('button', { name: 'Post', exact: true }).click();

  const pin = page.getByRole('button', { name: 'Note 1' });
  await expect(pin).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Note 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Note 1' }).click();
  await expect(page.getByRole('dialog').getByText('The hero line reads clearly.')).toBeVisible();
});

test('unnamed note renders as Someone with a date', async ({ page }) => {
  await mockApi(page);
  await page.goto(URL_PATH);

  await placePinAndOpenSheet(page);
  await page.locator('#annot-textarea').fill('Unnamed thought.');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await page.getByRole('button', { name: 'Note 1' }).click();
  await expect(page.getByRole('dialog').getByText(/Someone ·/)).toBeVisible();
});

test('failure keeps the text, copy chain works, retry lands exactly once', async ({ page }) => {
  const state = await mockApi(page, { failPosts: true });
  await page.goto(URL_PATH);

  await placePinAndOpenSheet(page);
  await page.locator('#annot-textarea').fill('A note that must survive.');
  await page.getByRole('button', { name: 'Post', exact: true }).click();

  await expect(page.getByText('Your note did not save.')).toBeVisible();
  await expect(page.locator('#annot-textarea')).toHaveValue('A note that must survive.');

  await page.getByRole('button', { name: 'Copy your note' }).click();
  const selection = await page.evaluate(() => {
    const el = document.getElementById('annot-textarea') as HTMLTextAreaElement;
    return el.value.slice(el.selectionStart, el.selectionEnd);
  });
  expect(selection).toBe('A note that must survive.');

  state.failPosts = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Note 1' })).toBeVisible();
  expect(state.notes).toHaveLength(1);
});

test('double tap on Post creates exactly one note', async ({ page }) => {
  const state = await mockApi(page, { postDelayMs: 400 });
  await page.goto(URL_PATH);

  await placePinAndOpenSheet(page);
  await page.locator('#annot-textarea').fill('Once only.');
  const post = page.getByRole('button', { name: /Post|Posting/ });
  await post.click();
  await post.click({ force: true }).catch(() => {});
  await expect(page.getByRole('button', { name: 'Note 1' })).toBeVisible();
  expect(state.notes).toHaveLength(1);
  expect(state.postCount).toBe(1);
});

test('closed round: banner with successor link, no Leave a note, pins readable', async ({ page }) => {
  await mockApi(page, {
    status: 'closed',
    current_round_id: 'r2-nexttokenabcdef0123456789',
    notes: [
      {
        draft_uuid: 'seed-1',
        pin_no: 1,
        target_id: 'hero',
        fx: 0.3,
        fy: 0.3,
        name: 'Lena',
        text: 'From the closed round.',
        created_at: new Date().toISOString(),
      },
    ],
  });
  await page.goto(URL_PATH);

  await expect(page.getByText('Round 1 is closed. Reading is open; new notes go to the current round.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to the current round' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave a note' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Note 1' }).click();
  await expect(page.getByRole('dialog').getByText('From the closed round.')).toBeVisible();
  await expect(page.locator('#annot-textarea')).toHaveCount(0);
});

test('attacker-shaped note text renders inert as literal text', async ({ page }) => {
  const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
  await mockApi(page, {
    notes: [
      {
        draft_uuid: 'seed-xss',
        pin_no: 1,
        target_id: 'hero',
        fx: 0.4,
        fy: 0.4,
        name: '<b>bold name</b>',
        text: payload,
        created_at: new Date().toISOString(),
      },
    ],
  });
  await page.goto(URL_PATH);

  await page.getByRole('button', { name: 'Note 1' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText(payload, { exact: false })).toBeVisible();
  await expect(sheet.getByText('<b>bold name</b>', { exact: false })).toBeVisible();
  expect(await sheet.locator('img').count()).toBe(0);
  expect(await sheet.locator('b').count()).toBe(0);
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
});

test('whole-page note skips placement and lands in the notes list, no dot', async ({ page }) => {
  await mockApi(page);
  await page.goto(URL_PATH);

  await page.getByRole('button', { name: 'Note on the whole page.' }).click();
  await expect(page.getByRole('dialog', { name: 'The whole page' })).toBeVisible();
  await page.locator('#annot-textarea').fill('The page overall feels calm.');
  await page.getByRole('button', { name: 'Post', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Notes from this round' })).toBeVisible();
  await expect(page.getByText('The page overall feels calm.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Note \d+$/ })).toHaveCount(0);
});

test('sheet accessibility: focus lands inside, Esc closes, scrim closes', async ({ page }) => {
  await mockApi(page);
  await page.goto(URL_PATH);

  await placePinAndOpenSheet(page);
  const within = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return !!dialog && dialog.contains(document.activeElement);
  });
  expect(within).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await placePinAndOpenSheet(page);
  await page.locator('.fixed.inset-0.z-40').click({ position: { x: 10, y: 10 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('API down: page renders, notes marked unavailable, no write affordance', async ({ page }) => {
  await page.route('**/api/rounds/**', (route) => route.abort());
  await page.goto(URL_PATH);

  await expect(page.getByText('Notes are unavailable right now. The page is still readable.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Build a Community Resilience Hub' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave a note' })).toHaveCount(0);
});

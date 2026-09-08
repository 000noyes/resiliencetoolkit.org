import { test, expect, type Page } from '@playwright/test';

/**
 * The workshop preview on a phone (the round-one critical paths carried
 * into the rail grammar): chrome, the Make Comments door and sheet, place
 * a pin (Leave a note, the bar's Tap hint, tap a block) -> post -> the pin
 * at the block's edge -> persist, selection-first compose, unnamed notes
 * as Someone, the DD7 keep/retry/copy failure state with exactly-once
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

const BLOCK = '1-2--water-supply-and-storage--r2';
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Make Comments' });
const openSheet = async (page: Page) => {
  await page.locator('[data-sheet-open="make-comments"]').tap();
  await expect(sheet(page)).toBeVisible();
};

/** Leave a note from the sheet: the sheet closes, the bar carries the hint, a tap on a block opens compose */
async function placePin(page: Page) {
  await openSheet(page);
  await page.getByRole('button', { name: 'Leave a note' }).tap();
  await expect(sheet(page)).toBeHidden();
  await expect(page.locator('.reading-bar')).toContainText('Tap where the note goes.');
  await expect(page.locator('[data-sheet-open="contents"]')).toBeHidden();
  await page.locator(`[data-annot="${BLOCK}"]`).tap({ position: { x: 60, y: 24 } });
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByText('New note')).toBeVisible();
  await expect(page.locator('.reading-bar')).not.toContainText('Tap where the note goes.');
}

test('round chrome: one strip, the round line, three bar doors, no index body, noindex meta, the corner door works', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto(URL_PATH);

  // DD17.1: the workshop strip is the single band; the contact banner never
  // mounts on workshop pages.
  await expect(page.getByText('This is the workshop copy of the toolkit')).toBeVisible();
  await expect(page.getByText('Contact us for support')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Round 1' })).toBeVisible();
  await expect(page.getByText('read together at the next meeting')).toBeVisible();
  // The reviewed chapter is the page itself
  await expect(page.getByRole('heading', { name: '1.2 Food and water' })).toBeVisible();
  await expect(page.locator('article[data-pagefind-body]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');

  // ER10: three labeled doors in the reserved bar
  const bar = page.locator('.reading-bar');
  await expect(bar.getByRole('button', { name: 'Toolkit Contents' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Footnotes' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Make Comments' })).toBeVisible();

  // DD17.3: the corner panel arrives closed, exactly as production behaves
  const panelTrigger = page.getByRole('button', { name: 'Questions and support' });
  await expect(panelTrigger).toBeVisible();
  await panelTrigger.click();
  await expect(page.getByText('Write to the people who tend this toolkit.')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('the sheet shows the empty round; place a pin, post, the pin sits at the block edge, reload persists', async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto(URL_PATH);
  await openSheet(page);
  await expect(
    sheet(page).getByText("No notes yet this round. Notes from this round go to the group's next meeting.")
  ).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Close' }).tap();

  await placePin(page);
  await page.locator('#annot-textarea').fill('A first note on water storage.');
  await page.getByRole('button', { name: 'Post', exact: true }).tap();

  // The pin appears inside the block, the card in the feed, compose closes
  const pin = page.locator(`[data-annot="${BLOCK}"] [data-annot-pin="1"]`);
  await expect(pin).toBeVisible();
  await expect(sheet(page)).toContainText('A first note on water storage.');
  await expect(page.locator('#annot-textarea')).toHaveCount(0);
  expect(state.notes).toHaveLength(1);
  expect(state.notes[0]).toMatchObject({ target_id: BLOCK, fx: 1, fy: 0.5, pin_no: 1 });

  await page.reload();
  await expect(page.locator(`[data-annot="${BLOCK}"] [data-annot-pin="1"]`)).toBeVisible();
});

test('selecting text in a block opens compose against that block, quoting the selection', async ({ page }) => {
  await mockApi(page);
  await page.goto(URL_PATH);
  // Selection compose arms once the round has loaded
  await expect(page.locator('[data-comments-feed]')).toContainText('No notes yet this round.');
  await page.evaluate((id) => {
    const block = document.querySelector(`[data-annot="${id}"]`)!;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let node: Text | null = null;
    while (walker.nextNode()) {
      const t = walker.currentNode as Text;
      if (t.textContent && t.textContent.trim().length > 20) {
        node = t;
        break;
      }
    }
    const range = document.createRange();
    range.setStart(node!, 0);
    range.setEnd(node!, 18);
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new Event('touchend', { bubbles: true }));
  }, BLOCK);
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByText('New note')).toBeVisible();
  await expect(sheet(page).locator('.comments-foot__quote')).toBeVisible();
  await expect(page.locator('#annot-textarea')).toBeFocused();
});

test('unnamed note renders as Someone with a date', async ({ page }) => {
  await mockApi(page);
  await page.goto(URL_PATH);
  await placePin(page);
  await page.locator('#annot-textarea').fill('No name given.');
  await page.getByRole('button', { name: 'Post', exact: true }).tap();
  await expect(sheet(page).locator('.comments-card__who').first()).toHaveText(/Someone · \w{3} \d{1,2}$/);
});

test('failure keeps the text, copy chain works, retry lands exactly once', async ({ page }) => {
  const state = await mockApi(page, { failPosts: true });
  await page.goto(URL_PATH);

  await placePin(page);
  await page.locator('#annot-textarea').fill('A note that must survive.');
  await page.getByRole('button', { name: 'Post', exact: true }).tap();

  await expect(page.getByText('Your note did not save.')).toBeVisible();
  await expect(page.locator('#annot-textarea')).toHaveValue('A note that must survive.');

  await page.getByRole('button', { name: 'Copy your note' }).tap();
  const selection = await page.evaluate(() => {
    const el = document.getElementById('annot-textarea') as HTMLTextAreaElement;
    return el.value.slice(el.selectionStart, el.selectionEnd);
  });
  expect(selection).toBe('A note that must survive.');

  state.failPosts = false;
  await page.getByRole('button', { name: 'Try again' }).tap();
  await expect(page.locator('[data-annot-pin="1"]')).toBeVisible();
  expect(state.notes).toHaveLength(1);
});

test('double tap on Post creates exactly one note', async ({ page }) => {
  const state = await mockApi(page, { postDelayMs: 400 });
  await page.goto(URL_PATH);

  await placePin(page);
  await page.locator('#annot-textarea').fill('Once only.');
  const post = page.getByRole('button', { name: /Post|Posting/ });
  await post.tap();
  await post.tap({ force: true }).catch(() => {});
  await expect(page.locator('[data-annot-pin="1"]')).toBeVisible();
  expect(state.notes).toHaveLength(1);
  expect(state.postCount).toBe(1);
});

test('closed round: banner with successor link, no Leave a note, pins readable', async ({ page }) => {
  await mockApi(page, {
    status: 'closed',
    current_round_id: 'r2-successortoken0000000000',
    notes: [
      {
        draft_uuid: 'seed-1',
        pin_no: 1,
        target_id: BLOCK,
        fx: 1,
        fy: 0.5,
        name: 'Lena',
        text: 'Kept from round one.',
        created_at: new Date().toISOString(),
      },
    ],
  });
  await page.goto(URL_PATH);

  await expect(page.getByText('Round 1 is closed. Reading is open; new notes go to the current round.').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to the current round' }).first()).toHaveAttribute(
    'href',
    '/rounds/r2-successortoken0000000000/'
  );
  await openSheet(page);
  await expect(page.getByRole('button', { name: 'Leave a note' })).toHaveCount(0);
  await expect(sheet(page)).toContainText('Kept from round one.');
  await sheet(page).getByRole('button', { name: 'Close' }).tap();
  await page.locator('[data-annot-pin="1"]').tap();
  await expect(sheet(page)).toBeVisible();
  await expect(page.locator('#annot-textarea')).toHaveCount(0);
});

test('attacker-shaped note text renders inert as literal text', async ({ page }) => {
  const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
  await mockApi(page, {
    notes: [
      {
        draft_uuid: 'seed-xss',
        pin_no: 1,
        target_id: BLOCK,
        fx: 1,
        fy: 0.5,
        name: '<b>bold name</b>',
        text: payload,
        created_at: new Date().toISOString(),
      },
    ],
  });
  await page.goto(URL_PATH);
  await openSheet(page);
  await expect(sheet(page).getByText(payload, { exact: false })).toBeVisible();
  await expect(sheet(page).getByText('<b>bold name</b>', { exact: false })).toBeVisible();
  expect(await sheet(page).locator('img').count()).toBe(0);
  expect(await sheet(page).locator('b').count()).toBe(0);
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
});

test('whole-page note skips placement and lands in the feed, no pin', async ({ page }) => {
  await mockApi(page);
  await page.goto(URL_PATH);
  await openSheet(page);
  await page.getByRole('button', { name: 'Note on the whole page.' }).tap();
  await expect(sheet(page).getByText('The whole page')).toBeVisible();
  await page.locator('#annot-textarea').fill('The page overall feels calm.');
  await page.getByRole('button', { name: 'Post', exact: true }).tap();
  await expect(sheet(page).locator('[data-comments-whole]')).toContainText('The page overall feels calm.');
  await expect(page.locator('[data-annot-pin]')).toHaveCount(0);
});

test('sheet accessibility: focus lands inside, Esc closes, scrim closes', async ({ page }) => {
  await mockApi(page);
  await page.goto(URL_PATH);
  await openSheet(page);
  const within = await page.evaluate(() => {
    const dialog = document.querySelector('[data-sheet="make-comments"] [role="dialog"]');
    return !!dialog && dialog.contains(document.activeElement);
  });
  expect(within).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeHidden();
  await openSheet(page);
  await page.locator('[data-sheet="make-comments"] .reading-sheet__backdrop').tap({ position: { x: 10, y: 10 } });
  await expect(sheet(page)).toBeHidden();
});

test('API down: page renders, notes marked unavailable, no write affordance', async ({ page }) => {
  await page.route('**/api/rounds/**', (route) => route.abort());
  await page.goto(URL_PATH);
  await expect(page.getByText('Notes are unavailable right now. The page is still readable.').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '1.2 Food and water' })).toBeVisible();
  await openSheet(page);
  await expect(sheet(page)).toContainText('Notes are unavailable right now.');
  await expect(page.getByRole('button', { name: 'Leave a note' })).toHaveCount(0);
});

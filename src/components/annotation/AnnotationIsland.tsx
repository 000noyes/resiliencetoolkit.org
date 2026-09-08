import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { placePins, type ThreadAnchor } from '@/lib/annotation/anchors';
import {
  interpretPostResponse,
  newDraftUuid,
  type PostOutcome,
} from '@/lib/annotation/post-contract';
import { copyNoteText } from '@/lib/annotation/copy-note';

/**
 * The round page's one hydrated island, re-housed into the rail grammar:
 * pins at the block edge over the reviewed chapter, the notes feed and
 * the compose foot inside the Make Comments tenant (the rail panel at
 * 1200px and up, the bar's sheet below), and the add-only write path.
 *
 * Contracts it carries:
 * - DR18: pins anchor at BLOCK level (the per-block data-annot ids) and
 *   render at the block's edge, never inline in cell text; a thread whose
 *   block is gone degrades to the printed list, never a mispositioned dot.
 * - DR19: loading claims nothing, fetch failure names itself, a post in
 *   flight says so, and a failed post keeps the reader's text with the
 *   keep/retry/copy chain (E10: saved means 2xx + JSON ok + pin number).
 * - DR20: the rail foot (the sheet on phones) owns compose, the
 *   whole-page line, and the placing hint; nothing floats over content.
 *   The hint is the device pair: Click on fine pointers, Tap on coarse.
 *   On phones a text selection opens compose against its block, the bar
 *   door being the fallback path.
 * - DD5/DD8/DD9: unnamed notes render as Someone; no reply promises, no
 *   toasts; the whole-page path skips placement.
 * - Note text and names are attacker-writable: rendered exclusively as
 *   text nodes (no HTML injection path).
 */

interface NoteView {
  name: string | null;
  text: string;
  created_at: string;
}

interface ThreadView {
  pin_no: number;
  target_id: string | null;
  fx: number | null;
  fy: number | null;
  notes: NoteView[];
}

type Compose =
  | { kind: 'thread'; pinNo: number }
  | { kind: 'new'; targetId: string; quote: string | null }
  | { kind: 'whole' }
  | null;

// Server data is attacker-writable; a target_id only ever reaches a CSS
// selector after passing the same shape rule the API enforces, so a hostile
// value can neither throw in querySelector nor address another element.
const TARGET_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const DESKTOP = '(min-width: 1200px)';
const COARSE = '(pointer: coarse)';
const QUOTE_MAX = 160;

function displayName(name: string | null): string {
  return name && name.trim() ? name : 'Someone';
}

function displayDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** The reviewed page's blocks: per-block ids inside the article only */
function blockOf(node: Node | null): HTMLElement | null {
  const el = node instanceof Element ? node : node?.parentElement ?? null;
  const block = el?.closest<HTMLElement>('article [data-annot]') ?? null;
  if (!block || block.closest('[data-annot-ui]')) return null;
  return block;
}

/** Where a block's pin renders: a table row hands it to its last cell */
function pinHost(block: HTMLElement): HTMLElement {
  if (block.tagName === 'TR') {
    const cells = block.querySelectorAll<HTMLElement>(':scope > td, :scope > th');
    if (cells.length > 0) return cells[cells.length - 1];
  }
  return block;
}

export default function AnnotationIsland({
  roundId,
  apiBase = '/api/rounds',
}: {
  roundId: string;
  /** The kept notes API's base; activation is configuration, never a rework (ER4) */
  apiBase?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [roundStatus, setRoundStatus] = useState<'open' | 'closed'>('open');
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [wholePage, setWholePage] = useState<NoteView[]>([]);
  const [placing, setPlacing] = useState(false);
  const [compose, setCompose] = useState<Compose>(null);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'inflight' | 'failed'>('idle');
  const isDesktop = useMedia(DESKTOP);
  const coarse = useMedia(COARSE);

  const draftUuid = useRef<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  // The round is one frozen page: a tapped content link would silently leave
  // it, so links open in a new tab and the round stays put underneath.
  useEffect(() => {
    document.querySelectorAll<HTMLAnchorElement>('main a[href]').forEach((a) => {
      if (a.closest('[data-annot-ui]')) return;
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }, []);

  // Load the round: status + threads. Failure leaves the page fully readable
  // with the notes marked unavailable; no fake empty state (DR19).
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/${roundId}/notes`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        if (cancelled || !body || body.ok !== true) throw new Error('bad body');
        setRoundStatus(body.status === 'closed' ? 'closed' : 'open');
        setCurrentRoundId(typeof body.current_round_id === 'string' ? body.current_round_id : null);
        setThreads(Array.isArray(body.threads) ? body.threads : []);
        setWholePage(Array.isArray(body.whole_page) ? body.whole_page : []);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, roundId]);

  // ---- The tenant's home: rail panel on desktop, the bar's sheet below ----
  const mountEl = mounted
    ? document.querySelector<HTMLElement>(
        isDesktop ? '[data-comments-mount="rail"]' : '[data-comments-mount="sheet"]'
      )
    : null;
  const hintEl = mounted ? document.querySelector<HTMLElement>('[data-comments-mount="bar-hint"]') : null;
  const statusSlot = mounted ? document.getElementById('round-status-slot') : null;

  const showTenant = useCallback(() => {
    if (isDesktop) {
      const grid = document.querySelector('.reading-grid');
      if (grid && grid.getAttribute('data-rail') !== 'make-comments') {
        document.querySelector<HTMLButtonElement>('[data-rail-btn="make-comments"]')?.click();
      }
    } else {
      const sheet = document.querySelector<HTMLElement>('[data-sheet="make-comments"]');
      if (sheet && sheet.hidden) {
        document.querySelector<HTMLButtonElement>('[data-sheet-open="make-comments"]')?.click();
      }
    }
  }, [isDesktop]);

  const hideSheet = useCallback(() => {
    const sheet = document.querySelector<HTMLElement>('[data-sheet="make-comments"]');
    if (sheet && !sheet.hidden) {
      sheet.querySelector<HTMLElement>('.reading-sheet__close')?.click();
    }
  }, []);

  // The bar carries the placing hint in place of its doors (phones)
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('.reading-bar');
    if (!bar) return;
    if (placing) bar.setAttribute('data-placing', '');
    else bar.removeAttribute('data-placing');
    return () => bar.removeAttribute('data-placing');
  }, [placing]);

  const startCompose = useCallback(
    (next: Exclude<Compose, null>) => {
      draftUuid.current = newDraftUuid();
      setText('');
      setName('');
      setSubmitState('idle');
      setCompose(next);
      showTenant();
    },
    [showTenant]
  );

  const cancelCompose = useCallback(() => {
    setCompose(null);
    setSubmitState('idle');
  }, []);

  useEffect(() => {
    if (compose) textareaRef.current?.focus();
  }, [compose]);

  // Placing mode: one capture-phase listener; a click resolves to a block,
  // island chrome keeps working, and nothing navigates mid-place.
  useEffect(() => {
    if (!placing) return;
    hideSheet();
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest('[data-annot-ui]')) return; // the hint's own controls
      e.preventDefault();
      e.stopPropagation();
      const block = blockOf(target);
      if (!block) return; // a click in the gaps stays in placing mode
      setPlacing(false);
      startCompose({ kind: 'new', targetId: block.dataset.annot as string, quote: null });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [placing, hideSheet, startCompose]);

  // Selection-first compose on coarse pointers (DR19): a text selection
  // inside a block opens compose against that block, quoting the selection.
  useEffect(() => {
    if (!coarse || loadState !== 'ready' || roundStatus !== 'open') return;
    let timer = 0;
    const onEnd = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const sel = document.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
        const quote = sel.toString().replace(/\s+/g, ' ').trim();
        if (!quote) return;
        const block = blockOf(sel.getRangeAt(0).commonAncestorContainer);
        if (!block) return;
        startCompose({
          kind: 'new',
          targetId: block.dataset.annot as string,
          quote: quote.length > QUOTE_MAX ? `${quote.slice(0, QUOTE_MAX - 1)}…` : quote,
        });
      }, 350);
    };
    document.addEventListener('touchend', onEnd);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('touchend', onEnd);
    };
  }, [coarse, loadState, roundStatus, startCompose]);

  // Esc leaves placing mode and closes compose.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPlacing(false);
      cancelCompose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [cancelCompose]);

  const post = async () => {
    if (submitState === 'inflight') return; // double-tap guard
    const trimmed = text.trim();
    if (!trimmed || !compose) return;
    setSubmitState('inflight');

    const body: Record<string, unknown> = {
      draft_uuid: draftUuid.current,
      text: trimmed,
      name: name.trim() || null,
    };
    if (compose.kind === 'thread') body.pin_no = compose.pinNo;
    if (compose.kind === 'new') {
      // Block-level anchors (DR18): the pin renders at the block's edge, so
      // the fraction is the edge itself
      body.target_id = compose.targetId;
      body.fx = 1;
      body.fy = 0.5;
    }

    let outcome: PostOutcome = { saved: false };
    try {
      const res = await fetch(`${apiBase}/${roundId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      outcome = interpretPostResponse(res.status, await res.text());
    } catch {
      outcome = { saved: false, pinNo: undefined };
    }

    if (!outcome.saved) {
      setSubmitState('failed'); // text stays; DD7 keep/retry/copy
      return;
    }

    const note: NoteView = {
      name: name.trim() || null,
      text: trimmed,
      created_at: new Date().toISOString(),
    };
    if (compose.kind === 'whole') {
      setWholePage((prev) => [...prev, note]);
    } else if (compose.kind === 'thread') {
      setThreads((prev) =>
        prev.map((t) => (t.pin_no === compose.pinNo ? { ...t, notes: [...t.notes, note] } : t))
      );
    } else if (typeof outcome.pinNo === 'number') {
      const pinNo = outcome.pinNo;
      setThreads((prev) => [
        ...prev,
        { pin_no: pinNo, target_id: compose.targetId, fx: 1, fy: 0.5, notes: [note] },
      ]);
    }
    draftUuid.current = '';
    cancelCompose(); // the pin simply appears; no toast
  };

  const anchors: ThreadAnchor[] = useMemo(
    () => threads.map(({ pin_no, target_id, fx, fy }) => ({ pin_no, target_id, fx, fy })),
    [threads]
  );

  const placement = useMemo(() => {
    if (!mounted) return { placed: [], unplaced: threads.map((t) => t.pin_no) };
    return placePins(
      anchors,
      (id) => TARGET_ID_RE.test(id) && document.querySelector(`article [data-annot="${id}"]`) !== null
    );
  }, [anchors, mounted, threads]);

  // Pin hosts need a positioning context
  useEffect(() => {
    if (!mounted) return;
    for (const pin of placement.placed) {
      const block = document.querySelector<HTMLElement>(`article [data-annot="${pin.target_id}"]`);
      if (block) pinHost(block).setAttribute('data-annot-pin-host', '');
    }
  }, [mounted, placement]);

  const isOpen = loadState === 'ready' && roundStatus === 'open';
  const roundNumber = roundId.split('-')[0].replace(/^r/, '');
  const currentPin = compose?.kind === 'thread' ? compose.pinNo : null;
  const threadFor = (pinNo: number) => threads.find((t) => t.pin_no === pinNo);
  const hint = coarse ? 'Tap where the note goes.' : 'Click where the note goes.';

  const noteCard = (note: NoteView, key: React.Key) => (
    <div key={key}>
      <p className="comments-card__who">
        {displayName(note.name)}
        {displayDate(note.created_at) && ` · ${displayDate(note.created_at)}`}
      </p>
      <p className="comments-card__text">{note.text}</p>
    </div>
  );

  // ---- The feed (DR19 states) ----
  const feed = (
    <div className="comments-feed" data-comments-feed>
      {loadState === 'unavailable' && (
        <p className="comments-feed__line">Notes are unavailable right now. The page is still readable.</p>
      )}
      {loadState === 'ready' && roundStatus === 'closed' && (
        <p className="comments-feed__line">
          Round {roundNumber} is closed. Reading is open; new notes go to the current round.
          {currentRoundId && (
            <>
              {' '}
              <a href={`/rounds/${currentRoundId}/`} className="underline underline-offset-2">
                Go to the current round
              </a>
            </>
          )}
        </p>
      )}
      {loadState === 'ready' && threads.length === 0 && wholePage.length === 0 && (
        <p className="comments-feed__line">
          No notes yet this round. Notes from this round go to the group's next meeting.
        </p>
      )}
      {loadState === 'ready' &&
        threads.map((thread) => (
          <button
            key={thread.pin_no}
            type="button"
            className="comments-card"
            aria-current={currentPin === thread.pin_no ? 'true' : undefined}
            aria-label={`Pin ${thread.pin_no}`}
            onClick={() => {
              if (roundStatus === 'open') startCompose({ kind: 'thread', pinNo: thread.pin_no });
              document
                .querySelector<HTMLElement>(`[data-annot-pin="${thread.pin_no}"]`)
                ?.scrollIntoView({ block: 'center', inline: 'nearest' });
            }}
          >
            <p className="comments-card__who">
              <span className="comments-card__pin" aria-hidden="true">
                {thread.pin_no}
              </span>
              {displayName(thread.notes[0]?.name ?? null)}
              {thread.notes[0] && displayDate(thread.notes[0].created_at) && ` · ${displayDate(thread.notes[0].created_at)}`}
            </p>
            <p className="comments-card__text">{thread.notes[0]?.text}</p>
            {thread.notes.slice(1).map((note, i) => noteCard(note, i))}
          </button>
        ))}
      {loadState === 'ready' && wholePage.length > 0 && (
        <div className="comments-card" data-comments-whole>
          <p className="comments-card__who">The whole page</p>
          {wholePage.map((note, i) => noteCard(note, i))}
        </div>
      )}
    </div>
  );

  // ---- The foot: compose lives here (DR20) ----
  const placingHint = (
    <>
      <p className="comments-foot__target">{hint}</p>
      <button type="button" className="comments-foot__btn" onClick={() => setPlacing(false)}>
        Cancel
      </button>
    </>
  );

  const foot = isOpen && (
    <div className="comments-foot" data-comments-foot>
      {!compose && !placing && (
        <div className="comments-foot__row">
          <button
            type="button"
            className="comments-foot__btn comments-foot__btn--primary"
            onClick={() => setPlacing(true)}
          >
            Leave a note
          </button>
          <button
            type="button"
            className="comments-foot__link"
            onClick={() => startCompose({ kind: 'whole' })}
          >
            Note on the whole page.
          </button>
        </div>
      )}
      {!compose && placing && isDesktop && <div className="comments-foot__row">{placingHint}</div>}
      {compose && (
        <div>
          <div className="comments-foot__row" style={{ justifyContent: 'space-between' }}>
            <p className="comments-foot__target">
              {compose.kind === 'thread'
                ? `Pin ${compose.pinNo}`
                : compose.kind === 'whole'
                  ? 'The whole page'
                  : 'New note'}
            </p>
            <button type="button" className="comments-foot__link" onClick={cancelCompose}>
              Close
            </button>
          </div>
          {compose.kind === 'new' && compose.quote && (
            <span className="comments-foot__quote">{compose.quote}</span>
          )}
          <label htmlFor="annot-textarea" className="comments-foot__label">
            Your note
          </label>
          <textarea
            id="annot-textarea"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
          />
          <label htmlFor="annot-name" className="comments-foot__label">
            Name (optional)
          </label>
          <input id="annot-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />

          {submitState === 'failed' && (
            <div className="comments-foot__failed" role="status">
              <p className="text-body font-medium text-foreground">Your note did not save.</p>
              <p className="text-body-small text-muted-foreground mt-xxs">
                Your words are kept here. The Questions door in the corner always works.
              </p>
              <div className="comments-foot__row" style={{ marginTop: 8 }}>
                <button type="button" className="comments-foot__btn comments-foot__btn--primary" onClick={post}>
                  Try again
                </button>
                <button
                  type="button"
                  className="comments-foot__btn"
                  onClick={() => copyNoteText(text, textareaRef.current)}
                >
                  Copy your note
                </button>
              </div>
            </div>
          )}
          {submitState !== 'failed' && (
            <div className="comments-foot__row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                className="comments-foot__btn comments-foot__btn--primary"
                onClick={post}
                disabled={!text.trim() || submitState === 'inflight'}
              >
                {submitState === 'inflight' ? 'Posting' : 'Post'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Status area under the round strip: unavailable or closed */}
      {statusSlot &&
        loadState === 'unavailable' &&
        createPortal(
          <div className="bg-muted border-b border-border">
            <div className="container mx-auto px-4 py-2.5">
              <p className="text-body-small text-foreground text-center">
                Notes are unavailable right now. The page is still readable.
              </p>
            </div>
          </div>,
          statusSlot
        )}
      {statusSlot &&
        loadState === 'ready' &&
        roundStatus === 'closed' &&
        createPortal(
          <div className="bg-muted border-b border-border">
            <div className="container mx-auto px-4 py-2.5">
              <p className="text-body-small text-foreground text-center">
                Round {roundNumber} is closed. Reading is open; new notes go to the current round.
                {currentRoundId && (
                  <>
                    {' '}
                    <a
                      href={`/rounds/${currentRoundId}/`}
                      className="underline underline-offset-2 hover:opacity-80"
                    >
                      Go to the current round
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>,
          statusSlot
        )}

      {/* Pins: portaled to the block's edge (DR18). */}
      {mounted &&
        placement.placed.map((pin) => {
          const block = document.querySelector<HTMLElement>(`article [data-annot="${pin.target_id}"]`);
          if (!block) return null;
          return createPortal(
            <button
              key={pin.pin_no}
              type="button"
              data-annot-ui
              data-annot-pin={pin.pin_no}
              aria-label={`Note ${pin.pin_no}`}
              onClick={() => {
                if (roundStatus === 'open') startCompose({ kind: 'thread', pinNo: pin.pin_no });
                else showTenant();
              }}
              className={`annot-pin${roundStatus === 'closed' ? ' annot-pin--closed' : ''}${
                currentPin === pin.pin_no ? ' annot-pin--current' : ''
              }`}
              style={{ transform: `translate(${pin.stackIndex * 10}px, ${pin.stackIndex * 10}px)` }}
            >
              <span aria-hidden="true" className="annot-pin__dot">
                {pin.pin_no}
              </span>
            </button>,
            pinHost(block)
          );
        })}

      {/* The tenant: feed above, compose foot below (DR20) */}
      {mountEl &&
        createPortal(
          <>
            {feed}
            {foot}
          </>,
          mountEl
        )}
      {hintEl && placing && !isDesktop && createPortal(placingHint, hintEl)}

      {/* Printed for the meeting: every thread and whole-page note, so the
          round reads whole from paper (pins stay as numbered dots in place). */}
      {loadState === 'ready' && (threads.length > 0 || wholePage.length > 0) && (
        <section className="container mx-auto px-4 py-8 max-w-2xl hidden annot-notes-print">
          <h2 className="text-headline font-semibold text-foreground mb-md">Notes from this round</h2>
          <ul className="space-y-md">
            {wholePage.map((note, i) => (
              <li key={`w-${i}`} className="border border-border rounded-lg p-md bg-background">
                {noteCard(note, i)}
              </li>
            ))}
            {threads.map((thread) => (
              <li key={`t-${thread.pin_no}`} className="border border-border rounded-lg p-md bg-background">
                <p className="text-body-small text-muted-foreground mb-xxs">Pin {thread.pin_no}</p>
                {thread.notes.map((note, i) => noteCard(note, i))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

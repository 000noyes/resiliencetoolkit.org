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
 * The round page's one hydrated island: pins over the frozen surface,
 * the bottom-sheet threads, and the add-only write path.
 *
 * Contracts it carries:
 * - E4: pins live INSIDE their data-annot landmark at fractional offsets
 *   (portals), so they ride reflow, resize, and the fixed corner panel; a
 *   missing landmark degrades the thread to the notes list, never a
 *   mispositioned dot.
 * - E10: saved means 2xx + JSON ok + the server pin number; every other
 *   outcome keeps the text and renders keep/retry/copy. The copy chain is
 *   synchronous clipboard, then execCommand, then visible selected text.
 * - DD5/DD8/DD9: unnamed notes render as Someone; no reply promises, no
 *   toasts, no status chrome; the whole-page path skips placement.
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

type Sheet =
  | { kind: 'thread'; pinNo: number }
  | { kind: 'new'; targetId: string; fx: number; fy: number }
  | { kind: 'whole' }
  | null;

// Server data is attacker-writable; a target_id only ever reaches a CSS
// selector after passing the same shape rule the API enforces, so a hostile
// value can neither throw in querySelector nor address another element.
const TARGET_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;

function displayName(name: string | null): string {
  return name && name.trim() ? name : 'Someone';
}

function displayDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AnnotationIsland({ roundId }: { roundId: string }) {
  const [mounted, setMounted] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [roundStatus, setRoundStatus] = useState<'open' | 'closed'>('open');
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [wholePage, setWholePage] = useState<NoteView[]>([]);
  const [placing, setPlacing] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'inflight' | 'failed'>('idle');

  const draftUuid = useRef<string>('');
  const sheetRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  // The round is one frozen page: a tapped content link would silently leave
  // it, so links open in a new tab and the round stays put underneath.
  useEffect(() => {
    document
      .querySelectorAll<HTMLAnchorElement>('main a[href]')
      .forEach((a) => {
        if (a.closest('[data-annot-ui]')) return;
        a.target = '_blank';
        a.rel = 'noopener';
      });
  }, []);

  // Load the round: status + threads. Failure leaves the frozen page fully
  // readable with the notes marked unavailable; no fake empty state.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rounds/${roundId}/notes`)
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
  }, [roundId]);

  // Landmarks need a positioning context for the pin portals.
  useEffect(() => {
    if (!mounted) return;
    document.querySelectorAll<HTMLElement>('[data-annot]').forEach((el) => {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    });
  }, [mounted]);

  // Placing mode: one capture-phase listener; taps resolve to a landmark +
  // fraction, island chrome keeps working, and nothing navigates mid-place.
  useEffect(() => {
    if (!placing) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest('[data-annot-ui]')) return; // the hint bar's own controls
      e.preventDefault();
      e.stopPropagation();
      const landmark = target.closest<HTMLElement>('[data-annot]');
      if (!landmark) return; // a tap in the gaps stays in placing mode
      const rect = landmark.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const fx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const fy = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      setPlacing(false);
      openCompose({ kind: 'new', targetId: landmark.dataset.annot as string, fx, fy });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placing]);

  // Esc closes placing mode and the sheet; the scrim and close controls do
  // the rest. Focus moves into the sheet when it opens (focus trap below).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPlacing(false);
      closeSheet();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sheet && sheetRef.current) sheetRef.current.focus();
  }, [sheet]);

  const openCompose = (next: Exclude<Sheet, null>) => {
    draftUuid.current = newDraftUuid();
    setText('');
    setName('');
    setSubmitState('idle');
    setSheet(next);
  };

  const closeSheet = useCallback(() => {
    setSheet(null);
    setSubmitState('idle');
  }, []);

  // Simple focus trap: Tab cycles within the sheet while it is open.
  const onSheetKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !sheetRef.current) return;
    const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const post = async () => {
    if (submitState === 'inflight') return; // double-tap guard
    const trimmed = text.trim();
    if (!trimmed || !sheet) return;
    setSubmitState('inflight');

    const body: Record<string, unknown> = {
      draft_uuid: draftUuid.current,
      text: trimmed,
      name: name.trim() || null,
    };
    if (sheet.kind === 'thread') body.pin_no = sheet.pinNo;
    if (sheet.kind === 'new') {
      body.target_id = sheet.targetId;
      body.fx = sheet.fx;
      body.fy = sheet.fy;
    }

    let outcome: PostOutcome = { saved: false };
    try {
      const res = await fetch(`/api/rounds/${roundId}/notes`, {
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
    if (sheet.kind === 'whole') {
      setWholePage((prev) => [...prev, note]);
    } else if (sheet.kind === 'thread') {
      setThreads((prev) =>
        prev.map((t) => (t.pin_no === sheet.pinNo ? { ...t, notes: [...t.notes, note] } : t))
      );
    } else if (typeof outcome.pinNo === 'number') {
      const pinNo = outcome.pinNo;
      setThreads((prev) => [
        ...prev,
        { pin_no: pinNo, target_id: sheet.targetId, fx: sheet.fx, fy: sheet.fy, notes: [note] },
      ]);
    }
    draftUuid.current = '';
    closeSheet(); // the pin simply appears; no toast
  };

  const anchors: ThreadAnchor[] = useMemo(
    () => threads.map(({ pin_no, target_id, fx, fy }) => ({ pin_no, target_id, fx, fy })),
    [threads]
  );

  const placement = useMemo(() => {
    if (!mounted) return { placed: [], unplaced: threads.map((t) => t.pin_no) };
    return placePins(
      anchors,
      (id) => TARGET_ID_RE.test(id) && document.querySelector(`[data-annot="${id}"]`) !== null
    );
  }, [anchors, mounted, threads]);

  const unplacedThreads = threads.filter((t) => placement.unplaced.includes(t.pin_no));
  const isOpen = loadState === 'ready' && roundStatus === 'open';
  const statusSlot = mounted ? document.getElementById('round-status-slot') : null;

  const threadFor = (pinNo: number) => threads.find((t) => t.pin_no === pinNo);

  return (
    <>
      {/* Status area under the round header: closed banner or unavailable note. */}
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
                Round 1 is closed. Reading is open; new notes go to the current round.
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

      {/* Pins: portaled into their landmarks at fractional offsets. */}
      {mounted &&
        placement.placed.map((pin) => {
          const landmark = document.querySelector<HTMLElement>(`[data-annot="${pin.target_id}"]`);
          if (!landmark) return null;
          return createPortal(
            <button
              key={pin.pin_no}
              type="button"
              aria-label={`Note ${pin.pin_no}`}
              onClick={() => {
                setSubmitState('idle');
                draftUuid.current = newDraftUuid();
                setText('');
                setName('');
                setSheet({ kind: 'thread', pinNo: pin.pin_no });
              }}
              className="absolute z-30 w-11 h-11 -ml-[22px] -mt-[22px] flex items-center justify-center"
              style={{
                left: `${pin.fx * 100}%`,
                top: `${pin.fy * 100}%`,
                transform: `translate(${pin.stackIndex * 10}px, ${pin.stackIndex * 10}px)`,
              }}
            >
              <span
                aria-hidden="true"
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold shadow-raised ${
                  roundStatus === 'closed'
                    ? 'bg-muted-foreground text-background'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {pin.pin_no}
              </span>
            </button>,
            landmark
          );
        })}

      {/* Bottom action area: Leave a note / the placing hint bar. */}
      {isOpen && !sheet && !placing && (
        <div
          data-annot-ui
          className="fixed inset-x-0 bottom-6 z-30 flex flex-col items-center gap-sm pointer-events-none"
        >
          <button
            type="button"
            onClick={() => setPlacing(true)}
            className="pointer-events-auto h-12 px-lg rounded-xl bg-primary text-primary-foreground text-body font-medium shadow-raised hover:shadow-modal transition-all duration-default active:translate-y-px"
          >
            Leave a note
          </button>
          <button
            type="button"
            onClick={() => openCompose({ kind: 'whole' })}
            className="pointer-events-auto text-body-small text-foreground underline underline-offset-2 hover:opacity-80 bg-background border border-border px-sm py-xxs rounded-lg shadow-ambient"
          >
            Note on the whole page.
          </button>
        </div>
      )}
      {isOpen && placing && (
        <div data-annot-ui className="fixed inset-x-0 bottom-6 z-30 flex justify-center">
          <div className="flex items-center gap-md bg-card border border-border rounded-xl shadow-modal px-lg py-md">
            <p className="text-body text-foreground">Tap where the note goes.</p>
            <button
              type="button"
              onClick={() => setPlacing(false)}
              className="h-10 px-md rounded-lg border border-border bg-background text-body font-medium text-foreground hover:bg-muted transition-colors duration-default"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* The bottom sheet. */}
      {sheet && (
        <>
          <div
            data-annot-ui
            className="fixed inset-0 z-40 bg-black/50"
            onClick={closeSheet}
            aria-hidden="true"
          />
          <div
            data-annot-ui
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={
              sheet.kind === 'thread'
                ? `Pin ${sheet.pinNo}`
                : sheet.kind === 'whole'
                  ? 'The whole page'
                  : 'New note'
            }
            onKeyDown={onSheetKeyDown}
            className="fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border rounded-t-2xl shadow-modal max-h-[80vh] overflow-y-auto outline-none motion-safe:transition-transform"
          >
            <div className="mx-auto mt-sm mb-xs w-10 h-1 rounded-full bg-border" aria-hidden="true" />
            <div className="px-lg pb-lg max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-sm">
                <h2 className="text-title font-semibold text-foreground">
                  {sheet.kind === 'thread'
                    ? `Pin ${sheet.pinNo}`
                    : sheet.kind === 'whole'
                      ? 'The whole page'
                      : 'New note'}
                </h2>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="h-11 w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-default"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {sheet.kind === 'thread' && (
                <ul className="mb-md space-y-md">
                  {(threadFor(sheet.pinNo)?.notes ?? []).map((note, i) => (
                    <li key={i} className="border border-border rounded-lg p-md bg-background">
                      <p className="text-body-small text-muted-foreground mb-xxs">
                        {displayName(note.name)}
                        {displayDate(note.created_at) && ` · ${displayDate(note.created_at)}`}
                      </p>
                      <p className="text-body text-foreground whitespace-pre-wrap">{note.text}</p>
                    </li>
                  ))}
                </ul>
              )}
              {sheet.kind === 'whole' && wholePage.length > 0 && (
                <ul className="mb-md space-y-md">
                  {wholePage.map((note, i) => (
                    <li key={i} className="border border-border rounded-lg p-md bg-background">
                      <p className="text-body-small text-muted-foreground mb-xxs">
                        {displayName(note.name)}
                        {displayDate(note.created_at) && ` · ${displayDate(note.created_at)}`}
                      </p>
                      <p className="text-body text-foreground whitespace-pre-wrap">{note.text}</p>
                    </li>
                  ))}
                </ul>
              )}

              {roundStatus === 'open' && (
                <div>
                  <label
                    htmlFor="annot-textarea"
                    className="block text-label font-medium text-foreground mb-xs"
                  >
                    Your note
                  </label>
                  <textarea
                    id="annot-textarea"
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={4}
                    className="w-full px-md py-md border border-border rounded-lg bg-input text-body text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-default shadow-ambient resize-none"
                  />
                  <label
                    htmlFor="annot-name"
                    className="block text-label font-medium text-foreground mt-sm mb-xs"
                  >
                    Name (optional)
                  </label>
                  <input
                    id="annot-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-11 px-md border border-border rounded-lg bg-input text-body text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-default"
                  />

                  {submitState === 'failed' && (
                    <div className="mt-md border border-border rounded-lg p-md bg-muted" role="status">
                      <p className="text-body font-medium text-foreground">Your note did not save.</p>
                      <p className="text-body-small text-muted-foreground mt-xxs">
                        Your words are kept here. The Questions door in the corner always works.
                      </p>
                      <div className="flex gap-sm mt-sm">
                        <button
                          type="button"
                          onClick={post}
                          className="h-10 px-md rounded-lg bg-primary text-primary-foreground text-body font-medium shadow-sm transition-all duration-default active:translate-y-px"
                        >
                          Try again
                        </button>
                        <button
                          type="button"
                          onClick={() => copyNoteText(text, textareaRef.current)}
                          className="h-10 px-md rounded-lg border border-border bg-background text-body font-medium text-foreground hover:bg-muted transition-colors duration-default"
                        >
                          Copy your note
                        </button>
                      </div>
                    </div>
                  )}

                  {submitState !== 'failed' && (
                    <div className="flex justify-end mt-sm">
                      <button
                        type="button"
                        onClick={post}
                        disabled={!text.trim() || submitState === 'inflight'}
                        className="h-10 px-lg rounded-lg bg-primary text-primary-foreground text-body font-medium shadow-sm hover:shadow-raised transition-all duration-default active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitState === 'inflight' ? 'Posting' : 'Post'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* The notes list. On screen: whole-page notes and threads whose
          landmark is gone. In print: every thread, so the meeting reads the
          whole round from paper (the pins stay as numbered dots in place). */}
      {loadState === 'ready' &&
        (wholePage.length > 0 || unplacedThreads.length > 0 || threads.length > 0) && (
        <section
          className={`container mx-auto px-4 py-8 max-w-2xl ${
            wholePage.length === 0 && unplacedThreads.length === 0 ? 'hidden print:block' : ''
          }`}
          data-annot-ui
        >
          <h2 className="text-headline font-semibold text-foreground mb-md">
            Notes from this round
          </h2>
          <ul className="space-y-md">
            {wholePage.map((note, i) => (
              <li key={`w-${i}`} className="border border-border rounded-lg p-md bg-background">
                <p className="text-body-small text-muted-foreground mb-xxs">
                  {displayName(note.name)}
                  {displayDate(note.created_at) && ` · ${displayDate(note.created_at)}`}
                </p>
                <p className="text-body text-foreground whitespace-pre-wrap">{note.text}</p>
              </li>
            ))}
            {threads.map((thread) => {
              const degraded = placement.unplaced.includes(thread.pin_no);
              return (
                <li
                  key={`t-${thread.pin_no}`}
                  className={`border border-border rounded-lg p-md bg-background ${
                    degraded ? '' : 'hidden print:block'
                  }`}
                >
                  <p className="text-body-small text-muted-foreground mb-xxs">Pin {thread.pin_no}</p>
                  {thread.notes.map((note, i) => (
                    <div key={i} className={i > 0 ? 'mt-sm' : ''}>
                      <p className="text-body-small text-muted-foreground mb-xxs">
                        {displayName(note.name)}
                        {displayDate(note.created_at) && ` · ${displayDate(note.created_at)}`}
                      </p>
                      <p className="text-body text-foreground whitespace-pre-wrap">{note.text}</p>
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

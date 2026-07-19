/**
 * Safety-card state derivation — pure functions behind the dashboard's answer.
 *
 * The island stays thin: everything the card says comes out of
 * deriveSafetyCard(), so the display-scale sentence table and the overlay
 * contract are testable as a matrix. The honest meter is computed from the
 * same canonical snapshot the calm gate hashes, so no two surfaces can
 * disagree on a count.
 *
 * Register rules that bind every string here: plain warm words, no blame, no
 * exclamation on a warning, zero em or en dashes, headlines never carry
 * filenames or counts-as-data (those live in the receipt).
 */
import type { CueState } from '@/lib/backup-cue';
import type { WorkSnapshot } from '@/lib/backup-cue';
import { getModuleDisplayName } from '@/lib/storage';

// ============================================================================
// STATE DERIVATION
// ============================================================================

export interface WorkCountsInput {
  todos: number;
  tables: number;
  hasNotes: boolean;
}

export interface OverlayInput {
  loss: boolean;
  full: boolean;
  atRisk: boolean;
  offline: boolean;
}

export type CardActivity = 'idle' | 'backing-up' | 'just-backed-up' | 'failed' | 'just-restored';

export interface SafetyCardInputs {
  cue: CueState;
  counts: WorkCountsInput;
  /** Current snapshot hash vs the stored baseline; null while not yet computed. */
  hashMatch: boolean | null;
  overlays: OverlayInput;
  activity: CardActivity;
  /** Filename of the backup just made (just-backed-up receipt only). */
  lastBackupFilename?: string;
  /** Counts from a restore that just completed (just-restored receipt). */
  restoredCounts?: { todos: number; tables: number; madeAt?: string | null };
}

export type SafetyCardBaseState =
  | 'empty'
  | 'first-work'
  | 'unknown'
  | 'fresh'
  | 'working-ahead'
  | 'just-backed-up'
  | 'failed'
  | 'just-restored';

export interface SafetyCard {
  state: SafetyCardBaseState;
  /** The display-scale sentence. One per state; never a count dump. */
  headline: string;
  /** Small-print receipt lines under the headline. */
  receipt: string[];
  /** Quiet, muted lines (at-risk, offline, collapsed overlays). */
  quietLines: string[];
  /** The one button's state. */
  buttonState: 'ready' | 'working';
  /** True when a replacing overlay (loss or full) owns the headline. */
  overlayLeads: boolean;
}

/** The one unit grammar: two nouns, conjugated identically everywhere. */
export function countNoun(n: number, noun: 'checked item' | 'saved row' | 'change'): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** "Tuesday, July 14" style date for receipts. */
export function formatReceiptDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'an earlier date';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

const OVERLAY_HEADLINES = {
  loss: 'Some saved work may be missing.',
  full: 'This device is low on space.',
} as const;

const OVERLAY_RECEIPTS = {
  loss: "Your browser removed it to free space. This is the browser's doing, not yours. If you have a backup, Restore brings it back.",
  full: 'Your latest typing is saved on this device and will be in your backup.',
} as const;

const QUIET_LINES = {
  full: 'This device is low on space. Back up now.',
  atRisk: 'This browser can clear saved work when space runs low. Back up to keep a copy.',
  offline: 'You are offline. Backing up still works.',
} as const;

/** Derive everything the card says from the current inputs. Pure. */
export function deriveSafetyCard(inputs: SafetyCardInputs): SafetyCard {
  const { cue, counts, hashMatch, overlays, activity } = inputs;
  const hasWork = counts.todos > 0 || counts.tables > 0 || counts.hasNotes;

  // Base state
  let state: SafetyCardBaseState;
  if (activity === 'just-backed-up') state = 'just-backed-up';
  else if (activity === 'failed') state = 'failed';
  else if (activity === 'just-restored') state = 'just-restored';
  else if (!hasWork) state = 'empty';
  else if (!cue.lastBackupAt) state = 'first-work';
  else if (typeof cue.counter === 'number' && cue.counter > 0) state = 'working-ahead';
  else if (cue.counter === 0 && hashMatch === true) state = 'fresh';
  else state = 'unknown'; // cold start, hash mismatch, or hash not yet computed

  let headline: string;
  const receipt: string[] = [];

  switch (state) {
    case 'empty':
      headline = 'No saved work on this device yet.';
      receipt.push('Anything you save stays on this device only.');
      break;
    case 'first-work':
      headline = 'This device has work ready to back up.';
      receipt.push('Right now it lives only on this device.');
      break;
    case 'unknown':
      headline = 'Back up once to make this device current.';
      break;
    case 'fresh':
      headline = 'Everything you have is backed up.';
      break;
    case 'working-ahead': {
      const n = cue.counter as number;
      headline =
        n > 99 ? 'Many changes are ready to back up.' : `${countNoun(n, 'change')} ${n === 1 ? 'is' : 'are'} ready to back up.`;
      break;
    }
    case 'just-backed-up': {
      headline = 'Your backup file is made.';
      const name = inputs.lastBackupFilename;
      receipt.push(
        `${name ? `${name} should` : 'It should'} be in your Downloads or Files. Not there? Back up again.`,
      );
      break;
    }
    case 'failed':
      headline = 'That backup did not finish.';
      receipt.push('Nothing was lost; your work is still on this device. Try again.');
      break;
    case 'just-restored': {
      headline = 'Your work is back.';
      const rc = inputs.restoredCounts;
      if (rc) {
        const parts = [
          rc.todos > 0 ? countNoun(rc.todos, 'checked item') : '',
          rc.tables > 0 ? countNoun(rc.tables, 'saved row') : '',
        ].filter(Boolean);
        const made = rc.madeAt ? ` from the backup made ${formatReceiptDate(rc.madeAt)}` : '';
        receipt.push(
          `This device now holds ${parts.length ? parts.join(' and ') : 'your restored work'}${made}.`,
        );
      }
      break;
    }
  }

  // The persistent receipt: date only, never the location claim. The one
  // exception is the plain-anchor transport, which has no completion signal:
  // its "check your Downloads" caution persists into the calm state so the
  // card never claims a confirmed calm on a click alone.
  if (state !== 'just-backed-up' && state !== 'just-restored' && cue.lastBackupAt) {
    receipt.unshift(`Backed up ${formatReceiptDate(cue.lastBackupAt)}.`);
    if (state === 'fresh' && cue.lastBackupTransport === 'anchor') {
      receipt.push('The file should be in your Downloads or Files. Not there? Back up again.');
    }
  }

  // Overlay contract: loss and full replace the headline (one leads by
  // priority, the rest collapse to the quiet line); at risk and offline are
  // always quiet lines and never take the headline.
  const quietLines: string[] = [];
  let overlayLeads = false;
  if (overlays.loss || overlays.full) {
    overlayLeads = true;
    if (overlays.loss) {
      headline = OVERLAY_HEADLINES.loss;
      receipt.length = 0;
      receipt.push(OVERLAY_RECEIPTS.loss);
      if (overlays.full) quietLines.push(QUIET_LINES.full);
    } else {
      headline = OVERLAY_HEADLINES.full;
      receipt.length = 0;
      receipt.push(OVERLAY_RECEIPTS.full);
    }
  }
  if (overlays.atRisk) quietLines.push(QUIET_LINES.atRisk);
  if (overlays.offline) quietLines.push(QUIET_LINES.offline);

  return {
    state,
    headline,
    receipt,
    quietLines,
    buttonState: activity === 'backing-up' ? 'working' : 'ready',
    overlayLeads,
  };
}

/** "Jul 14, 2026" style short date for the module-card line. */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'an earlier date';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * The module-page WorkLivesHere backup line, rendered from the same cue as
 * the dashboard card so the two surfaces can never disagree (reconciliation
 * R1 retires the card's old 7-day time-based nudge).
 */
export function moduleCardBackupLine(cue: CueState): string {
  if (!cue.lastBackupAt) return 'You have not backed up yet.';
  const date = `Last backup: ${formatShortDate(cue.lastBackupAt)}.`;
  if (typeof cue.counter === 'number' && cue.counter > 0) {
    return cue.counter > 99
      ? `${date} Many changes since.`
      : `${date} ${countNoun(cue.counter, 'change')} since.`;
  }
  if (cue.counter === 'unknown') {
    return `${date} Back up once to make this current.`;
  }
  return date;
}

// ============================================================================
// HONEST METER
// ============================================================================

export interface MeterRow {
  moduleKey: string | null;
  name: string;
  /** "1 checked item · 42 saved rows" in the one unit grammar. */
  detail: string;
  bytes: number;
}

export interface WorkMeter {
  rows: MeterRow[];
  total: MeterRow;
}

/** Human byte size. Whole KB above 1 KB: a safety gauge, not a fuel gauge. */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function utf8Length(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function detailFor(items: number, rows: number): string {
  const parts = [
    items > 0 ? countNoun(items, 'checked item') : '',
    rows > 0 ? countNoun(rows, 'saved row') : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

/**
 * Compute the per-module meter from the canonical work snapshot. Counts and
 * bytes come from the user's own serialized data, knowable to the byte; never
 * storage.estimate() quota arithmetic.
 */
export function computeWorkMeter(snapshot: WorkSnapshot): WorkMeter {
  interface Bucket {
    items: number;
    rows: number;
    bytes: number;
  }
  const buckets = new Map<string, Bucket>();
  const bucket = (key: string): Bucket => {
    let b = buckets.get(key);
    if (!b) {
      b = { items: 0, rows: 0, bytes: 0 };
      buckets.set(key, b);
    }
    return b;
  };

  for (const todo of snapshot.todos as Array<{ id: string; moduleKey?: string }>) {
    const b = bucket(todo.moduleKey ?? 'other');
    b.items += 1;
    b.bytes += utf8Length(todo);
  }
  for (const row of snapshot.tables as Array<{ id: string; moduleKey?: string }>) {
    const b = bucket(row.moduleKey ?? 'other');
    b.rows += 1;
    b.bytes += utf8Length(row);
  }

  const rows: MeterRow[] = Array.from(buckets.entries())
    .map(([moduleKey, b]) => ({
      moduleKey,
      name: getModuleDisplayName(moduleKey),
      detail: detailFor(b.items, b.rows),
      bytes: b.bytes,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const notes = snapshot.metadata['personalNotes'];
  if (typeof notes === 'string' && notes.length > 0) {
    rows.push({ moduleKey: null, name: 'Personal notes', detail: 'saved', bytes: utf8Length(notes) });
  }

  const totalItems = snapshot.todos.length;
  const totalRows = snapshot.tables.length;
  const totalBytes = rows.reduce((sum, r) => sum + r.bytes, 0);

  return {
    rows,
    total: {
      moduleKey: null,
      name: 'Everything',
      detail: detailFor(totalItems, totalRows) || 'nothing saved yet',
      bytes: totalBytes,
    },
  };
}

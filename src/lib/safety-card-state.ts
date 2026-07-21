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
import { PARENT_ORDER, PARENT_NAMES, parentOf } from '@/lib/module-taxonomy';

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

export type CardActivity =
  | 'idle'
  | 'backing-up'
  | 'just-backed-up'
  | 'failed'
  | 'share-failed'
  | 'just-restored';

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
  | 'share-failed'
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
  else if (activity === 'share-failed') state = 'share-failed';
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
        name
          ? `The file is named ${name}. If you cannot find it, back up again.`
          : 'If you cannot find the file, back up again.',
      );
      break;
    }
    case 'failed':
      headline = 'That backup did not finish.';
      receipt.push('Nothing was lost; your work is still on this device. Try again.');
      break;
    case 'share-failed':
      headline = 'That copy did not send.';
      receipt.push('Nothing was lost. Your work is still on this device. You can back it up instead.');
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

  // The persistent receipt: date only, never a location claim. The one
  // exception is the plain-anchor transport, which has no completion signal:
  // its find-the-file caution persists into the calm state so the card never
  // claims a confirmed calm on a click alone.
  if (state !== 'just-backed-up' && state !== 'just-restored' && cue.lastBackupAt) {
    receipt.unshift(`Backed up ${formatReceiptDate(cue.lastBackupAt)}.`);
    if (state === 'fresh' && cue.lastBackupTransport === 'anchor') {
      receipt.push('If you cannot find the file, back up again.');
    }
  }

  // Overlay contract: loss and full replace the headline (one leads by
  // priority, the rest collapse to the quiet line); at risk and offline are
  // always quiet lines and never take the headline.
  const quietLines: string[] = [];
  let overlayLeads = false;
  // The no-work-silence rule: with nothing saved, the storage-space nudges
  // (full, at risk, offline) have nothing to protect, so they stay silent and
  // the plain empty headline stands. Loss is the exception: it fires only when
  // this device once held work that is now gone, which is always worth saying.
  const spaceNudges = hasWork;
  if (overlays.loss || (overlays.full && spaceNudges)) {
    overlayLeads = true;
    if (overlays.loss) {
      headline = OVERLAY_HEADLINES.loss;
      receipt.length = 0;
      receipt.push(OVERLAY_RECEIPTS.loss);
      if (overlays.full && spaceNudges) quietLines.push(QUIET_LINES.full);
    } else {
      headline = OVERLAY_HEADLINES.full;
      receipt.length = 0;
      receipt.push(OVERLAY_RECEIPTS.full);
    }
  }
  // Right after a backup, the at-risk "back up to keep a copy" nudge is
  // redundant against the receipt the person is reading, so it stays quiet.
  if (spaceNudges && overlays.atRisk && state !== 'just-backed-up') quietLines.push(QUIET_LINES.atRisk);
  if (spaceNudges && overlays.offline) quietLines.push(QUIET_LINES.offline);

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

export interface MeterGroup {
  /** Top-level module key, or a synthetic key for a standalone row (notes). */
  key: string;
  name: string;
  /** Subtotal across the whole group, in the one unit grammar. */
  detail: string;
  bytes: number;
  /**
   * The distinct child modules under this group. Empty when the group's only
   * work is its own or shares the group's display name, so it renders as one
   * flat row (no redundant self-nested child).
   */
  leaves: MeterRow[];
}

export interface WorkMeter {
  /** Grouped under the three top-level modules, in PARENT_ORDER, so the meter
   * reads in the same order and shape as "Your progress". */
  groups: MeterGroup[];
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

  // A "checked item" is a todo that is actually checked (completed). An
  // unchecked todo that was saved (a toggle-off, or a note added without
  // checking) is data in the backup but not a checked item, so it never counts
  // here. This keeps the meter equal to "Your progress" (which counts checked
  // todos) and to the restore preview, so all three ledgers agree.
  for (const todo of snapshot.todos as Array<{ id: string; moduleKey?: string; completed?: boolean }>) {
    if (todo.completed !== true) continue;
    const b = bucket(todo.moduleKey ?? 'other');
    b.items += 1;
    b.bytes += utf8Length(todo);
  }
  for (const row of snapshot.tables as Array<{ id: string; moduleKey?: string }>) {
    const b = bucket(row.moduleKey ?? 'other');
    b.rows += 1;
    b.bytes += utf8Length(row);
  }

  // Group leaf modules under their top-level module so the meter reads in the
  // same order and shape as "Your progress" (one shared taxonomy, no drift).
  interface RawLeaf {
    moduleKey: string;
    name: string;
    items: number;
    rows: number;
    bytes: number;
  }
  const groupMap = new Map<string, RawLeaf[]>();
  for (const [moduleKey, b] of buckets.entries()) {
    const pk = parentOf(moduleKey);
    const leaf: RawLeaf = {
      moduleKey,
      name: getModuleDisplayName(moduleKey),
      items: b.items,
      rows: b.rows,
      bytes: b.bytes,
    };
    const list = groupMap.get(pk);
    if (list) list.push(leaf);
    else groupMap.set(pk, [leaf]);
  }

  // The three top-level modules first, in their fixed order; then any leftover
  // group (an unknown or test key) alphabetically by name.
  const groupKeys = [
    ...PARENT_ORDER.filter((k) => groupMap.has(k)),
    ...Array.from(groupMap.keys())
      .filter((k) => !PARENT_ORDER.includes(k))
      .sort((a, b) => getModuleDisplayName(a).localeCompare(getModuleDisplayName(b))),
  ];

  const groups: MeterGroup[] = groupKeys.map((pk) => {
    const leaves = groupMap.get(pk)!;
    const name = PARENT_NAMES[pk] ?? getModuleDisplayName(pk);
    const items = leaves.reduce((s, l) => s + l.items, 0);
    const rows = leaves.reduce((s, l) => s + l.rows, 0);
    const bytes = leaves.reduce((s, l) => s + l.bytes, 0);
    // List only children whose name differs from the group: the leaf that
    // shares the parent's display name (knowing-community) folds into the
    // subtotal instead of self-nesting an identical row.
    const listed: MeterRow[] = leaves
      .filter((l) => l.name !== name)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((l) => ({
        moduleKey: l.moduleKey,
        name: l.name,
        detail: detailFor(l.items, l.rows),
        bytes: l.bytes,
      }));
    return { key: pk, name, detail: detailFor(items, rows), bytes, leaves: listed };
  });

  const notes = snapshot.metadata['personalNotes'];
  if (typeof notes === 'string' && notes.length > 0) {
    groups.push({
      key: 'personal-notes',
      name: 'Personal notes',
      detail: 'saved',
      bytes: utf8Length(notes),
      leaves: [],
    });
  }

  const totalItems = (snapshot.todos as Array<{ completed?: boolean }>).filter(
    (t) => t.completed === true,
  ).length;
  const totalRows = snapshot.tables.length;
  const totalBytes = groups.reduce((sum, g) => sum + g.bytes, 0);

  return {
    groups,
    total: {
      moduleKey: null,
      name: 'Everything',
      detail: detailFor(totalItems, totalRows) || 'nothing saved yet',
      bytes: totalBytes,
    },
  };
}

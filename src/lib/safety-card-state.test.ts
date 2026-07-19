/**
 * Safety-card state derivation — the display-scale sentence table and the
 * overlay contract, tested as a matrix so every state of the reviewed design
 * has an asserted headline, receipt, and action.
 *
 * Rules under test (binding spec, RT-Backup-Import-Flow-design):
 *   - one headline per state; no filenames, counts-as-data, teaching copy, or
 *     blame in the headline
 *   - Loss and Full REPLACE the headline; At risk and Offline NEVER take the
 *     headline (quiet line under the receipt); one overlay leads, the rest
 *     collapse to the quiet line
 *   - the persistent receipt says only the date; no surface asserts where a
 *     downloaded file landed (a find-it fallback only, never a location claim)
 *   - unit grammar: "checked items" and "saved rows", identical everywhere
 *
 * Run: pnpm vitest run src/lib/safety-card-state.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  deriveSafetyCard,
  computeWorkMeter,
  formatByteSize,
  moduleCardBackupLine,
  type SafetyCardInputs,
} from './safety-card-state';
import { buildWorkSnapshot } from './backup-cue';

const noWork = { todos: 0, tables: 0, hasNotes: false };
const someWork = { todos: 3, tables: 5, hasNotes: false };

function base(overrides: Partial<SafetyCardInputs> = {}): SafetyCardInputs {
  return {
    cue: { counter: 'unknown', lastBackupAt: null, lastBackupHash: null },
    counts: someWork,
    hashMatch: null,
    overlays: { loss: false, full: false, atRisk: false, offline: false },
    activity: 'idle',
    ...overrides,
  };
}

describe('base state headlines (the decided sentence table)', () => {
  it('Empty: no saved work on this device yet, receipt stays factual (not preachy)', () => {
    const card = deriveSafetyCard(base({ counts: noWork }));
    expect(card.state).toBe('empty');
    expect(card.headline).toBe('No saved work on this device yet.');
    const receipt = card.receipt.join(' ');
    expect(receipt).toContain('this device');
    // Register cut (operator design review): no "keep it safe" hand-holding.
    expect(receipt).not.toContain('keep it safe');
  });

  it('First work: work exists, never backed up', () => {
    const card = deriveSafetyCard(base());
    expect(card.state).toBe('first-work');
    expect(card.headline).toBe('This device has work ready to back up.');
  });

  it('Unknown cold start: backup exists but the counter is unknown', () => {
    const card = deriveSafetyCard(
      base({ cue: { counter: 'unknown', lastBackupAt: '2026-07-01T00:00:00.000Z', lastBackupHash: null } }),
    );
    expect(card.state).toBe('unknown');
    expect(card.headline).toBe('Back up once to make this device current.');
  });

  it('Fresh: zero counter and matching hash', () => {
    const card = deriveSafetyCard(
      base({
        cue: { counter: 0, lastBackupAt: '2026-07-14T00:00:00.000Z', lastBackupHash: 'h' },
        hashMatch: true,
      }),
    );
    expect(card.state).toBe('fresh');
    expect(card.headline).toBe('Everything you have is backed up.');
  });

  it('a zero counter with a hash mismatch is NEVER calm (backstop wins)', () => {
    const card = deriveSafetyCard(
      base({
        cue: { counter: 0, lastBackupAt: '2026-07-14T00:00:00.000Z', lastBackupHash: 'h' },
        hashMatch: false,
      }),
    );
    expect(card.state).not.toBe('fresh');
    expect(card.headline).toBe('Back up once to make this device current.');
  });

  it('Working ahead: pluralizes and caps at many', () => {
    const withCounter = (n: number) =>
      deriveSafetyCard(
        base({
          cue: { counter: n, lastBackupAt: '2026-07-14T00:00:00.000Z', lastBackupHash: 'h' },
          hashMatch: false,
        }),
      );
    expect(withCounter(3).headline).toBe('3 changes are ready to back up.');
    expect(withCounter(1).headline).toBe('1 change is ready to back up.');
    expect(withCounter(100).headline).toBe('Many changes are ready to back up.');
  });

  it('Just backed up: headline claims only the file, receipt names it without a location claim', () => {
    const card = deriveSafetyCard(
      base({
        activity: 'just-backed-up',
        lastBackupFilename: 'resilience-toolkit-backup-2026-07-18.json',
        cue: { counter: 0, lastBackupAt: '2026-07-18T10:00:00.000Z', lastBackupHash: 'h' },
        hashMatch: true,
      }),
    );
    expect(card.headline).toBe('Your backup file is made.');
    const receipt = card.receipt.join(' ');
    expect(receipt).toContain('resilience-toolkit-backup-2026-07-18.json');
    // The location claim is dropped: the transport cannot know where a browser
    // put the file. An honest find-it fallback only.
    expect(receipt).not.toContain('Downloads');
    expect(receipt).toContain('If you cannot find it, back up again.');
  });

  it('Fresh on the plain-anchor transport persists the caution line (never a confirmed calm)', () => {
    const card = deriveSafetyCard(
      base({
        cue: {
          counter: 0,
          lastBackupAt: '2026-07-14T00:00:00.000Z',
          lastBackupHash: 'h',
          lastBackupTransport: 'anchor',
        },
        hashMatch: true,
      }),
    );
    expect(card.state).toBe('fresh');
    expect(card.receipt.join(' ')).toContain('If you cannot find the file, back up again.');
    expect(card.receipt.join(' ')).not.toContain('Downloads');
  });

  it('Fresh on a signal-bearing transport carries only the date', () => {
    const card = deriveSafetyCard(
      base({
        cue: {
          counter: 0,
          lastBackupAt: '2026-07-14T00:00:00.000Z',
          lastBackupHash: 'h',
          lastBackupTransport: 'share',
        },
        hashMatch: true,
      }),
    );
    expect(card.receipt.join(' ')).not.toContain('Downloads');
  });

  it('the persistent receipt carries the date but never the location claim', () => {
    const card = deriveSafetyCard(
      base({
        cue: { counter: 2, lastBackupAt: '2026-07-14T00:00:00.000Z', lastBackupHash: 'h' },
        hashMatch: false,
      }),
    );
    const receipt = card.receipt.join(' ');
    expect(receipt).toContain('July');
    expect(receipt).not.toContain('Downloads');
  });

  it('Backup failed: calm receipt in the same breath, no blame', () => {
    const card = deriveSafetyCard(base({ activity: 'failed' }));
    expect(card.headline).toBe('That backup did not finish.');
    expect(card.receipt.join(' ')).toContain('Nothing was lost; your work is still on this device.');
  });

  it('Share failed: its own honest message, never the backup-failure wording', () => {
    const card = deriveSafetyCard(base({ activity: 'share-failed' }));
    expect(card.state).toBe('share-failed');
    expect(card.headline).toBe('That copy did not send.');
    // A failed share must not borrow the failed-backup headline.
    expect(card.headline).not.toBe('That backup did not finish.');
    expect(card.receipt.join(' ')).toContain('You can back it up instead.');
  });

  it('Just restored: work is back, counts live in the receipt not the headline', () => {
    const card = deriveSafetyCard(
      base({
        activity: 'just-restored',
        restoredCounts: { todos: 6, tables: 214 },
      }),
    );
    expect(card.headline).toBe('Your work is back.');
    expect(card.headline).not.toMatch(/\d/);
    expect(card.receipt.join(' ')).toContain('214 saved rows');
    expect(card.receipt.join(' ')).toContain('6 checked items');
  });

  it('Backing up: the headline freezes (base sentence), the button carries the working state', () => {
    const card = deriveSafetyCard(
      base({
        activity: 'backing-up',
        cue: { counter: 3, lastBackupAt: '2026-07-14T00:00:00.000Z', lastBackupHash: 'h' },
        hashMatch: false,
      }),
    );
    expect(card.headline).toBe('3 changes are ready to back up.');
    expect(card.buttonState).toBe('working');
  });
});

describe('overlay contract', () => {
  it('Loss detected replaces the headline with the calm short form', () => {
    const card = deriveSafetyCard(base({ overlays: { loss: true, full: false, atRisk: false, offline: false } }));
    expect(card.headline).toBe('Some saved work may be missing.');
    expect(card.receipt.join(' ')).toContain("This is the browser's doing, not yours.");
  });

  it('Full device replaces the headline', () => {
    const card = deriveSafetyCard(base({ overlays: { loss: false, full: true, atRisk: false, offline: false } }));
    expect(card.headline).toBe('This device is low on space.');
  });

  it('At risk and Offline never take the headline; they are quiet lines', () => {
    const card = deriveSafetyCard(
      base({
        overlays: { loss: false, full: false, atRisk: true, offline: true },
        cue: { counter: 2, lastBackupAt: '2026-07-14T00:00:00.000Z', lastBackupHash: 'h' },
        hashMatch: false,
      }),
    );
    expect(card.headline).toBe('2 changes are ready to back up.');
    expect(card.quietLines.length).toBeGreaterThan(0);
    expect(card.quietLines.join(' ')).toContain('clear saved work');
    expect(card.quietLines.join(' ')).toContain('offline');
    // Register cut (operator design review): the at-risk line no longer dangles.
    expect(card.quietLines.join(' ')).not.toContain('matters more');
  });

  it('multiple overlays: loss leads, the rest collapse to quiet lines', () => {
    const card = deriveSafetyCard(
      base({ overlays: { loss: true, full: true, atRisk: true, offline: false } }),
    );
    expect(card.headline).toBe('Some saved work may be missing.');
    expect(card.quietLines.join(' ')).toContain('low on space');
  });

  it('the headline never claims calm while a replacing overlay holds', () => {
    const card = deriveSafetyCard(
      base({
        overlays: { loss: false, full: true, atRisk: false, offline: false },
        cue: { counter: 0, lastBackupAt: '2026-07-14T00:00:00.000Z', lastBackupHash: 'h' },
        hashMatch: true,
      }),
    );
    expect(card.headline).not.toBe('Everything you have is backed up.');
  });
});

describe('register rules', () => {
  it('no em or en dashes in any produced string, any state', () => {
    const variants: SafetyCardInputs[] = [
      base({ counts: noWork }),
      base(),
      base({ activity: 'failed' }),
      base({ activity: 'share-failed' }),
      base({ activity: 'just-backed-up', lastBackupFilename: 'f.json' }),
      base({ overlays: { loss: true, full: true, atRisk: true, offline: true } }),
      base({
        cue: { counter: 0, lastBackupAt: '2026-07-14T00:00:00.000Z', lastBackupHash: 'h' },
        hashMatch: true,
      }),
    ];
    for (const v of variants) {
      const card = deriveSafetyCard(v);
      const all = [card.headline, ...card.receipt, ...card.quietLines].join(' ');
      expect(all).not.toMatch(/[–—]/);
    }
  });
});

describe('module-card backup line (the shared cue line, never time-based)', () => {
  it('never backed up', () => {
    expect(
      moduleCardBackupLine({ counter: 'unknown', lastBackupAt: null, lastBackupHash: null }),
    ).toBe('You have not backed up yet.');
  });

  it('changes since, in the one unit grammar', () => {
    const line = moduleCardBackupLine({
      counter: 3,
      lastBackupAt: '2026-07-14T00:00:00.000Z',
      lastBackupHash: 'h',
    });
    expect(line).toContain('Last backup:');
    expect(line).toContain('3 changes since.');
  });

  it('zero counter states the date without a time-based nudge', () => {
    const line = moduleCardBackupLine({
      counter: 0,
      lastBackupAt: '2026-01-04T00:00:00.000Z',
      lastBackupHash: 'h',
    });
    expect(line).toContain('Last backup:');
    expect(line).not.toContain('fresh backup');
    expect(line).not.toContain('since');
  });

  it('unknown counter invites one backup, no false calm and no false alarm', () => {
    const line = moduleCardBackupLine({
      counter: 'unknown',
      lastBackupAt: '2026-07-01T00:00:00.000Z',
      lastBackupHash: null,
    });
    expect(line).toContain('Back up once to make this current.');
  });
});

describe('honest meter', () => {
  const snapshot = {
    todos: [
      { id: 'knowing-community-a', moduleKey: 'knowing-community', todoId: 'a', completed: true },
      { id: 'mutual-aid-b', moduleKey: 'mutual-aid', todoId: 'b', completed: false },
      { id: 'mutual-aid-c', moduleKey: 'mutual-aid', todoId: 'c', completed: true },
    ],
    tables: [
      {
        id: 'knowing-community-t-r1',
        moduleKey: 'knowing-community',
        tableId: 't',
        rowId: 'r1',
        data: { col: 'value' },
        updatedAt: '2026-07-18T00:00:00.000Z',
      },
    ],
    metadata: { personalNotes: 'some notes' },
  };

  it('groups leaf modules under the three top-level modules, in order', () => {
    const meter = computeWorkMeter(snapshot as any);

    // The single child that shares its parent's display name folds into the
    // subtotal instead of self-nesting an identical "Knowing Your Community".
    const knowing = meter.groups.find((g) => g.key === 'knowing-your-community')!;
    expect(knowing.name).toBe('Knowing Your Community');
    expect(knowing.detail).toBe('1 checked item · 1 saved row');
    expect(knowing.leaves).toHaveLength(0);

    // A distinct child is listed under its parent with the parent carrying the
    // subtotal.
    const emergency = meter.groups.find((g) => g.key === 'emergency-preparedness')!;
    expect(emergency.detail).toBe('2 checked items');
    expect(emergency.leaves.map((l) => l.name)).toEqual(['Mutual Aid']);
    expect(emergency.leaves[0].detail).toBe('2 checked items');

    // Order matches PARENT_ORDER, with the notes group last.
    expect(meter.groups.map((g) => g.key)).toEqual([
      'knowing-your-community',
      'emergency-preparedness',
      'personal-notes',
    ]);

    expect(meter.total.detail).toBe('3 checked items · 1 saved row');
    expect(meter.total.bytes).toBeGreaterThan(0);
  });

  it('includes personal notes as its own group when notes exist', () => {
    const meter = computeWorkMeter(snapshot as any);
    expect(meter.groups.some((g) => g.name === 'Personal notes')).toBe(true);
    const empty = computeWorkMeter({ todos: [], tables: [], metadata: {} } as any);
    expect(empty.groups).toHaveLength(0);
  });

  it('formats byte sizes in human units', () => {
    expect(formatByteSize(0)).toBe('0 B');
    expect(formatByteSize(11264)).toBe('11 KB');
  });

  it('a snapshot of only blank scaffold rows reports zero saved rows (the empty-row meter bug)', () => {
    // The 2026-07-04 legacy backup, projected through the canonical snapshot:
    // every input cell blank, only the readonly template question filled.
    const scaffold = buildWorkSnapshot({
      todos: [],
      tables: [
        {
          id: 'knowing-community-place-characteristics-r1',
          moduleKey: 'knowing-community',
          tableId: 'place-characteristics',
          data: { Question: 'Who do people listen to?', 'Your Response': '' },
        },
        {
          id: 'knowing-community-place-characteristics-r2',
          moduleKey: 'knowing-community',
          tableId: 'place-characteristics',
          data: { Question: 'What matters here?', 'Your Response': '' },
        },
      ],
      metadata: {},
    });
    const meter = computeWorkMeter(scaffold);
    expect(meter.groups).toHaveLength(0);
    expect(meter.total.detail).toBe('nothing saved yet');
  });
});

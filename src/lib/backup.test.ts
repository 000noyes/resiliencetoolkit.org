/**
 * backup.ts helpers — the legacy last-backup localStorage read.
 *
 * lastBackupAt() is the presentation-layer read over the legacy
 * LAST_BACKUP_KEY that older builds stamped; the metadata-store timestamp is
 * the authoritative record (see backup-cue.ts). An unreadable or absent key
 * reads as null. The old time-based isBackupFresh() suppression was retired
 * by the work-based cue (reconciliation R1); the transport-gated stamping
 * paths are covered in backup-transports.test.ts.
 *
 * Run: pnpm vitest run src/lib/backup.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lastBackupAt, LAST_BACKUP_KEY } from './backup';

beforeEach(() => {
  localStorage.clear();
});

describe('lastBackupAt', () => {
  it('returns null when the key is absent', () => {
    expect(lastBackupAt()).toBeNull();
  });

  it('returns epoch ms for a valid ISO timestamp', () => {
    const iso = '2026-07-01T00:00:00.000Z';
    localStorage.setItem(LAST_BACKUP_KEY, iso);
    expect(lastBackupAt()).toBe(Date.parse(iso));
  });

  it('returns null for a corrupt value', () => {
    localStorage.setItem(LAST_BACKUP_KEY, 'not-a-date');
    expect(lastBackupAt()).toBeNull();
  });
});

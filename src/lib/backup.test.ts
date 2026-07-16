/**
 * backup.ts helpers — the 14-day post-backup soft-suppression read.
 *
 * lastBackupAt()/isBackupFresh() are presentation-layer reads over the existing
 * LAST_BACKUP_KEY that downloadFullBackup() stamps. An unreadable or absent key
 * counts as NOT fresh (fail toward honesty: the reminder shows).
 *
 * Run: pnpm vitest run src/lib/backup.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lastBackupAt, isBackupFresh, LAST_BACKUP_KEY, LAST_BACKUP_MAX_AGE_MS } from './backup';

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

describe('isBackupFresh', () => {
  const now = Date.parse('2026-07-15T00:00:00.000Z');

  it('is fresh within the 14-day window', () => {
    localStorage.setItem(LAST_BACKUP_KEY, '2026-07-10T00:00:00.000Z'); // 5 days ago
    expect(isBackupFresh(now)).toBe(true);
  });

  it('is stale beyond the 14-day window', () => {
    localStorage.setItem(LAST_BACKUP_KEY, '2026-06-01T00:00:00.000Z'); // > 14 days ago
    expect(isBackupFresh(now)).toBe(false);
  });

  it('counts an absent key as NOT fresh (reminder shows)', () => {
    expect(isBackupFresh(now)).toBe(false);
  });

  it('counts a corrupt key as NOT fresh', () => {
    localStorage.setItem(LAST_BACKUP_KEY, 'garbage');
    expect(isBackupFresh(now)).toBe(false);
  });

  it('honors a custom maxAgeMs', () => {
    localStorage.setItem(LAST_BACKUP_KEY, '2026-07-14T00:00:00.000Z'); // 1 day ago
    expect(isBackupFresh(now, 12 * 60 * 60 * 1000)).toBe(false); // 12h window
    expect(isBackupFresh(now, LAST_BACKUP_MAX_AGE_MS)).toBe(true);
  });
});

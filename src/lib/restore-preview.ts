/**
 * Restore preview — parse first, show what the file holds, then verdicts.
 *
 * Nothing here changes any data: this module reads a picked file's text and
 * derives what the preview card says. The load-bearing rule (eng review):
 * exact-count verdicts are shown ONLY when the file's lineage matches this
 * device's last recorded baseline; every other case uses the conservative
 * wording. Absence of the designed fields means only that the preview shows
 * no date; it never means rejection: legacy backups import forever.
 */
import type { CueState } from '@/lib/backup-cue';
import { countNoun, formatReceiptDate } from '@/lib/safety-card-state';
import { rowHasWork } from '@/lib/work-predicate';

export type ParseErrorKind = 'not-json' | 'not-a-backup';

export interface ParsedBackupLineage {
  backupDeviceId: string | null;
  backupCounter: number | null;
  backupSnapshotHash: string | null;
}

export interface ParsedBackup {
  todos: Array<{ id: string; moduleKey?: string; completed?: boolean }>;
  tables: Array<{ id: string; moduleKey?: string; tableId?: string; data?: Record<string, string> }>;
  metadata: Record<string, unknown>;
  /** The file's own timestamp, or null for legacy files (never a rejection). */
  exportedAt: string | null;
  lineage: ParsedBackupLineage;
  /** The raw parsed object, handed to importAllData unchanged. */
  raw: unknown;
}

export type ParseResult = { ok: true; data: ParsedBackup } | { ok: false; error: ParseErrorKind };

/** Parse a picked file's text. Kind failures, never raw stacks. */
export function parseBackupFile(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'not-a-backup' };
  }
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.todos) || !Array.isArray(obj.tables)) {
    return { ok: false, error: 'not-a-backup' };
  }

  const exportedAtRaw = obj.exportedAt;
  const exportedAt =
    typeof exportedAtRaw === 'string' && Number.isFinite(Date.parse(exportedAtRaw))
      ? exportedAtRaw
      : null;

  return {
    ok: true,
    data: {
      todos: obj.todos as ParsedBackup['todos'],
      tables: obj.tables as ParsedBackup['tables'],
      metadata:
        obj.metadata && typeof obj.metadata === 'object' && !Array.isArray(obj.metadata)
          ? (obj.metadata as Record<string, unknown>)
          : {},
      exportedAt,
      lineage: {
        backupDeviceId: typeof obj.backupDeviceId === 'string' ? obj.backupDeviceId : null,
        backupCounter: typeof obj.backupCounter === 'number' ? obj.backupCounter : null,
        backupSnapshotHash:
          typeof obj.backupSnapshotHash === 'string' ? obj.backupSnapshotHash : null,
      },
      raw: parsed,
    },
  };
}

export interface DeviceStateForPreview {
  deviceId: string | null;
  cue: CueState;
  /** Composite ids of every todo and table row on this device. */
  ids: ReadonlySet<string>;
  /** moduleKeys present on this device. */
  moduleKeys: ReadonlySet<string>;
}

export interface RestorePreview {
  /** "This backup holds 6 modules, 214 saved rows, 96 checked items." */
  summary: string;
  /** The file's own date, or null (legacy: show no date, never reject). */
  madeAt: string | null;
  /** One sentence per applicable verdict, stacking when several hold. */
  verdicts: string[];
  /** The partial-file gate sentence, or null. */
  partialWarning: string | null;
  /** When true, Replace demotes to the outline style and the backup-first
   * hatch takes the filled slot. */
  demoteReplace: boolean;
}

/** Table rows that hold saved work; blank scaffold rows are not counted. */
function workTablesOf(data: ParsedBackup): ParsedBackup['tables'] {
  return data.tables.filter((r) =>
    rowHasWork({ moduleKey: r.moduleKey ?? '', tableId: r.tableId ?? '', data: r.data ?? {} }),
  );
}

function moduleKeysOf(
  todos: ParsedBackup['todos'],
  tables: ParsedBackup['tables'],
): Set<string> {
  const keys = new Set<string>();
  for (const t of todos) if (t.moduleKey) keys.add(t.moduleKey);
  for (const r of tables) if (r.moduleKey) keys.add(r.moduleKey);
  return keys;
}

/** Derive everything the preview card says. Pure; changes nothing. */
export function buildRestorePreview(
  data: ParsedBackup,
  device: DeviceStateForPreview,
): RestorePreview {
  // Count and describe only real work: a backup of blank scaffold rows should
  // not read as modules-and-rows of saved work, and a "checked item" means a
  // todo that is actually checked (completed), not merely a saved todo record
  // (an unchecked-then-saved todo is data but not a checked item). The raw rows
  // and every todo still import in full — this governs the count the preview
  // shows, never what is restored. The count matches the dashboard meter and
  // "Your progress" so all three ledgers agree.
  const workTables = workTablesOf(data);
  const checkedTodos = data.todos.filter((t) => t.completed === true);
  // Coverage set (every module the file carries any data for) drives the
  // partial-replace safety gate below; the summary counts real work only.
  const fileModules = moduleKeysOf(data.todos, workTables);
  const summaryModules = moduleKeysOf(checkedTodos, workTables);
  const parts = [
    checkedTodos.length > 0 || workTables.length > 0
      ? `${summaryModules.size} ${summaryModules.size === 1 ? 'module' : 'modules'}`
      : '',
    checkedTodos.length > 0 ? countNoun(checkedTodos.length, 'checked item') : '',
    workTables.length > 0 ? countNoun(workTables.length, 'saved row') : '',
  ].filter(Boolean);
  const summary = parts.length > 0 ? `This backup holds ${parts.join(', ')}.` : 'This backup holds no saved work.';

  const deviceHasWork = device.ids.size > 0;
  const verdicts: string[] = [];
  let demoteReplace = false;

  // Lineage-baseline match: the previewed file is this device's own last
  // recorded backup, so direction is provable and counts are exact.
  const baselineMatch =
    data.lineage.backupSnapshotHash !== null &&
    device.cue.lastBackupHash !== null &&
    data.lineage.backupSnapshotHash === device.cue.lastBackupHash &&
    data.lineage.backupDeviceId !== null &&
    data.lineage.backupDeviceId === device.deviceId;

  if (baselineMatch) {
    if (typeof device.cue.counter === 'number' && device.cue.counter > 0) {
      const since = device.cue.lastBackupAt
        ? ` you made since ${formatReceiptDate(device.cue.lastBackupAt)}`
        : ' you made on this device';
      verdicts.push(`This file does not have the ${countNoun(device.cue.counter, 'change')}${since}.`);
      demoteReplace = true;
    }
    // counter 0 on a baseline match: identical content, nothing to warn about.
  } else if (deviceHasWork) {
    verdicts.push(
      'This backup may not include newer work on this device. Back up this device first if you want to keep it.',
    );
    demoteReplace = true;
  }

  // Provable by id difference, composes with the verdict above. Only real work
  // counts: a blank scaffold row the device lacks is not work it is missing.
  let fileOnly = 0;
  for (const t of data.todos) if (!device.ids.has(t.id)) fileOnly++;
  for (const r of workTables) if (!device.ids.has(r.id)) fileOnly++;
  if (fileOnly > 0 && deviceHasWork) {
    verdicts.push('This file holds work this device does not.');
  }

  // The partial-file gate: a file holding fewer modules than the device
  // replaces the whole device and silently drops the rest. Say so loudly.
  let partialWarning: string | null = null;
  const missingModules = Array.from(device.moduleKeys).filter((k) => !fileModules.has(k));
  if (deviceHasWork && missingModules.length > 0 && fileModules.size > 0) {
    const total = device.moduleKeys.size;
    const kept = total - missingModules.length;
    partialWarning = `This file holds ${kept} of your ${total} modules; replacing removes the other ${missingModules.length}.`;
    demoteReplace = true;
  }

  return { summary, madeAt: data.exportedAt, verdicts, partialWarning, demoteReplace };
}

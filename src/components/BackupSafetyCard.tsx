import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { exportAllData, getMetadata, setMetadata } from '@/lib/storage';
import {
  buildWorkSnapshot,
  computeSnapshotHash,
  getCueState,
  readCanary,
  detectPossibleLoss,
  type CueState,
} from '@/lib/backup-cue';
import {
  deriveSafetyCard,
  computeWorkMeter,
  formatByteSize,
  type CardActivity,
  type OverlayInput,
  type WorkCountsInput,
  type WorkMeter,
} from '@/lib/safety-card-state';
import { checkStorageHealth, STORAGE_HEALTH_EVENT } from '@/lib/storageHealth';
import { downloadFullBackup, shareBackup } from '@/lib/backup';

/**
 * The dashboard safety zone: the answer first, at display scale.
 *
 * Zones 1 and 2 of the reviewed design live in this one island so a single
 * IndexedDB read pass serves the state sentence, the calm gate, and the
 * honest meter. The pre-hydration server shell renders the honest generic
 * words and the pinned button with no implied calm, so a JS failure degrades
 * to true words instead of a blank box (DR8).
 *
 * The snapshot hash is computed here and only here: the dashboard is the calm
 * gate, so ordinary page loads never pay a full-data hash.
 */

interface LoadedState {
  cue: CueState;
  counts: WorkCountsInput;
  hashMatch: boolean | null;
  currentHash: string | null;
  meter: WorkMeter;
}

export default function BackupSafetyCard() {
  const [loaded, setLoaded] = useState<LoadedState | null>(null);
  const [overlays, setOverlays] = useState<OverlayInput>({
    loss: false,
    full: false,
    atRisk: false,
    offline: false,
  });
  const [activity, setActivity] = useState<CardActivity>('idle');
  const [lastBackupFilename, setLastBackupFilename] = useState<string | undefined>(undefined);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [shareCaution, setShareCaution] = useState<'closed' | 'open'>('closed');
  const [deviceName, setDeviceName] = useState<string>('');
  const [namingDevice, setNamingDevice] = useState(false);
  const [restoredCounts, setRestoredCounts] = useState<
    { todos: number; tables: number; madeAt?: string | null } | undefined
  >(undefined);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    try {
      const [cue, data, health] = [
        await getCueState(),
        await exportAllData(),
        await checkStorageHealth(),
      ];
      const snapshot = buildWorkSnapshot(data);
      const counts: WorkCountsInput = {
        todos: snapshot.todos.length,
        tables: snapshot.tables.length,
        hasNotes:
          typeof snapshot.metadata['personalNotes'] === 'string' &&
          (snapshot.metadata['personalNotes'] as string).length > 0,
      };
      let currentHash: string | null = null;
      let hashMatch: boolean | null = null;
      try {
        currentHash = await computeSnapshotHash(snapshot);
        hashMatch = cue.lastBackupHash !== null ? currentHash === cue.lastBackupHash : null;
      } catch {
        // No SubtleCrypto (very old browser): the counter alone drives the
        // cue and calm stays unclaimed, which fails toward honesty.
      }
      const loss = detectPossibleLoss(readCanary(), counts);
      const rawName = await getMetadata('deviceName').catch(() => undefined);
      if (requestId !== requestRef.current) return; // a newer refresh superseded this one
      setDeviceName(typeof rawName === 'string' ? rawName : '');
      setLoaded({ cue, counts, hashMatch, currentHash, meter: computeWorkMeter(snapshot) });
      setOverlays({
        loss,
        full: health.status === 'full',
        atRisk: health.status === 'at-risk',
        offline: typeof navigator !== 'undefined' && navigator.onLine === false,
      });
    } catch {
      // Storage unreadable: keep the generic shell (true words, no state claim).
    }
  }, []);

  useEffect(() => {
    refresh();
    // The restore dialog's success hands off to this card across its reload:
    // one story in two surfaces.
    try {
      const marker = sessionStorage.getItem('rt-just-restored');
      if (marker) {
        sessionStorage.removeItem('rt-just-restored');
        const parsed = JSON.parse(marker);
        if (parsed && typeof parsed === 'object') {
          setRestoredCounts({
            todos: typeof parsed.todos === 'number' ? parsed.todos : 0,
            tables: typeof parsed.tables === 'number' ? parsed.tables : 0,
            madeAt: typeof parsed.madeAt === 'string' ? parsed.madeAt : null,
          });
          setActivity('just-restored');
        }
      }
    } catch {
      // no marker, or storage unavailable: the card simply shows live state
    }
    try {
      // Only offer Send a copy where the native share sheet genuinely does
      // something: a device with touch input AND real file-share support. On a
      // plain desktop (no touch) share({files}) has no useful target and would
      // only duplicate Back up my work, so the button stays hidden there. This
      // reads capability (touch presence + canShare), never an unreliable
      // desktop-vs-mobile user-agent guess. A touch device whose share still
      // fails at click time is caught by the download fallback in shareBackup.
      const probe = new File(['x'], 'probe.json', { type: 'application/json' });
      const touchCapable =
        typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
      setCanShareFiles(
        touchCapable &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [probe] }),
      );
    } catch {
      setCanShareFiles(false);
    }
    const onHealth = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onNetwork = () =>
      setOverlays((prev) => ({ ...prev, offline: navigator.onLine === false }));
    document.addEventListener(STORAGE_HEALTH_EVENT, onHealth);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onNetwork);
    window.addEventListener('offline', onNetwork);
    return () => {
      document.removeEventListener(STORAGE_HEALTH_EVENT, onHealth);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onNetwork);
      window.removeEventListener('offline', onNetwork);
    };
  }, [refresh]);

  async function handleBackup() {
    setActivity('backing-up');
    try {
      const result = await downloadFullBackup();
      if (!result.completed) {
        // Canceled save dialog: a quiet no-op, never an error state.
        setActivity('idle');
        return;
      }
      setLastBackupFilename(result.filename ?? undefined);
      setActivity('just-backed-up');
      await refresh();
    } catch (error) {
      console.error('[BackupSafetyCard] backup failed:', error);
      setActivity('failed');
      await refresh();
    }
  }

  async function handleShareRequest() {
    // One-time caution interstitial BEFORE share(), so the reject-on-cancel
    // completion signal survives (DR2 guard 2).
    const shown = await getMetadata('shareCautionShown').catch(() => undefined);
    if (shown === undefined) {
      setShareCaution('open');
      return;
    }
    await runShare();
  }

  async function runShare() {
    setShareCaution('closed');
    try {
      await setMetadata('shareCautionShown', new Date().toISOString());
    } catch {
      // the interstitial simply shows again next time
    }
    setActivity('backing-up');
    try {
      const result = await shareBackup();
      if (!result.completed) {
        // Dismissed share sheet: a quiet no-op, never an error state.
        setActivity('idle');
        return;
      }
      if (result.transport === 'share') {
        // The copy left for another device; the calm cue tells the rest.
        setActivity('idle');
      } else {
        // File share was unavailable, so the copy came down as a download:
        // show the same made-a-file receipt the backup button shows.
        setLastBackupFilename(result.filename ?? undefined);
        setActivity('just-backed-up');
      }
      await refresh();
    } catch (error) {
      console.error('[BackupSafetyCard] share failed:', error);
      setActivity('share-failed');
      await refresh();
    }
  }

  async function saveDeviceName(name: string) {
    setNamingDevice(false);
    const trimmed = name.trim();
    try {
      await setMetadata('deviceName', trimmed);
      setDeviceName(trimmed);
    } catch {
      // metadata unavailable; the name is a nicety
    }
  }

  // Pre-hydration / JS-degraded / storage-unreadable shell: honest generic
  // words, the pinned button, no state claim, no implied calm.
  if (!loaded) {
    return (
      <div data-testid="rt-safety-card">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Backup status
        </h2>
        <p
          data-testid="rt-safety-headline"
          className="mt-2 text-2xl sm:text-3xl font-medium text-foreground"
          style={{ textWrap: 'balance' }}
        >
          Your work is saved on this device, and only here.
        </p>
        <p data-testid="rt-safety-receipt" className="mt-2 text-sm text-muted-foreground max-w-prose">
          Back it up so you can restore it later, here or on another device.
        </p>
        <BackupButton state="ready" onClick={handleBackup} />
      </div>
    );
  }

  const card = deriveSafetyCard({
    cue: loaded.cue,
    counts: loaded.counts,
    hashMatch: loaded.hashMatch,
    overlays,
    activity,
    lastBackupFilename,
    restoredCounts,
  });

  const showBackupHygiene = card.state === 'fresh' || card.state === 'just-backed-up';
  const { meter } = loaded;
  const hasMeter = meter.groups.length > 0;

  return (
    <div data-testid="rt-safety-card">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Backup status
      </h2>
      <p
        data-testid="rt-safety-headline"
        className="mt-2 text-2xl sm:text-3xl font-medium text-foreground"
        style={{ textWrap: 'balance' }}
      >
        {card.headline}
      </p>
      {card.receipt.length > 0 && (
        <p data-testid="rt-safety-receipt" className="mt-2 text-sm text-muted-foreground max-w-prose">
          {card.receipt.join(' ')}
        </p>
      )}

      {/* An empty device has nothing to back up, so the action row is hidden:
          the empty state points to the Start-a-module list and Restore below
          instead. The pre-hydration shell above still pins the button, since it
          cannot yet read whether any work exists. */}
      {card.state !== 'empty' && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <BackupButton state={card.buttonState} onClick={handleBackup} />
          {canShareFiles && (
            <button
              type="button"
              data-testid="rt-share-button"
              onClick={handleShareRequest}
              disabled={card.buttonState === 'working'}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-60 transition-colors"
              style={{ minHeight: 44 }}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Send a copy
            </button>
          )}
        </div>
      )}

      {card.state !== 'empty' && (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="rt-device-name">
          {namingDevice ? (
            <NameDeviceInput initial={deviceName} onSave={saveDeviceName} onCancel={() => setNamingDevice(false)} />
          ) : deviceName ? (
            <>
              Named {deviceName}. Your backups carry the name.{' '}
              <button type="button" className="underline underline-offset-2" onClick={() => setNamingDevice(true)}>
                Rename
              </button>
            </>
          ) : (
            <>
              <button type="button" className="underline underline-offset-2" onClick={() => setNamingDevice(true)}>
                Name this device
              </button>{' '}
              to label your backups.
            </>
          )}
        </p>
      )}

      {shareCaution === 'open' && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShareCaution('closed');
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Before you send a copy"
            className="bg-card border border-border w-full sm:max-w-md sm:rounded-xl rounded-t-xl p-6 shadow-xl"
            data-testid="rt-share-caution"
          >
            <h3 className="text-lg font-semibold text-foreground">Before you send a copy</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Send this file only to a device you own, like your own laptop or your own private
              inbox. Once it leaves this device you cannot call it back, and your backup can hold
              names and phone numbers you typed.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={runShare}
                className="w-full px-4 py-2.5 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Send to a device I own
              </button>
              <button
                type="button"
                onClick={() => setShareCaution('closed')}
                className="w-full px-4 py-2.5 rounded-lg font-medium text-sm border border-border text-foreground hover:bg-muted transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackupHygiene && (
        <p className="mt-2 text-xs text-muted-foreground max-w-prose" data-testid="rt-keep-a-copy">
          Keep a copy on another device you own too.
        </p>
      )}
      {card.quietLines.map((line) => (
        <p key={line} className="mt-2 text-xs text-muted-foreground" data-testid="rt-quiet-line">
          {line}
        </p>
      ))}

      {hasMeter && (
        <section className="mt-8" data-testid="rt-meter" aria-label="Work on this device">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Work on this device
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Everything here goes into your backup.</p>

          {/* Desktop and tablet: the table form */}
          <div className="mt-3 hidden sm:block rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="text-left font-medium text-muted-foreground px-4 py-2.5">
                    On this device
                  </th>
                  <th scope="col" className="text-right font-medium text-muted-foreground px-4 py-2.5">
                    Saved work
                  </th>
                  <th scope="col" className="text-right font-medium text-muted-foreground px-4 py-2.5">
                    Size
                  </th>
                </tr>
              </thead>
              <tbody>
                {meter.groups.map((group) => (
                  <React.Fragment key={group.key}>
                    <tr className="border-b border-border">
                      <td className="px-4 py-2.5 font-medium text-foreground">{group.name}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-foreground tabular-nums">
                        {group.detail}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-foreground tabular-nums">
                        {formatByteSize(group.bytes)}
                      </td>
                    </tr>
                    {group.leaves.map((leaf) => (
                      <tr key={leaf.moduleKey ?? leaf.name} className="border-b border-border">
                        <td className="px-4 py-2 pl-8 text-muted-foreground">{leaf.name}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                          {leaf.detail}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                          {formatByteSize(leaf.bytes)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium text-foreground">{meter.total.name}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-foreground tabular-nums">
                    {meter.total.detail}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-foreground tabular-nums">
                    {formatByteSize(meter.total.bytes)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Small screens: the ledger-row form */}
          <ul className="mt-3 sm:hidden rounded-lg border border-border bg-card divide-y divide-border">
            {meter.groups.map((group) => (
              <li key={group.key} className="px-4 py-2.5">
                <span className="block text-sm font-medium text-foreground">{group.name}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {group.detail} · {formatByteSize(group.bytes)}
                </span>
                {group.leaves.length > 0 && (
                  <ul className="mt-1.5 ml-3 border-l border-border pl-3 space-y-1">
                    {group.leaves.map((leaf) => (
                      <li key={leaf.moduleKey ?? leaf.name}>
                        <span className="block text-sm text-foreground">{leaf.name}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {leaf.detail} · {formatByteSize(leaf.bytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            <li className="px-4 py-2.5">
              <span className="block text-sm font-medium text-foreground">
                {meter.total.name}: {meter.total.detail} · {formatByteSize(meter.total.bytes)}
              </span>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}

function NameDeviceInput({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="text"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(value);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Kitchen laptop"
        aria-label="Device name"
        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
      />
      <button type="button" className="underline underline-offset-2" onClick={() => onSave(value)}>
        Save
      </button>
      <button type="button" className="underline underline-offset-2" onClick={onCancel}>
        Cancel
      </button>
    </span>
  );
}

function BackupButton({
  state,
  onClick,
}: {
  state: 'ready' | 'working';
  onClick: (() => void) | undefined;
}) {
  return (
    <button
      type="button"
      data-testid="rt-backup-button"
      onClick={onClick}
      disabled={state === 'working'}
      className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      style={{ minHeight: 44 }}
    >
      {state === 'working' ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Backing up...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" aria-hidden="true" />
          Back up my work
        </>
      )}
    </button>
  );
}

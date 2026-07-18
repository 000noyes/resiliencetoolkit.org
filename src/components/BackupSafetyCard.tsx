import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { exportAllData } from '@/lib/storage';
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
import { downloadFullBackup } from '@/lib/backup';

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
      if (requestId !== requestRef.current) return; // a newer refresh superseded this one
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
      const ts = await downloadFullBackup();
      setLastBackupFilename(`resilience-toolkit-backup-${ts.split('T')[0]}.json`);
      setActivity('just-backed-up');
      await refresh();
    } catch (error) {
      console.error('[BackupSafetyCard] backup failed:', error);
      setActivity('failed');
      await refresh();
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
          A backup is a file you keep. Back up to keep a copy you can bring back on this or another
          device.
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
  });

  const showFireDrill = card.state === 'fresh' || card.state === 'just-backed-up';
  const showKeepACopy = card.state === 'fresh' || card.state === 'just-backed-up';
  const showHomeScreenNudge = card.state === 'empty' || card.state === 'first-work';
  const { meter } = loaded;
  const hasMeter = meter.rows.length > 0;

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

      {card.state === 'empty' ? (
        <a
          href="/modules"
          data-testid="rt-safety-explore-link"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          style={{ minHeight: 44 }}
        >
          Explore the modules
        </a>
      ) : (
        <BackupButton state={card.buttonState} onClick={handleBackup} />
      )}

      {showKeepACopy && (
        <p className="mt-3 text-xs text-muted-foreground max-w-prose" data-testid="rt-keep-a-copy">
          Keep a copy on another device you own too, so it does not drown with this one. If this
          device holds neighbor lists or a phone tree, keep that copy somewhere private, not a
          shared inbox.
        </p>
      )}
      {showFireDrill && (
        <p className="mt-2 text-xs text-muted-foreground max-w-prose" data-testid="rt-fire-drill">
          Want to be sure the file works? Restore below shows what a backup holds without changing
          anything.
        </p>
      )}
      {showHomeScreenNudge && (
        <p className="mt-3 text-xs text-muted-foreground max-w-prose" data-testid="rt-home-nudge">
          Tip: add this site to your home screen so it is easy to find again.
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

          {/* Desktop and tablet: the table form */}
          <div className="mt-3 hidden sm:block rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60">
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
                {meter.rows.map((row) => (
                  <tr key={row.name} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 text-foreground">{row.name}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {row.detail}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {formatByteSize(row.bytes)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/40">
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
            {meter.rows.map((row) => (
              <li key={row.name} className="px-4 py-2.5">
                <span className="block text-sm text-foreground">{row.name}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {row.detail} · {formatByteSize(row.bytes)}
                </span>
              </li>
            ))}
            <li className="px-4 py-2.5 bg-muted/40">
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
      className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
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

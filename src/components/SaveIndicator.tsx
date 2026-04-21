import { useEffect, useState } from 'react';

const SAVE_RECENT_THRESHOLD_MS = 30000;

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; at: Date }
  | { status: 'error'; message: string };

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function SaveIndicator({ state }: { state: SaveState }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (state.status !== 'saved') return;
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, [state]);

  if (state.status === 'idle') return null;

  if (state.status === 'saving') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="text-body-small animate-pulse"
        style={{ color: 'var(--muted-foreground)' }}
      >
        Saving...
      </span>
    );
  }

  if (state.status === 'error') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="text-body-small"
        style={{ color: 'var(--destructive)' }}
      >
        {state.message}
      </span>
    );
  }

  const elapsed = Date.now() - state.at.getTime();
  const isRecent = elapsed < SAVE_RECENT_THRESHOLD_MS;

  return (
    <span
      role="status"
      aria-live="polite"
      className="text-body-small"
      style={{ color: isRecent ? 'var(--ring)' : 'var(--muted-foreground)' }}
    >
      {isRecent ? 'Saved just now' : `Saved at ${formatTime(state.at)}`}
    </span>
  );
}

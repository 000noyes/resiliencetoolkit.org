import { useEffect, useState } from 'react';

export function InfoCalloutBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('rt-trust-acknowledged') === 'true') {
        setDismissed(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  if (dismissed) return null;

  return (
    <div
      style={{
        backgroundColor: 'color-mix(in srgb, var(--primary) 5%, transparent)',
        border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--spacing-sm)',
      }}
    >
      <svg
        style={{ width: 20, height: 20, color: 'var(--primary)', flexShrink: 0, marginTop: 2 }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--foreground)' }}>
        <strong>Your work saves on this device as you go.</strong> It stays private and works
        offline, and nothing goes to the cloud or to Google Drive. Back it up to keep a copy you
        can reload later.
      </p>
    </div>
  );
}

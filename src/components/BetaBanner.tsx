import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { isDismissed, setDismissed } from '@/lib/beta-banner';
import { getActiveNotice, NOTICE_CHANGED_EVENT } from '@/lib/notices';

function BetaBannerInner() {
  const [visible, setVisible] = useState(false);
  const [yielding, setYielding] = useState(false);

  useEffect(() => {
    if (!isDismissed()) setVisible(true);
    // One notice at a time: step aside while the update notice holds the
    // slot; return when it releases (refresh, dismissal, or withdrawal).
    const sync = () => setYielding(getActiveNotice() !== null);
    sync();
    document.addEventListener(NOTICE_CHANGED_EVENT, sync);
    return () => document.removeEventListener(NOTICE_CHANGED_EVENT, sync);
  }, []);

  const handleDismiss = () => {
    setDismissed();
    setVisible(false);
  };

  if (!visible || yielding) return null;

  return (
    <div
      className="bg-card border-b border-border no-print"
      role="region"
      aria-label="Site notice"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="relative flex items-center justify-center">
          <p className="text-sm text-foreground text-center pr-8">
            Contact us for support —{' '}
            <a
              href="mailto:resiliencetoolkit@gocros.org"
              className="text-primary hover:opacity-80 transition-opacity underline-offset-2 hover:underline"
            >
              resiliencetoolkit@gocros.org
            </a>
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-0 text-muted-foreground hover:text-foreground transition-colors p-2 -m-2"
            aria-label="Dismiss site notice"
            title="Dismiss"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BetaBanner() {
  return <BetaBannerInner />;
}

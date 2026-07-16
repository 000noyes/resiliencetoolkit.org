import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { isDismissed, setDismissed } from '@/lib/beta-banner';
import { useNoticeClaim } from '@/lib/useNoticeClaim';
import { dampNotice } from '@/lib/notices';

function BetaBannerInner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDismissed()) setVisible(true);
  }, []);

  // Contact is the lowest-priority claim: it wants the slot whenever it is
  // undismissed, and renders only while it is the winner (every other strip
  // outranks it). The hook subscribes to the registry so it returns the
  // moment the higher strip releases.
  const isWinner = useNoticeClaim('contact', visible);

  const handleDismiss = () => {
    setDismissed();
    dampNotice('contact');
    setVisible(false);
  };

  if (!visible || !isWinner) return null;

  return (
    <div
      className="bg-card border-b border-border no-print"
      role="region"
      aria-label="Site notice"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="relative flex items-center justify-center">
          <p
            className="text-sm text-foreground text-center pe-11"
            style={{ textWrap: 'balance' }}
          >
            Contact us for support at{' '}
            <a
              href="mailto:resiliencetoolkit@gocros.org"
              className="text-primary hover:opacity-80 transition-opacity underline-offset-2 hover:underline [overflow-wrap:anywhere]"
            >
              resiliencetoolkit@gocros.org
            </a>
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute end-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
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

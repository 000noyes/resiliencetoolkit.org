import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { isDismissed, setDismissed } from '@/lib/beta-banner';

function BetaBannerInner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDismissed()) setVisible(true);
  }, []);

  const handleDismiss = () => {
    setDismissed();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="bg-card border-b border-border no-print"
      role="region"
      aria-label="Site notice"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="relative flex items-center justify-center">
          <p className="text-sm text-foreground text-center pr-8">
            Your feedback shapes this site —{' '}
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

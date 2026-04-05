import { useState, useEffect } from 'react';
import { Megaphone, X, ArrowRight } from 'lucide-react';
import { getSortedEntries } from '../../data/changelog';

const STORAGE_KEY = 'lastSeenChangelogId';

function WhatsNewBannerInner() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [latestId, setLatestId] = useState('');

  useEffect(() => {
    const entries = getSortedEntries();
    if (entries.length === 0) return;

    const latest = entries[0];
    const lastSeen = localStorage.getItem(STORAGE_KEY);

    if (!lastSeen || latest.id > lastSeen) {
      setTitle(latest.title);
      setSummary(latest.summary[0] || '');
      setLatestId(latest.id);
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, latestId);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="bg-primary/5 border-b border-primary/20 no-print">
      <div className="container mx-auto px-4 py-3">
        <div className="relative flex items-center justify-center">
          <div className="text-center pr-8">
            <p className="text-sm text-foreground">
              <Megaphone className="inline w-4 h-4 text-primary mr-1.5 -mt-0.5" strokeWidth={1.5} />
              <span className="font-medium">What's New:</span>{' '}
              {title}{summary ? ` — ${summary}` : ''}{' '}
              <a
                href="/changelog"
                className="inline-flex items-center gap-0.5 font-medium text-primary hover:text-primary/80 transition-opacity"
              >
                View changelog
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </a>
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="absolute right-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss new updates notification"
            title="Dismiss"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper to prevent Astro's renderer probe from invoking hooks directly.
 */
export default function WhatsNewBanner() {
  return <WhatsNewBannerInner />;
}

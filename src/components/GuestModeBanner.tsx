import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Work in Progress Banner Component
 *
 * Displays a dismissible banner at the top of the page to inform users
 * that the toolkit is under active development.
 *
 * Features:
 * - Visible to all users
 * - Dismissible (stores preference in localStorage)
 * - Uses amber color scheme for visibility
 */
function GuestModeBannerInner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const bannerDismissed = localStorage.getItem('guestBannerDismissed');
    setDismissed(!!bannerDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('guestBannerDismissed', 'true');
    setDismissed(true);
  };

  // Don't show banner if dismissed
  if (dismissed) {
    return null;
  }

  return (
    <div className="bg-secondary text-secondary-foreground border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="relative flex items-center justify-center">
          <div className="text-center pr-8">
            <p className="text-sm">
              This website is a work in progress, expect changes.{' '}
              <a
                href="/about#contact"
                className="font-medium hover:opacity-80 transition-opacity"
              >
                Contact us
              </a>
              {' '}to get involved.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="absolute right-0 hover:opacity-80 transition-opacity"
            aria-label="Dismiss banner"
            title="Dismiss this message"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper to prevent Astro's renderer probe from invoking hooks directly.
 * This prevents "Invalid hook call" warnings during component detection.
 */
export default function GuestModeBanner() {
  return <GuestModeBannerInner />;
}

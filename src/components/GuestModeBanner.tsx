import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Guest Mode Banner Component
 *
 * Displays a dismissible banner at the top of the page when a user is browsing
 * in guest mode (unauthenticated). Encourages signup for sync and collaboration features.
 *
 * Features:
 * - Auto-detects guest mode via localStorage 'guestId'
 * - Dismissible (stores preference in localStorage)
 * - Links to signup page
 * - Shows benefits of creating an account
 */
function GuestModeBannerInner() {
  const [isGuest, setIsGuest] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user is in guest mode
    const guestId = localStorage.getItem('guestId');
    const bannerDismissed = localStorage.getItem('guestBannerDismissed');

    setIsGuest(!!guestId);
    setDismissed(!!bannerDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('guestBannerDismissed', 'true');
    setDismissed(true);
  };

  // Don't show banner if not a guest or if dismissed
  if (!isGuest || dismissed) {
    return null;
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
      <div className="container mx-auto px-4 py-3">
        <div className="relative flex items-center justify-center">
          <div className="text-center pr-8">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <strong>Guest Mode:</strong> Your data is stored locally on this device.{' '}
              <a
                href="/auth/signup"
                className="underline font-medium hover:text-amber-700 dark:hover:text-amber-100 transition-colors"
              >
                Create an account
              </a>
              {' '}to sync across devices.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="absolute right-0 text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
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

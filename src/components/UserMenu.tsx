/**
 * UserMenu Component
 *
 * Displays user authentication state in the header:
 * - Sign In button when logged out
 * - User avatar/menu when logged in
 *
 * This is a client-side React component with Flagsmith integration
 * for UI features (not security decisions).
 */

import { useState, useEffect, useRef } from 'react';
import { User, LogOut, LayoutDashboard, ChevronDown } from 'lucide-react';
import { getSession, signOut, onAuthStateChange } from '../lib/supabase';
import { initClientFlags, isAuthRequiredClient } from '../lib/featureFlags.client';
import type { Session } from '@supabase/supabase-js';

export default function UserMenu() {
  const [session, setSession] = useState<Session | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // Initialize feature flags
  useEffect(() => {
    initClientFlags();
    setAuthRequired(isAuthRequiredClient());
  }, []);

  // Load session on mount
  useEffect(() => {
    getSession()
      .then((session) => {
        setSession(session);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('[UserMenu] Error loading session:', error);
        setIsLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Clear local storage
      localStorage.removeItem('activeHubId');
      // Redirect to home
      window.location.href = '/';
    } catch (error) {
      console.error('[UserMenu] Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  // Don't render if loading (prevents flash)
  if (isLoading) {
    return null;
  }

  // User is logged in
  if (session?.user) {
    const user = session.user;
    const email = user.email || '';
    const fullName = user.user_metadata?.full_name || email.split('@')[0];
    const initials = fullName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
            {initials}
          </div>

          {/* Name (hidden on mobile) */}
          <span className="hidden md:inline text-sm font-medium text-gray-900 dark:text-white">
            {fullName}
          </span>

          {/* Chevron */}
          <ChevronDown
            className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-1 z-50">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {fullName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {email}
              </p>
            </div>

            {/* Menu Items */}
            <a
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </a>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    );
  }

  // User is logged out - show Sign In button
  return (
    <div className="flex items-center gap-3">
      <a
        href="/auth/login"
        className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary transition-colors"
      >
        Sign In
      </a>
      <a
        href="/auth/signup"
        className="button-link inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg transition-all duration-default ease-default shadow-sm hover:shadow-raised active:translate-y-px text-sm font-medium action-button-primary"
      >
        <User className="w-4 h-4" />
        Get Started
      </a>
    </div>
  );
}

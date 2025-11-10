/**
 * Feature Flags Library - CLIENT-SIDE ONLY
 *
 * This module provides client-side feature flag functionality using the
 * browser-compatible Flagsmith SDK. Safe for use in React islands and
 * client-side hydration.
 *
 * Security considerations:
 * - Client-side SDK is used for UI features only (untrusted)
 * - DO NOT use for auth decisions - use server-side version
 * - Always defaults to most restrictive settings on error
 */

import Flagsmith from 'flagsmith';

// Environment variables
const FLAGSMITH_ENV_KEY = import.meta.env.PUBLIC_FLAGSMITH_ENVIRONMENT_KEY;

// Feature flag keys (centralized for type safety)
export const FeatureFlags = {
  AUTH_REQUIRED: 'auth-required',
  AUTO_CREATE_HUB: 'auto-create-hub',
  SHOW_PUBLIC_MODULES: 'show-public-modules',
  ENABLE_GUEST_MODE: 'enable-guest-mode',
  SYNC_INTERVAL_MS: 'sync-interval-ms',
  EARLY_ACCESS_REQUIRED: 'early-access-required',
  EARLY_ACCESS_ENABLED: 'early-access-enabled',
} as const;

// Default values (most restrictive for security)
const DEFAULTS = {
  [FeatureFlags.AUTH_REQUIRED]: true,
  [FeatureFlags.AUTO_CREATE_HUB]: true,
  [FeatureFlags.SHOW_PUBLIC_MODULES]: false,
  [FeatureFlags.ENABLE_GUEST_MODE]: false,
  [FeatureFlags.SYNC_INTERVAL_MS]: 30000,
  [FeatureFlags.EARLY_ACCESS_REQUIRED]: true,
  [FeatureFlags.EARLY_ACCESS_ENABLED]: false,
};

// Constants for non-flag settings
export const PASSWORD_MIN_LENGTH = 8; // Hardcoded - no need for remote config

// Client-side Flagsmith instance (cached)
let clientInstance: typeof Flagsmith | null = null;

/**
 * Initialize client-side Flagsmith SDK
 * Use this for UI features only - NOT for auth decisions
 */
export function initClientFlags() {
  if (typeof window === 'undefined') {
    console.warn('Attempted to initialize client flags on server-side');
    return null;
  }

  if (clientInstance) {
    return clientInstance;
  }

  if (!FLAGSMITH_ENV_KEY) {
    console.warn('PUBLIC_FLAGSMITH_ENVIRONMENT_KEY not configured, using defaults');
    return null;
  }

  try {
    Flagsmith.init({
      environmentID: FLAGSMITH_ENV_KEY,
      cacheFlags: false, // Disable caching to ensure fresh flags on every load
      enableAnalytics: false, // Disable to avoid tracking
      onChange: (oldFlags, params) => {
        console.log('[FeatureFlags] Flags updated:', params.flagsChanged);
      },
    });
    clientInstance = Flagsmith;
    return clientInstance;
  } catch (error) {
    console.error('[FeatureFlags] Failed to initialize client SDK:', error);
    return null;
  }
}

/**
 * Get a boolean flag value (client-side)
 * Falls back to default if Flagsmith is unavailable
 */
export function getClientFlag(
  flagKey: string,
  defaultValue: boolean = false
): boolean {
  try {
    const sdk = initClientFlags();
    if (!sdk) {
      return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as boolean) ?? defaultValue;
    }

    if (!sdk.hasFeature(flagKey)) {
      return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as boolean) ?? defaultValue;
    }

    const value = sdk.getValue(flagKey);
    return Boolean(value);
  } catch (error) {
    console.error(`[FeatureFlags] Error fetching client flag "${flagKey}":`, error);
    return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as boolean) ?? defaultValue;
  }
}

/**
 * Get a numeric flag value (client-side)
 */
export function getClientFlagNumber(
  flagKey: string,
  defaultValue: number = 0
): number {
  try {
    const sdk = initClientFlags();
    if (!sdk) {
      return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as number) ?? defaultValue;
    }

    if (!sdk.hasFeature(flagKey)) {
      return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as number) ?? defaultValue;
    }

    const value = sdk.getValue(flagKey);
    return Number(value);
  } catch (error) {
    console.error(`[FeatureFlags] Error fetching client flag "${flagKey}":`, error);
    return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as number) ?? defaultValue;
  }
}

// =============================================================================
// Convenience functions for common flags (CLIENT-SIDE)
// =============================================================================

/**
 * Get sync interval in milliseconds (CLIENT-SIDE)
 * Used to determine how often to sync data with Supabase
 */
export function getSyncInterval(): number {
  return getClientFlagNumber(FeatureFlags.SYNC_INTERVAL_MS, 30000);
}

/**
 * Client-side version of isAuthRequired (for UI only)
 * DO NOT use this for actual auth decisions - use server-side version
 */
export function isAuthRequiredClient(): boolean {
  return getClientFlag(FeatureFlags.AUTH_REQUIRED, true);
}

/**
 * Client-side version of isGuestModeEnabled (for UI only)
 */
export function isGuestModeEnabledClient(): boolean {
  return getClientFlag(FeatureFlags.ENABLE_GUEST_MODE, false);
}

/**
 * Client-side version of isAutoCreateHubEnabled (for UI only)
 */
export function isAutoCreateHubEnabled(): boolean {
  return getClientFlag(FeatureFlags.AUTO_CREATE_HUB, true);
}

/**
 * Check if Flagsmith is properly configured (client-side check only)
 */
export function isFlagsmithConfigured(): boolean {
  return !!FLAGSMITH_ENV_KEY;
}

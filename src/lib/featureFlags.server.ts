/**
 * Feature Flags Library - SERVER-SIDE ONLY
 *
 * This module provides server-side feature flag functionality using the
 * Node.js-only Flagsmith SDK. NOT safe for client-side use or hydration.
 *
 * Security considerations:
 * - Server-side SDK is used for auth-related decisions (trusted)
 * - Always defaults to most restrictive settings on error
 * - Use this for security-critical feature flag checks
 */

import { Flagsmith as FlagsmithNode } from 'flagsmith-nodejs';

// Environment variables
const FLAGSMITH_SERVER_KEY = import.meta.env.FLAGSMITH_SERVER_KEY;

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

// Server-side Flagsmith instance (cached)
let serverInstance: FlagsmithNode | null = null;

/**
 * Initialize server-side Flagsmith SDK
 * Use this for auth and security decisions (trusted)
 */
export async function initServerFlags() {
  if (serverInstance) {
    return serverInstance;
  }

  if (!FLAGSMITH_SERVER_KEY) {
    console.warn('FLAGSMITH_SERVER_KEY not configured, using defaults');
    return null;
  }

  try {
    serverInstance = new FlagsmithNode({
      environmentKey: FLAGSMITH_SERVER_KEY,
      enableLocalEvaluation: false, // Use server evaluation for security
    });

    // Initialize the SDK
    await serverInstance.getEnvironmentFlags();

    return serverInstance;
  } catch (error) {
    console.error('[FeatureFlags] Failed to initialize server SDK:', error);
    return null;
  }
}

/**
 * Get a boolean flag value (server-side)
 * Falls back to default if Flagsmith is unavailable
 */
export async function getServerFlag(
  flagKey: string,
  defaultValue: boolean = false
): Promise<boolean> {
  try {
    const sdk = await initServerFlags();
    if (!sdk) {
      return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as boolean) ?? defaultValue;
    }

    const flags = await sdk.getEnvironmentFlags();
    const flag = flags.getFeatureValue(flagKey);

    if (flag === null || flag === undefined) {
      return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as boolean) ?? defaultValue;
    }

    return Boolean(flag);
  } catch (error) {
    console.error(`[FeatureFlags] Error fetching flag "${flagKey}":`, error);
    return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as boolean) ?? defaultValue;
  }
}

/**
 * Get a numeric flag value (server-side)
 */
export async function getServerFlagNumber(
  flagKey: string,
  defaultValue: number = 0
): Promise<number> {
  try {
    const sdk = await initServerFlags();
    if (!sdk) {
      return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as number) ?? defaultValue;
    }

    const flags = await sdk.getEnvironmentFlags();
    const flag = flags.getFeatureValue(flagKey);

    if (flag === null || flag === undefined) {
      return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as number) ?? defaultValue;
    }

    return Number(flag);
  } catch (error) {
    console.error(`[FeatureFlags] Error fetching flag "${flagKey}":`, error);
    return (DEFAULTS[flagKey as keyof typeof DEFAULTS] as number) ?? defaultValue;
  }
}

// =============================================================================
// Convenience functions for common flags (SERVER-SIDE)
// =============================================================================

/**
 * Check if authentication is required to access modules (SERVER-SIDE ONLY)
 * This is a security decision and must use server-side SDK
 */
export async function isAuthRequired(): Promise<boolean> {
  return getServerFlag(FeatureFlags.AUTH_REQUIRED, true);
}

/**
 * Check if guest mode is enabled (SERVER-SIDE ONLY)
 * This affects auth flow and must use server-side SDK
 */
export async function isGuestModeEnabled(): Promise<boolean> {
  return getServerFlag(FeatureFlags.ENABLE_GUEST_MODE, false);
}

/**
 * Check if hubs should be auto-created on signup (SERVER-SIDE ONLY)
 */
export async function isAutoCreateHubEnabled(): Promise<boolean> {
  return getServerFlag(FeatureFlags.AUTO_CREATE_HUB, true);
}

/**
 * Check if public module previews are enabled (SERVER-SIDE)
 */
export async function showPublicModules(): Promise<boolean> {
  return getServerFlag(FeatureFlags.SHOW_PUBLIC_MODULES, false);
}

/**
 * Server-side version of getSyncInterval (for SSR contexts)
 */
export async function getSyncIntervalServer(): Promise<number> {
  return getServerFlagNumber(FeatureFlags.SYNC_INTERVAL_MS, 30000);
}

/**
 * Get all flags for debugging (server-side)
 */
export async function getAllServerFlags(): Promise<Record<string, any>> {
  try {
    const sdk = await initServerFlags();
    if (!sdk) {
      return DEFAULTS;
    }

    const flags = await sdk.getEnvironmentFlags();
    const allFlags: Record<string, any> = {};

    Object.values(FeatureFlags).forEach((key) => {
      allFlags[key] = flags.getFeatureValue(key) ?? DEFAULTS[key];
    });

    return allFlags;
  } catch (error) {
    console.error('[FeatureFlags] Error fetching all flags:', error);
    return DEFAULTS;
  }
}

/**
 * Check if Flagsmith is properly configured (server-side check)
 */
export function isFlagsmithConfigured(): boolean {
  return !!FLAGSMITH_SERVER_KEY;
}

/**
 * Log current flag status (for debugging)
 */
export async function logFlagStatus() {
  const configured = isFlagsmithConfigured();
  console.log('[FeatureFlags] Configuration status:', {
    configured,
    hasServerKey: !!FLAGSMITH_SERVER_KEY,
  });

  if (configured) {
    const flags = await getAllServerFlags();
    console.log('[FeatureFlags] Current flags:', flags);
  } else {
    console.log('[FeatureFlags] Using default values:', DEFAULTS);
  }
}

/**
 * Check if a user has early access (SERVER-SIDE ONLY)
 * Uses Flagsmith identity-based feature flags
 *
 * @param email - User email to check for early access
 * @returns true if user has early access enabled
 */
export async function checkEarlyAccess(email: string): Promise<boolean> {
  try {
    const sdk = await initServerFlags();
    if (!sdk) {
      console.warn('[FeatureFlags] Flagsmith not configured, denying early access');
      return false; // Fail closed for security
    }

    // Get flags for this specific user identity
    const flags = await sdk.getIdentityFlags(email);
    const hasAccess = flags.isFeatureEnabled(FeatureFlags.EARLY_ACCESS_ENABLED);

    console.log(`[FeatureFlags] Early access check for ${email}:`, hasAccess);
    return hasAccess;
  } catch (error) {
    console.error(`[FeatureFlags] Error checking early access for ${email}:`, error);
    return false; // Fail closed on error
  }
}

/**
 * Check if early access is required globally (SERVER-SIDE ONLY)
 * @returns true if early access requirement is enabled
 */
export async function isEarlyAccessRequired(): Promise<boolean> {
  return getServerFlag(FeatureFlags.EARLY_ACCESS_REQUIRED, true);
}

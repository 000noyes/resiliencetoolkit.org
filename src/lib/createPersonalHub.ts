/**
 * Personal Hub Creation Utility
 *
 * This module handles the automatic creation of personal hubs for new users.
 *
 * Security considerations:
 * - Input validation and sanitization
 * - RLS policies enforce ownership
 * - Transaction-like behavior (hub + membership)
 * - Rate limiting handled by Supabase auth
 */

import { createHub, getCurrentUser, getSupabase } from './supabase';

/**
 * Maximum length for hub names (prevent DoS via large inputs)
 */
const MAX_HUB_NAME_LENGTH = 100;

/**
 * Maximum length for hub descriptions
 */
const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Sanitize a string by trimming and limiting length
 */
function sanitizeString(input: string | undefined | null, maxLength: number): string {
  if (!input) return '';
  return input.trim().slice(0, maxLength);
}

/**
 * Generate a default hub name for a user
 */
function generateDefaultHubName(userName?: string | null): string {
  if (userName) {
    const sanitized = sanitizeString(userName, 50);
    return `${sanitized}'s Hub`;
  }
  return 'My Resilience Hub';
}

/**
 * Detect timezone from browser (with fallback)
 */
function detectTimezone(): string {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone) {
        return timezone;
      }
    }
  } catch (error) {
    console.warn('[CreateHub] Failed to detect timezone:', error);
  }
  return 'America/New_York'; // Fallback
}

export interface CreatePersonalHubOptions {
  /**
   * Custom hub name (optional)
   * If not provided, generates "{User}'s Hub"
   */
  hubName?: string;

  /**
   * Hub description (optional)
   */
  description?: string;

  /**
   * Location (city, region) (optional)
   */
  location?: string;

  /**
   * Timezone (optional)
   * If not provided, attempts to detect from browser
   */
  timezone?: string;

  /**
   * Additional settings (optional)
   */
  settings?: Record<string, any>;
}

export interface PersonalHub {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  timezone: string;
  settings: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create a personal hub for the current user
 *
 * This function:
 * 1. Creates a new hub with the user as creator
 * 2. Adds the user as a 'steward' (admin) of the hub
 * 3. Returns the hub data
 *
 * @param options - Hub configuration options
 * @returns The created hub data
 * @throws Error if not authenticated or creation fails
 */
export async function createPersonalHub(
  options: CreatePersonalHubOptions = {}
): Promise<PersonalHub> {
  const supabase = getSupabase();

  // Get current user
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('User must be authenticated to create a hub');
  }

  // Get user's full name from metadata
  const fullName = user.user_metadata?.full_name;

  // Sanitize inputs
  const hubName = sanitizeString(
    options.hubName || generateDefaultHubName(fullName),
    MAX_HUB_NAME_LENGTH
  );

  const description = sanitizeString(
    options.description || 'My personal resilience hub',
    MAX_DESCRIPTION_LENGTH
  );

  const location = sanitizeString(options.location, MAX_HUB_NAME_LENGTH);

  const timezone = options.timezone || detectTimezone();

  const settings = options.settings || {
    personal: true, // Mark as personal hub
    createdVia: 'auto-create', // Track creation method
  };

  // Validate hub name
  if (!hubName || hubName.length === 0) {
    throw new Error('Hub name cannot be empty');
  }

  try {
    // Step 1: Create the hub
    const hub = await createHub({
      name: hubName,
      description: description || null,
      location: location || null,
      timezone,
      settings,
    });

    // Step 2: Add user as steward (admin) of the hub
    const { error: membershipError } = await supabase
      .from('hub_members')
      .insert({
        hub_id: hub.id,
        user_id: user.id,
        role: 'steward', // Full admin access
      });

    if (membershipError) {
      // Attempt to clean up the hub if membership creation fails
      // Note: This is best-effort, RLS might prevent deletion
      try {
        await supabase.from('hubs').delete().eq('id', hub.id);
      } catch (cleanupError) {
        console.error('[CreateHub] Failed to clean up hub after membership error:', cleanupError);
      }

      throw new Error(`Failed to set hub ownership: ${membershipError.message}`);
    }

    console.log('[CreateHub] Successfully created personal hub:', {
      hubId: hub.id,
      hubName: hub.name,
      userId: user.id,
    });

    return hub;
  } catch (error) {
    console.error('[CreateHub] Error creating personal hub:', error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to create personal hub. Please try again.');
  }
}

/**
 * Check if a user already has a personal hub
 * (Hubs with settings.personal = true)
 *
 * @returns The personal hub if found, null otherwise
 */
export async function getPersonalHub(): Promise<PersonalHub | null> {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  try {
    // Get hubs where user is a member
    const { data: memberships, error: membershipError } = await supabase
      .from('hub_members')
      .select('hub_id')
      .eq('user_id', user.id);

    if (membershipError || !memberships || memberships.length === 0) {
      return null;
    }

    const hubIds = memberships.map(m => m.hub_id);

    // Find personal hub (has settings.personal = true)
    const { data: hubs, error: hubsError } = await supabase
      .from('hubs')
      .select('*')
      .in('id', hubIds)
      .contains('settings', { personal: true })
      .order('created_at', { ascending: true })
      .limit(1);

    if (hubsError || !hubs || hubs.length === 0) {
      return null;
    }

    return hubs[0] as PersonalHub;
  } catch (error) {
    console.error('[CreateHub] Error fetching personal hub:', error);
    return null;
  }
}

/**
 * Get or create a personal hub for the current user
 *
 * This is an idempotent operation - if a personal hub exists, returns it.
 * Otherwise, creates a new one.
 *
 * @param options - Hub configuration options (used only if creating new)
 * @returns The personal hub (existing or newly created)
 */
export async function getOrCreatePersonalHub(
  options: CreatePersonalHubOptions = {}
): Promise<PersonalHub> {
  // Check if user already has a personal hub
  const existingHub = await getPersonalHub();

  if (existingHub) {
    console.log('[CreateHub] User already has a personal hub:', existingHub.id);
    return existingHub;
  }

  // Create a new personal hub
  console.log('[CreateHub] Creating new personal hub for user');
  return createPersonalHub(options);
}

/**
 * Set the active hub in localStorage
 * This is used by the sync service to know which hub to sync with
 *
 * @param hubId - The hub ID to set as active
 */
export function setActiveHub(hubId: string): void {
  if (typeof window === 'undefined') {
    console.warn('[CreateHub] Cannot set active hub on server-side');
    return;
  }

  try {
    localStorage.setItem('activeHubId', hubId);
    console.log('[CreateHub] Set active hub:', hubId);

    // Dispatch custom event so sync service can react
    window.dispatchEvent(new CustomEvent('hubChanged', { detail: { hubId } }));
  } catch (error) {
    console.error('[CreateHub] Failed to set active hub:', error);
  }
}

/**
 * Get the active hub ID from localStorage
 *
 * @returns The active hub ID, or null if not set
 */
export function getActiveHubId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem('activeHubId');
  } catch (error) {
    console.error('[CreateHub] Failed to get active hub:', error);
    return null;
  }
}

/**
 * Clear the active hub from localStorage
 */
export function clearActiveHub(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem('activeHubId');
    console.log('[CreateHub] Cleared active hub');

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('hubChanged', { detail: { hubId: null } }));
  } catch (error) {
    console.error('[CreateHub] Failed to clear active hub:', error);
  }
}

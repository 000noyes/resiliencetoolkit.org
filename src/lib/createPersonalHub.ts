/**
 * Hub Management - DISABLED
 *
 * Hub creation and management removed - app is fully local
 * All hub functions now return stubs or null
 *
 * Original file preserved at bottom as comments for future restoration
 */

/**
 * DISABLED - No hubs in local-only app
 */
export function getActiveHubId(): string | null {
  return null;
}

/**
 * DISABLED - No hubs in local-only app
 */
export function setActiveHub(hubId: string): void {
  console.log('[Hub] setActiveHub() called but hubs are disabled');
  // Do nothing
}

/**
 * DISABLED - Cannot create hubs
 */
export async function createPersonalHub(): Promise<any> {
  throw new Error('Hub creation disabled - app is fully local');
}

/**
 * DISABLED - No hubs to retrieve
 */
export async function getPersonalHub(): Promise<any> {
  return null;
}

/**
 * DISABLED - No hubs to get or create
 */
export async function getOrCreatePersonalHub(): Promise<any> {
  throw new Error('Hub management disabled - app is fully local');
}

/* ============================================================================
 * ORIGINAL HUB MANAGEMENT IMPLEMENTATION COMMENTED OUT BELOW
 * ==========================================================================
 *
 * To restore Supabase hub functionality, uncomment the code below and remove
 * the stub functions above.
 *
 * Original createPersonalHub.ts file (333 lines):
 * - Creates personal hubs in Supabase
 * - Functions: createPersonalHub(), getPersonalHub(), getOrCreatePersonalHub()
 * - Hub membership management
 * - localStorage management for active hub ID
 * - Imports: createHub, getCurrentUser, getSupabase
 *
 * All functionality has been disabled - the app no longer uses the hub concept
 * for organizing data.
 *
 * ========================================================================== */
